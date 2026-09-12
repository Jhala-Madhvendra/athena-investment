const express = require("express");
const request = require("supertest");

jest.mock("../ai.service", () => ({
    getOrGenerateReport: jest.fn(),
    getPersistedReport: jest.fn(),
}));
jest.mock("../aiQuota.service", () => ({ getUsage: jest.fn() }));
jest.mock("../../services/company.service", () => ({ resolveTicker: jest.fn() }));
jest.mock("../../identity/identity.service", () => ({ resolveUserIdByToken: jest.fn() }));

const aiService = require("../ai.service");
const aiQuotaService = require("../aiQuota.service");
const companyService = require("../../services/company.service");
const identityService = require("../../identity/identity.service");
const aiRoutes = require("../ai.routes");

const app = express();
app.use(express.json());
app.use("/api/ai", aiRoutes);

afterEach(() => {
    jest.clearAllMocks();
});

describe("POST /api/ai/:ticker/research-report", () => {
    it("rejects a request with no Authorization header", async () => {
        const response = await request(app).post("/api/ai/AAPL/research-report").send({});

        expect(response.status).toBe(401);
        expect(aiService.getOrGenerateReport).not.toHaveBeenCalled();
    });

    it("returns 404 when the ticker cannot be resolved to a company", async () => {
        identityService.resolveUserIdByToken.mockResolvedValue("user1");
        companyService.resolveTicker.mockResolvedValue(null);

        const response = await request(app)
            .post("/api/ai/ZZZZ/research-report")
            .set("Authorization", "Bearer token-a")
            .send({});

        expect(response.status).toBe(404);
        expect(aiService.getOrGenerateReport).not.toHaveBeenCalled();
    });

    it("generates and returns a report for a resolved ticker, scoped to the caller's own userId", async () => {
        identityService.resolveUserIdByToken.mockResolvedValue("user1");
        companyService.resolveTicker.mockResolvedValue("AAPL");
        aiService.getOrGenerateReport.mockResolvedValue({ ticker: "AAPL", report: { executiveSummary: "ok" } });

        const response = await request(app)
            .post("/api/ai/aapl/research-report")
            .set("Authorization", "Bearer token-a")
            .send({});

        expect(response.status).toBe(200);
        expect(response.body.ticker).toBe("AAPL");
        expect(aiService.getOrGenerateReport).toHaveBeenCalledWith("AAPL", {
            regenerate: false,
            preTaxCostOfDebt: undefined,
            userId: "user1",
        });
    });

    it("passes regenerate and preTaxCostOfDebt through to the service", async () => {
        identityService.resolveUserIdByToken.mockResolvedValue("user1");
        companyService.resolveTicker.mockResolvedValue("AAPL");
        aiService.getOrGenerateReport.mockResolvedValue({ ticker: "AAPL" });

        await request(app)
            .post("/api/ai/AAPL/research-report")
            .set("Authorization", "Bearer token-a")
            .send({ regenerate: true, preTaxCostOfDebt: 0.045 });

        expect(aiService.getOrGenerateReport).toHaveBeenCalledWith("AAPL", {
            regenerate: true,
            preTaxCostOfDebt: 0.045,
            userId: "user1",
        });
    });

    it("rejects an invalid body without calling the service", async () => {
        identityService.resolveUserIdByToken.mockResolvedValue("user1");

        const response = await request(app)
            .post("/api/ai/AAPL/research-report")
            .set("Authorization", "Bearer token-a")
            .send({ preTaxCostOfDebt: 5 });

        expect(response.status).toBe(400);
        expect(response.body.errors.length).toBeGreaterThan(0);
        expect(companyService.resolveTicker).not.toHaveBeenCalled();
        expect(aiService.getOrGenerateReport).not.toHaveBeenCalled();
    });

    it("maps InsufficientContextError's statusCode (404) through sendServiceError", async () => {
        identityService.resolveUserIdByToken.mockResolvedValue("user1");
        companyService.resolveTicker.mockResolvedValue("ZZZZ");
        const error = new Error("No financial data is available for ZZZZ.");
        error.statusCode = 404;
        aiService.getOrGenerateReport.mockRejectedValue(error);

        const response = await request(app)
            .post("/api/ai/ZZZZ/research-report")
            .set("Authorization", "Bearer token-a")
            .send({});

        expect(response.status).toBe(404);
    });

    it("maps QuotaExceededError's statusCode (429) through sendServiceError", async () => {
        identityService.resolveUserIdByToken.mockResolvedValue("user1");
        companyService.resolveTicker.mockResolvedValue("AAPL");
        const error = new Error("You've reached your free AI report limit for this month (5).");
        error.statusCode = 429;
        aiService.getOrGenerateReport.mockRejectedValue(error);

        const response = await request(app)
            .post("/api/ai/AAPL/research-report")
            .set("Authorization", "Bearer token-a")
            .send({});

        expect(response.status).toBe(429);
    });

    it("falls back to 502 for an error with no explicit statusCode", async () => {
        identityService.resolveUserIdByToken.mockResolvedValue("user1");
        companyService.resolveTicker.mockResolvedValue("AAPL");
        aiService.getOrGenerateReport.mockRejectedValue(new Error("unexpected"));

        const response = await request(app)
            .post("/api/ai/AAPL/research-report")
            .set("Authorization", "Bearer token-a")
            .send({});

        expect(response.status).toBe(502);
    });
});

describe("GET /api/ai/:ticker/research-report", () => {
    it("returns 404 when the ticker cannot be resolved", async () => {
        companyService.resolveTicker.mockResolvedValue(null);

        const response = await request(app).get("/api/ai/ZZZZ/research-report");

        expect(response.status).toBe(404);
        expect(aiService.getPersistedReport).not.toHaveBeenCalled();
    });

    it("returns 404 when no report has been generated yet, without calling the LLM path", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        aiService.getPersistedReport.mockResolvedValue(null);

        const response = await request(app).get("/api/ai/AAPL/research-report");

        expect(response.status).toBe(404);
        expect(aiService.getOrGenerateReport).not.toHaveBeenCalled();
    });

    it("returns the persisted report when one exists, with no Authorization header required", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        aiService.getPersistedReport.mockResolvedValue({ ticker: "AAPL", report: { executiveSummary: "ok" } });

        const response = await request(app).get("/api/ai/aapl/research-report");

        expect(response.status).toBe(200);
        expect(response.body.report.executiveSummary).toBe("ok");
        expect(aiService.getPersistedReport).toHaveBeenCalledWith("AAPL");
    });
});

describe("GET /api/ai/usage", () => {
    it("rejects a request with no Authorization header", async () => {
        const response = await request(app).get("/api/ai/usage");
        expect(response.status).toBe(401);
    });

    it("returns the caller's own usage", async () => {
        identityService.resolveUserIdByToken.mockResolvedValue("user1");
        aiQuotaService.getUsage.mockResolvedValue({ used: 2, limit: 5, remaining: 3, periodKey: "2026-08" });

        const response = await request(app).get("/api/ai/usage").set("Authorization", "Bearer token-a");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ used: 2, limit: 5, remaining: 3, periodKey: "2026-08" });
        expect(aiQuotaService.getUsage).toHaveBeenCalledWith("user1");
    });
});
