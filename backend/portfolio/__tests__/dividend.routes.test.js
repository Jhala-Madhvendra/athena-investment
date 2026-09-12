const express = require("express");
const request = require("supertest");

const VALID_ID = "507f1f77bcf86cd799439011";

jest.mock("../dividend.service", () => ({
    addDividend: jest.fn(),
    getDividends: jest.fn(),
    updateDividend: jest.fn(),
    deleteDividend: jest.fn(),
    DividendNotFoundError: class DividendNotFoundError extends Error {
        constructor() {
            super("Dividend not found.");
            this.statusCode = 404;
        }
    },
    DividendValidationError: class DividendValidationError extends Error {
        constructor(errors) {
            super("Dividend validation failed.");
            this.statusCode = 422;
            this.errors = errors;
        }
    },
}));
jest.mock("../../services/company.service", () => ({ resolveTicker: jest.fn() }));
jest.mock("../../identity/identity.service", () => ({ resolveUserIdByToken: jest.fn() }));

const dividendService = require("../dividend.service");
const companyService = require("../../services/company.service");
const identityService = require("../../identity/identity.service");
const dividendRoutes = require("../dividend.routes");

const app = express();
app.use(express.json());
app.use("/api/dividends", dividendRoutes);

afterEach(() => {
    jest.clearAllMocks();
});

describe("authentication", () => {
    it.each([
        ["get", "/api/dividends"],
        ["post", "/api/dividends"],
        ["put", `/api/dividends/${VALID_ID}`],
        ["delete", `/api/dividends/${VALID_ID}`],
    ])("rejects %s %s with no Authorization header", async (method, path) => {
        const response = await request(app)[method](path).send({});
        expect(response.status).toBe(401);
    });
});

describe("POST /", () => {
    beforeEach(() => identityService.resolveUserIdByToken.mockResolvedValue("user1"));

    it("returns 404 when the ticker/name cannot be resolved", async () => {
        companyService.resolveTicker.mockResolvedValue(null);

        const response = await request(app)
            .post("/api/dividends")
            .set("Authorization", "Bearer good-token")
            .send({ ticker: "ZZZZ", amountPerShare: 1, shares: 10, payDate: "2025-01-01" });

        expect(response.status).toBe(404);
        expect(dividendService.addDividend).not.toHaveBeenCalled();
    });

    it("returns 422 when the service reports a validation error", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        dividendService.addDividend.mockRejectedValue(new dividendService.DividendValidationError(["Amount per share must be zero or a positive number."]));

        const response = await request(app)
            .post("/api/dividends")
            .set("Authorization", "Bearer good-token")
            .send({ ticker: "AAPL", amountPerShare: -1, shares: 10, payDate: "2025-01-01" });

        expect(response.status).toBe(422);
    });

    it("creates a dividend scoped to the caller", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        dividendService.addDividend.mockResolvedValue({ _id: "d1", ticker: "AAPL" });

        const response = await request(app)
            .post("/api/dividends")
            .set("Authorization", "Bearer good-token")
            .send({ ticker: "aapl", amountPerShare: 1, shares: 10, payDate: "2025-01-01" });

        expect(response.status).toBe(201);
        expect(dividendService.addDividend).toHaveBeenCalledWith("user1", expect.objectContaining({ ticker: "AAPL" }));
    });
});

describe("user isolation", () => {
    it("scopes GET / to the caller's own userId", async () => {
        identityService.resolveUserIdByToken.mockImplementation(async (token) => (token === "token-a" ? "userA" : "userB"));
        dividendService.getDividends.mockResolvedValue([]);

        await request(app).get("/api/dividends").set("Authorization", "Bearer token-a");
        await request(app).get("/api/dividends").set("Authorization", "Bearer token-b");

        expect(dividendService.getDividends).toHaveBeenNthCalledWith(1, "userA", expect.any(Object));
        expect(dividendService.getDividends).toHaveBeenNthCalledWith(2, "userB", expect.any(Object));
    });

    it("returns 404 when userB tries to delete userA's dividend", async () => {
        identityService.resolveUserIdByToken.mockResolvedValue("userB");
        dividendService.deleteDividend.mockRejectedValue(new dividendService.DividendNotFoundError());

        const response = await request(app).delete(`/api/dividends/${VALID_ID}`).set("Authorization", "Bearer token-b");

        expect(response.status).toBe(404);
    });
});

describe("malformed ids", () => {
    beforeEach(() => identityService.resolveUserIdByToken.mockResolvedValue("user1"));

    it("returns 400 for a malformed dividend id on PUT/DELETE", async () => {
        const putResponse = await request(app)
            .put("/api/dividends/not-an-id")
            .set("Authorization", "Bearer good-token")
            .send({ amountPerShare: 1, shares: 10, payDate: "2025-01-01" });
        const deleteResponse = await request(app).delete("/api/dividends/not-an-id").set("Authorization", "Bearer good-token");

        expect(putResponse.status).toBe(400);
        expect(deleteResponse.status).toBe(400);
        expect(dividendService.updateDividend).not.toHaveBeenCalled();
        expect(dividendService.deleteDividend).not.toHaveBeenCalled();
    });
});
