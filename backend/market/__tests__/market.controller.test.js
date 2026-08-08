const express = require("express");
const request = require("supertest");

jest.mock("../market.service", () => ({
    getCurrentMarketData: jest.fn(),
    getHistoricalPrices: jest.fn(),
    getPerformance: jest.fn(),
    SUPPORTED_PERIODS: ["1m", "3m", "6m", "1y", "5y"],
}));
jest.mock("../../services/company.service", () => ({ resolveTicker: jest.fn() }));

const marketService = require("../market.service");
const companyService = require("../../services/company.service");
const marketRoutes = require("../market.routes");

const app = express();
app.use("/api/market", marketRoutes);

afterEach(() => {
    jest.clearAllMocks();
});

describe("GET /api/market/:ticker", () => {
    it("returns 404 when the ticker cannot be resolved to a company", async () => {
        companyService.resolveTicker.mockResolvedValue(null);

        const response = await request(app).get("/api/market/ZZZZ");

        expect(response.status).toBe(404);
        expect(marketService.getCurrentMarketData).not.toHaveBeenCalled();
    });

    it("returns the market snapshot for a resolved ticker", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        marketService.getCurrentMarketData.mockResolvedValue({
            ticker: "AAPL",
            price: { current: 190.5 },
        });

        const response = await request(app).get("/api/market/aapl");

        expect(response.status).toBe(200);
        expect(response.body.price.current).toBe(190.5);
        expect(marketService.getCurrentMarketData).toHaveBeenCalledWith("AAPL");
    });

    it("returns 502 when the market data provider fails", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        marketService.getCurrentMarketData.mockRejectedValue(new Error("Yahoo Finance request failed."));

        const response = await request(app).get("/api/market/AAPL");

        expect(response.status).toBe(502);
    });

    it("propagates a service error's own statusCode instead of the fallback", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        const notFound = new Error("Company AAPL was not found.");
        notFound.statusCode = 404;
        marketService.getCurrentMarketData.mockRejectedValue(notFound);

        const response = await request(app).get("/api/market/AAPL");

        expect(response.status).toBe(404);
    });
});

describe("GET /api/market/:ticker/history", () => {
    it("rejects an invalid period without calling the service", async () => {
        const response = await request(app).get("/api/market/AAPL/history?period=bogus");

        expect(response.status).toBe(400);
        expect(marketService.getHistoricalPrices).not.toHaveBeenCalled();
    });

    it("defaults to the 1y period when none is supplied", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        marketService.getHistoricalPrices.mockResolvedValue([{ date: "2026-01-01", close: 100 }]);

        const response = await request(app).get("/api/market/AAPL/history");

        expect(response.status).toBe(200);
        expect(response.body.period).toBe("1y");
        expect(marketService.getHistoricalPrices).toHaveBeenCalledWith("AAPL", "1y");
    });

    it("passes through a valid explicit period", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        marketService.getHistoricalPrices.mockResolvedValue([]);

        const response = await request(app).get("/api/market/AAPL/history?period=5y");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ ticker: "AAPL", period: "5y", data: [] });
    });
});

describe("GET /api/market/:ticker/performance", () => {
    it("rejects an invalid period", async () => {
        const response = await request(app).get("/api/market/AAPL/performance?period=bogus");

        expect(response.status).toBe(400);
        expect(marketService.getPerformance).not.toHaveBeenCalled();
    });

    it("computes all periods when none is specified", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        marketService.getPerformance.mockResolvedValue({ "1M": 5.2, "3M": 11.4, "6M": -2.1, "1Y": 18.7, "5Y": 94.3 });

        const response = await request(app).get("/api/market/AAPL/performance");

        expect(response.status).toBe(200);
        expect(marketService.getPerformance).toHaveBeenCalledWith("AAPL", undefined);
        expect(response.body.performance["1Y"]).toBe(18.7);
    });

    it("computes a single requested period", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        marketService.getPerformance.mockResolvedValue({ "6M": -2.1 });

        const response = await request(app).get("/api/market/AAPL/performance?period=6m");

        expect(marketService.getPerformance).toHaveBeenCalledWith("AAPL", "6m");
        expect(response.body.performance["6M"]).toBe(-2.1);
    });
});
