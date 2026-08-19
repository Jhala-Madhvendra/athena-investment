const express = require("express");
const request = require("supertest");

const VALID_ID = "507f1f77bcf86cd799439011";

jest.mock("../portfolio.service", () => ({
    getPortfolio: jest.fn(),
    getPortfolioSummary: jest.fn(),
    addHolding: jest.fn(),
    updateHolding: jest.fn(),
    deleteHolding: jest.fn(),
    HoldingNotFoundError: class HoldingNotFoundError extends Error {
        constructor() {
            super("Holding not found.");
            this.statusCode = 404;
        }
    },
    HoldingValidationError: class HoldingValidationError extends Error {
        constructor(errors) {
            super("Holding validation failed.");
            this.statusCode = 422;
            this.errors = errors;
        }
    },
}));
jest.mock("../../services/company.service", () => ({ resolveTicker: jest.fn() }));
jest.mock("../../identity/identity.service", () => ({ resolveUserIdByToken: jest.fn() }));
jest.mock("../portfolioHistory.service", () => ({ getHoldingsAt: jest.fn(), getHoldingsTimeline: jest.fn() }));

const portfolioService = require("../portfolio.service");
const companyService = require("../../services/company.service");
const identityService = require("../../identity/identity.service");
const portfolioHistoryService = require("../portfolioHistory.service");
const portfolioRoutes = require("../portfolio.routes");

const app = express();
app.use(express.json());
app.use("/api/portfolio", portfolioRoutes);

afterEach(() => {
    jest.clearAllMocks();
});

describe("authentication", () => {
    it("rejects requests with no Authorization header", async () => {
        const response = await request(app).get("/api/portfolio");
        expect(response.status).toBe(401);
        expect(portfolioService.getPortfolio).not.toHaveBeenCalled();
    });
});

describe("user isolation / ownership", () => {
    beforeEach(() => {
        identityService.resolveUserIdByToken.mockImplementation(async (token) =>
            token === "token-a" ? "userA" : "userB"
        );
    });

    it("scopes GET /api/portfolio to the caller's own userId", async () => {
        portfolioService.getPortfolio.mockResolvedValue({ holdings: [], summary: {} });

        await request(app).get("/api/portfolio").set("Authorization", "Bearer token-a");
        await request(app).get("/api/portfolio").set("Authorization", "Bearer token-b");

        expect(portfolioService.getPortfolio).toHaveBeenNthCalledWith(1, "userA");
        expect(portfolioService.getPortfolio).toHaveBeenNthCalledWith(2, "userB");
    });

    it("passes the caller's own userId (never a client-supplied one) when updating a holding", async () => {
        portfolioService.updateHolding.mockResolvedValue({ _id: VALID_ID });

        await request(app)
            .put(`/api/portfolio/holdings/${VALID_ID}`)
            .set("Authorization", "Bearer token-a")
            .send({ shares: 5, averagePurchasePrice: 100, purchaseDate: "2025-01-01", userId: "userB" });

        expect(portfolioService.updateHolding).toHaveBeenCalledWith("userA", VALID_ID, expect.any(Object));
    });

    it("returns 404 (not another user's data) when userB tries to delete userA's holding", async () => {
        portfolioService.deleteHolding.mockRejectedValue(new portfolioService.HoldingNotFoundError());

        const response = await request(app)
            .delete(`/api/portfolio/holdings/${VALID_ID}`)
            .set("Authorization", "Bearer token-b");

        expect(response.status).toBe(404);
        expect(portfolioService.deleteHolding).toHaveBeenCalledWith("userB", VALID_ID);
    });
});

describe("GET /api/portfolio/summary", () => {
    it("returns the computed summary", async () => {
        const identityMock = require("../../identity/identity.service");
        identityMock.resolveUserIdByToken.mockResolvedValue("user1");
        portfolioService.getPortfolioSummary.mockResolvedValue({ totalCostBasis: 1000 });

        const response = await request(app).get("/api/portfolio/summary").set("Authorization", "Bearer good-token");

        expect(response.status).toBe(200);
        expect(response.body.summary.totalCostBasis).toBe(1000);
    });
});

describe("POST /api/portfolio/holdings", () => {
    beforeEach(() => {
        identityService.resolveUserIdByToken.mockResolvedValue("user1");
    });

    it("returns 404 when the ticker/name cannot be resolved", async () => {
        companyService.resolveTicker.mockResolvedValue(null);

        const response = await request(app)
            .post("/api/portfolio/holdings")
            .set("Authorization", "Bearer good-token")
            .send({ ticker: "ZZZZ", shares: 10, averagePurchasePrice: 100, purchaseDate: "2025-01-01" });

        expect(response.status).toBe(404);
        expect(portfolioService.addHolding).not.toHaveBeenCalled();
    });

    it("returns 422 when the service reports validation errors", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        portfolioService.addHolding.mockRejectedValue(new portfolioService.HoldingValidationError(["Shares must be positive."]));

        const response = await request(app)
            .post("/api/portfolio/holdings")
            .set("Authorization", "Bearer good-token")
            .send({ ticker: "AAPL", shares: -1, averagePurchasePrice: 100, purchaseDate: "2025-01-01" });

        expect(response.status).toBe(422);
    });

    it("creates a holding for a resolved company", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        portfolioService.addHolding.mockResolvedValue({ _id: VALID_ID, ticker: "AAPL" });

        const response = await request(app)
            .post("/api/portfolio/holdings")
            .set("Authorization", "Bearer good-token")
            .send({ ticker: "aapl", shares: 10, averagePurchasePrice: 100, purchaseDate: "2025-01-01" });

        expect(response.status).toBe(201);
        expect(portfolioService.addHolding).toHaveBeenCalledWith(
            "user1",
            expect.objectContaining({ ticker: "AAPL", shares: 10 })
        );
    });
});

describe("GET /api/portfolio/holdings (reconstructed, as-of a date)", () => {
    beforeEach(() => {
        identityService.resolveUserIdByToken.mockResolvedValue("user1");
    });

    it("returns 400 when ?date is missing or invalid", async () => {
        const missing = await request(app).get("/api/portfolio/holdings").set("Authorization", "Bearer good-token");
        const invalid = await request(app).get("/api/portfolio/holdings?date=not-a-date").set("Authorization", "Bearer good-token");

        expect(missing.status).toBe(400);
        expect(invalid.status).toBe(400);
        expect(portfolioHistoryService.getHoldingsAt).not.toHaveBeenCalled();
    });

    it("scopes the reconstruction to the caller's own userId", async () => {
        portfolioHistoryService.getHoldingsAt.mockResolvedValue({ asOfDate: "2025-06-01", holdings: { AAPL: 10 }, hasTransactionHistory: true });

        const response = await request(app).get("/api/portfolio/holdings?date=2025-06-01").set("Authorization", "Bearer good-token");

        expect(response.status).toBe(200);
        expect(response.body.holdings).toEqual({ AAPL: 10 });
        expect(portfolioHistoryService.getHoldingsAt).toHaveBeenCalledWith("user1", "2025-06-01");
    });
});

describe("GET /api/portfolio/holdings/history", () => {
    beforeEach(() => {
        identityService.resolveUserIdByToken.mockResolvedValue("user1");
    });

    it("returns the reconstructed timeline for the caller's own userId", async () => {
        portfolioHistoryService.getHoldingsTimeline.mockResolvedValue({ hasTransactionHistory: true, timeline: [] });

        const response = await request(app).get("/api/portfolio/holdings/history").set("Authorization", "Bearer good-token");

        expect(response.status).toBe(200);
        expect(portfolioHistoryService.getHoldingsTimeline).toHaveBeenCalledWith("user1");
    });
});

describe("PUT/DELETE /api/portfolio/holdings/:id", () => {
    beforeEach(() => {
        identityService.resolveUserIdByToken.mockResolvedValue("user1");
    });

    it("returns 400 for a malformed holding id", async () => {
        const response = await request(app)
            .put("/api/portfolio/holdings/not-an-id")
            .set("Authorization", "Bearer good-token")
            .send({ shares: 5, averagePurchasePrice: 100, purchaseDate: "2025-01-01" });

        expect(response.status).toBe(400);
        expect(portfolioService.updateHolding).not.toHaveBeenCalled();
    });

    it("returns 200 and removes the holding", async () => {
        portfolioService.deleteHolding.mockResolvedValue({ _id: VALID_ID });

        const response = await request(app)
            .delete(`/api/portfolio/holdings/${VALID_ID}`)
            .set("Authorization", "Bearer good-token");

        expect(response.status).toBe(200);
    });
});
