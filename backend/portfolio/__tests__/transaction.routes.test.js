const express = require("express");
const request = require("supertest");

const VALID_ID = "507f1f77bcf86cd799439011";

jest.mock("../transaction.service", () => ({
    addTransaction: jest.fn(),
    getTransactions: jest.fn(),
    getTransaction: jest.fn(),
    updateTransaction: jest.fn(),
    deleteTransaction: jest.fn(),
    TransactionNotFoundError: class TransactionNotFoundError extends Error {
        constructor() {
            super("Transaction not found.");
            this.statusCode = 404;
        }
    },
    TransactionValidationError: class TransactionValidationError extends Error {
        constructor(errors) {
            super("Transaction validation failed.");
            this.statusCode = 422;
            this.errors = errors;
        }
    },
    InsufficientHoldingsError: class InsufficientHoldingsError extends Error {
        constructor() {
            super("Insufficient holdings.");
            this.statusCode = 422;
        }
    },
}));
jest.mock("../../services/company.service", () => ({ resolveTicker: jest.fn() }));
jest.mock("../../identity/identity.service", () => ({ resolveUserIdByToken: jest.fn() }));

const transactionService = require("../transaction.service");
const companyService = require("../../services/company.service");
const identityService = require("../../identity/identity.service");
const transactionRoutes = require("../transaction.routes");

const app = express();
app.use(express.json());
app.use("/api/portfolio/transactions", transactionRoutes);

afterEach(() => {
    jest.clearAllMocks();
});

describe("authentication", () => {
    it("rejects requests with no Authorization header", async () => {
        const response = await request(app).get("/api/portfolio/transactions");
        expect(response.status).toBe(401);
        expect(transactionService.getTransactions).not.toHaveBeenCalled();
    });
});

describe("user isolation / ownership", () => {
    beforeEach(() => {
        identityService.resolveUserIdByToken.mockImplementation(async (token) => (token === "token-a" ? "userA" : "userB"));
    });

    it("scopes GET / to the caller's own userId, never a client-supplied one", async () => {
        transactionService.getTransactions.mockResolvedValue([]);

        await request(app).get("/api/portfolio/transactions?userId=someoneElse").set("Authorization", "Bearer token-a");

        expect(transactionService.getTransactions).toHaveBeenCalledWith("userA", { ticker: undefined });
    });

    it("returns 404 (not another user's data) when userB tries to update userA's transaction", async () => {
        transactionService.updateTransaction.mockRejectedValue(new transactionService.TransactionNotFoundError());

        const response = await request(app)
            .put(`/api/portfolio/transactions/${VALID_ID}`)
            .set("Authorization", "Bearer token-b")
            .send({ type: "BUY", quantity: 5, price: 100, transactionDate: "2025-01-01" });

        expect(response.status).toBe(404);
        expect(transactionService.updateTransaction).toHaveBeenCalledWith("userB", VALID_ID, expect.any(Object));
    });

    it("returns 404 when userB tries to delete userA's transaction", async () => {
        transactionService.deleteTransaction.mockRejectedValue(new transactionService.TransactionNotFoundError());

        const response = await request(app).delete(`/api/portfolio/transactions/${VALID_ID}`).set("Authorization", "Bearer token-b");

        expect(response.status).toBe(404);
        expect(transactionService.deleteTransaction).toHaveBeenCalledWith("userB", VALID_ID);
    });
});

describe("POST /api/portfolio/transactions", () => {
    beforeEach(() => {
        identityService.resolveUserIdByToken.mockResolvedValue("user1");
    });

    it("returns 404 when the ticker/name cannot be resolved", async () => {
        companyService.resolveTicker.mockResolvedValue(null);

        const response = await request(app)
            .post("/api/portfolio/transactions")
            .set("Authorization", "Bearer good-token")
            .send({ ticker: "ZZZZ", type: "BUY", quantity: 10, price: 100, transactionDate: "2025-01-01" });

        expect(response.status).toBe(404);
        expect(transactionService.addTransaction).not.toHaveBeenCalled();
    });

    it("returns 422 when the service reports a validation error", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        transactionService.addTransaction.mockRejectedValue(new transactionService.TransactionValidationError(["Quantity must be positive."]));

        const response = await request(app)
            .post("/api/portfolio/transactions")
            .set("Authorization", "Bearer good-token")
            .send({ ticker: "AAPL", type: "BUY", quantity: -1, price: 100, transactionDate: "2025-01-01" });

        expect(response.status).toBe(422);
    });

    it("returns 422 when the service rejects an oversized SELL", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        transactionService.addTransaction.mockRejectedValue(new transactionService.InsufficientHoldingsError());

        const response = await request(app)
            .post("/api/portfolio/transactions")
            .set("Authorization", "Bearer good-token")
            .send({ ticker: "AAPL", type: "SELL", quantity: 999, price: 100, transactionDate: "2025-01-01" });

        expect(response.status).toBe(422);
    });

    it("creates a transaction for a resolved company", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        transactionService.addTransaction.mockResolvedValue({ _id: VALID_ID, ticker: "AAPL" });

        const response = await request(app)
            .post("/api/portfolio/transactions")
            .set("Authorization", "Bearer good-token")
            .send({ ticker: "aapl", type: "buy", quantity: 10, price: 100, transactionDate: "2025-01-01" });

        expect(response.status).toBe(201);
        expect(transactionService.addTransaction).toHaveBeenCalledWith("user1", expect.objectContaining({ ticker: "AAPL" }));
    });
});

describe("POST /api/portfolio/transactions/import", () => {
    beforeEach(() => {
        identityService.resolveUserIdByToken.mockResolvedValue("user1");
    });

    it("rejects requests with no Authorization header", async () => {
        const response = await request(app)
            .post("/api/portfolio/transactions/import")
            .send({ transactions: [{ ticker: "AAPL", type: "BUY", quantity: 1, price: 1, transactionDate: "2025-01-01" }] });

        expect(response.status).toBe(401);
        expect(transactionService.addTransaction).not.toHaveBeenCalled();
    });

    it("returns 400 when no rows are given", async () => {
        const response = await request(app)
            .post("/api/portfolio/transactions/import")
            .set("Authorization", "Bearer good-token")
            .send({ transactions: [] });

        expect(response.status).toBe(400);
        expect(transactionService.addTransaction).not.toHaveBeenCalled();
    });

    it("returns 400 when the row count exceeds the cap", async () => {
        const transactions = Array.from({ length: 501 }, () => ({
            ticker: "AAPL",
            type: "BUY",
            quantity: 1,
            price: 1,
            transactionDate: "2025-01-01",
        }));

        const response = await request(app)
            .post("/api/portfolio/transactions/import")
            .set("Authorization", "Bearer good-token")
            .send({ transactions });

        expect(response.status).toBe(400);
        expect(transactionService.addTransaction).not.toHaveBeenCalled();
    });

    it("replays rows in chronological order regardless of file order, and reports results back in the file's original order", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        transactionService.addTransaction.mockImplementation(async (userId, { transactionDate }) => ({
            _id: `txn-${transactionDate}`,
            transactionDate,
        }));

        const response = await request(app)
            .post("/api/portfolio/transactions/import")
            .set("Authorization", "Bearer good-token")
            .send({
                transactions: [
                    { ticker: "AAPL", type: "SELL", quantity: 5, price: 150, transactionDate: "2025-06-01" }, // file order: SELL first
                    { ticker: "AAPL", type: "BUY", quantity: 10, price: 100, transactionDate: "2025-01-01" }, // BUY second, but chronologically earlier
                ],
            });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ imported: 2, failed: 0, results: [{ success: true, transaction: expect.anything() }, { success: true, transaction: expect.anything() }] });

        // The service must have been called BUY-first (chronological), even though the SELL was first in the file.
        const calls = transactionService.addTransaction.mock.calls;
        expect(calls[0][1].transactionDate).toBe("2025-01-01");
        expect(calls[1][1].transactionDate).toBe("2025-06-01");
    });

    it("fails only the row whose ticker cannot be resolved, not the whole batch", async () => {
        companyService.resolveTicker.mockImplementation(async (query) => (query === "ZZZZ" ? null : "AAPL"));
        transactionService.addTransaction.mockResolvedValue({ _id: "txn-1" });

        const response = await request(app)
            .post("/api/portfolio/transactions/import")
            .set("Authorization", "Bearer good-token")
            .send({
                transactions: [
                    { ticker: "AAPL", type: "BUY", quantity: 10, price: 100, transactionDate: "2025-01-01" },
                    { ticker: "ZZZZ", type: "BUY", quantity: 5, price: 50, transactionDate: "2025-02-01" },
                ],
            });

        expect(response.status).toBe(200);
        expect(response.body.imported).toBe(1);
        expect(response.body.failed).toBe(1);
        expect(response.body.results[0].success).toBe(true);
        expect(response.body.results[1].success).toBe(false);
    });

    it("reports a per-row validation failure without aborting the rest of the batch", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        transactionService.addTransaction
            .mockResolvedValueOnce({ _id: "txn-1" })
            .mockRejectedValueOnce(new transactionService.TransactionValidationError(["Quantity must be a positive number."]));

        const response = await request(app)
            .post("/api/portfolio/transactions/import")
            .set("Authorization", "Bearer good-token")
            .send({
                transactions: [
                    { ticker: "AAPL", type: "BUY", quantity: 10, price: 100, transactionDate: "2025-01-01" },
                    { ticker: "AAPL", type: "BUY", quantity: -1, price: 100, transactionDate: "2025-02-01" },
                ],
            });

        expect(response.status).toBe(200);
        expect(response.body.imported).toBe(1);
        expect(response.body.failed).toBe(1);
        expect(response.body.results.some((r) => !r.success && r.message === "Transaction validation failed.")).toBe(true);
    });
});

describe("malformed ids", () => {
    beforeEach(() => {
        identityService.resolveUserIdByToken.mockResolvedValue("user1");
    });

    it("returns 400 for a malformed transaction id on GET/PUT/DELETE", async () => {
        const getResponse = await request(app).get("/api/portfolio/transactions/not-an-id").set("Authorization", "Bearer good-token");
        const putResponse = await request(app)
            .put("/api/portfolio/transactions/not-an-id")
            .set("Authorization", "Bearer good-token")
            .send({ type: "BUY", quantity: 1, price: 1, transactionDate: "2025-01-01" });
        const deleteResponse = await request(app).delete("/api/portfolio/transactions/not-an-id").set("Authorization", "Bearer good-token");

        expect(getResponse.status).toBe(400);
        expect(putResponse.status).toBe(400);
        expect(deleteResponse.status).toBe(400);
        expect(transactionService.getTransaction).not.toHaveBeenCalled();
        expect(transactionService.updateTransaction).not.toHaveBeenCalled();
        expect(transactionService.deleteTransaction).not.toHaveBeenCalled();
    });
});
