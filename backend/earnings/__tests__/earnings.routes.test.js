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
jest.mock("../../services/company.service", () => ({ resolveTicker: jest.fn() }));

const earningsService = require("../earnings.service");
const companyService = require("../../services/company.service");
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
