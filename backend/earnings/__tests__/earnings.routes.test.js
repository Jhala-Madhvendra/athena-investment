const express = require("express");
const request = require("supertest");

jest.mock("../earnings.service", () => ({
    getEarningsIntelligence: jest.fn(),
    NoFinancialStatementsError: class NoFinancialStatementsError extends Error {
        constructor(ticker) {
            super(`No financial statements are available for ${ticker}.`);
            this.statusCode = 404;
        }
    },
}));
jest.mock("../earnings.aiService", () => ({
    getPersistedSummary: jest.fn(),
    getOrGenerateSummary: jest.fn(),
}));
jest.mock("../../services/company.service", () => ({ resolveTicker: jest.fn() }));
jest.mock("../../identity/identity.service", () => ({ resolveUserIdByToken: jest.fn() }));

const earningsService = require("../earnings.service");
const earningsAiService = require("../earnings.aiService");
const companyService = require("../../services/company.service");
const identityService = require("../../identity/identity.service");
const earningsRoutes = require("../earnings.routes");

const app = express();
app.use(express.json());
app.use("/api/earnings", earningsRoutes);

afterEach(() => {
    jest.clearAllMocks();
});

describe("GET /api/earnings/:ticker", () => {
    it("returns 404 when the ticker cannot be resolved to a company", async () => {
        companyService.resolveTicker.mockResolvedValue(null);

        const response = await request(app).get("/api/earnings/ZZZZ");

        expect(response.status).toBe(404);
        expect(earningsService.getEarningsIntelligence).not.toHaveBeenCalled();
    });

    it("returns the earnings payload for a resolved ticker", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        earningsService.getEarningsIntelligence.mockResolvedValue({ ticker: "AAPL", period: { latestPeriod: "FY2026" } });

        const response = await request(app).get("/api/earnings/aapl");

        expect(response.status).toBe(200);
        expect(response.body.ticker).toBe("AAPL");
        expect(earningsService.getEarningsIntelligence).toHaveBeenCalledWith("AAPL");
    });

    it("propagates a service-level 404 (no statements imported) as-is", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        earningsService.getEarningsIntelligence.mockRejectedValue(new earningsService.NoFinancialStatementsError("AAPL"));

        const response = await request(app).get("/api/earnings/AAPL");

        expect(response.status).toBe(404);
    });

    it("returns 500 for an unexpected service error, matching ratio.controller.js's own sendServiceError fallback", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        earningsService.getEarningsIntelligence.mockRejectedValue(new Error("boom"));

        const response = await request(app).get("/api/earnings/AAPL");

        expect(response.status).toBe(500);
    });
});

describe("GET /api/earnings/:ticker/summary", () => {
    it("returns null (no Authorization header required) when no summary has been generated yet", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        earningsAiService.getPersistedSummary.mockResolvedValue(null);

        const response = await request(app).get("/api/earnings/AAPL/summary");

        expect(response.status).toBe(200);
        expect(response.body).toBeNull();
        expect(earningsAiService.getOrGenerateSummary).not.toHaveBeenCalled();
    });

    it("returns the persisted summary when one exists", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        earningsAiService.getPersistedSummary.mockResolvedValue({ ticker: "AAPL", narrative: "ok" });

        const response = await request(app).get("/api/earnings/aapl/summary");

        expect(response.status).toBe(200);
        expect(response.body.narrative).toBe("ok");
    });
});

describe("POST /api/earnings/:ticker/summary", () => {
    it("rejects a request with no Authorization header", async () => {
        const response = await request(app).post("/api/earnings/AAPL/summary").send({});

        expect(response.status).toBe(401);
        expect(earningsAiService.getOrGenerateSummary).not.toHaveBeenCalled();
    });

    it("generates and returns a summary, scoped to the caller's own userId", async () => {
        identityService.resolveUserIdByToken.mockResolvedValue("user1");
        companyService.resolveTicker.mockResolvedValue("AAPL");
        earningsAiService.getOrGenerateSummary.mockResolvedValue({ ticker: "AAPL", narrative: "ok" });

        const response = await request(app)
            .post("/api/earnings/aapl/summary")
            .set("Authorization", "Bearer token-a")
            .send({});

        expect(response.status).toBe(200);
        expect(response.body.narrative).toBe("ok");
        expect(earningsAiService.getOrGenerateSummary).toHaveBeenCalledWith("AAPL", { regenerate: false, userId: "user1" });
    });

    it("passes regenerate:true through to the service", async () => {
        identityService.resolveUserIdByToken.mockResolvedValue("user1");
        companyService.resolveTicker.mockResolvedValue("AAPL");
        earningsAiService.getOrGenerateSummary.mockResolvedValue({ ticker: "AAPL", narrative: "ok" });

        await request(app).post("/api/earnings/AAPL/summary").set("Authorization", "Bearer token-a").send({ regenerate: true });

        expect(earningsAiService.getOrGenerateSummary).toHaveBeenCalledWith("AAPL", { regenerate: true, userId: "user1" });
    });

    it("maps QuotaExceededError's statusCode (429) through sendServiceError", async () => {
        identityService.resolveUserIdByToken.mockResolvedValue("user1");
        companyService.resolveTicker.mockResolvedValue("AAPL");
        const error = new Error("You've reached your free AI report limit for this month (5).");
        error.statusCode = 429;
        earningsAiService.getOrGenerateSummary.mockRejectedValue(error);

        const response = await request(app)
            .post("/api/earnings/AAPL/summary")
            .set("Authorization", "Bearer token-a")
            .send({});

        expect(response.status).toBe(429);
    });
});
