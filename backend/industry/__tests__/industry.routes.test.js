const express = require("express");
const request = require("supertest");

jest.mock("../industry.service", () => ({
    getIndustryIntelligence: jest.fn(),
    getPeerSuggestions: jest.fn(),
    getSupportedMetrics: jest.fn(),
    invalidateUniverseCache: jest.fn(),
    NoFinancialDataError: class NoFinancialDataError extends Error {
        constructor(ticker) {
            super(`No financial statements are available for ${ticker}.`);
            this.statusCode = 404;
        }
    },
}));
jest.mock("../../services/company.service", () => ({ resolveTicker: jest.fn() }));
jest.mock("../industry.discovery", () => ({
    discoverCandidates: jest.fn(),
    importSelectedCompanies: jest.fn(),
    DISCOVERY_LIMIT: 20,
}));

const industryService = require("../industry.service");
const industryDiscovery = require("../industry.discovery");
const companyService = require("../../services/company.service");
const industryRoutes = require("../industry.routes");

const app = express();
app.use(express.json());
app.use("/api/industry", industryRoutes);

afterEach(() => {
    jest.clearAllMocks();
});

describe("GET /api/industry/:ticker", () => {
    it("returns 404 when the ticker cannot be resolved to a company", async () => {
        companyService.resolveTicker.mockResolvedValue(null);

        const response = await request(app).get("/api/industry/ZZZZ");

        expect(response.status).toBe(404);
        expect(industryService.getIndustryIntelligence).not.toHaveBeenCalled();
    });

    it("returns a formatted industry payload for a resolved ticker", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        industryService.getIndustryIntelligence.mockResolvedValue({
            ticker: "AAPL",
            company: "Apple Inc.",
            sector: "Technology",
            industry: "Software",
            universe: { level: "industry", key: "Software", size: 4, note: "note" },
            benchmarks: [],
            dataFreshness: { financialPeriod: 2025, marketDataAsOf: null },
        });

        const response = await request(app).get("/api/industry/aapl");

        expect(response.status).toBe(200);
        expect(response.body.ticker).toBe("AAPL");
        expect(response.body).toHaveProperty("strengths");
        expect(response.body).toHaveProperty("weaknesses");
        expect(industryService.getIndustryIntelligence).toHaveBeenCalledWith("AAPL");
    });

    it("propagates a service-level 404 (no financial statements imported) as-is", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        industryService.getIndustryIntelligence.mockRejectedValue(new industryService.NoFinancialDataError("AAPL"));

        const response = await request(app).get("/api/industry/AAPL");

        expect(response.status).toBe(404);
    });
});

describe("GET /api/industry/:ticker/peers", () => {
    it("rejects an out-of-range limit before calling the service", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");

        const response = await request(app).get("/api/industry/AAPL/peers?limit=999");

        expect(response.status).toBe(422);
        expect(industryService.getPeerSuggestions).not.toHaveBeenCalled();
    });

    it("passes a valid limit through to the service", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        industryService.getPeerSuggestions.mockResolvedValue({
            target: { ticker: "AAPL" },
            universe: { level: "industry", key: "Software", size: 4, note: "note" },
            suggestedPeers: [],
        });

        const response = await request(app).get("/api/industry/AAPL/peers?limit=3");

        expect(response.status).toBe(200);
        expect(industryService.getPeerSuggestions).toHaveBeenCalledWith("AAPL", 3);
        expect(response.body.limitation).toMatch(/not.*canonical peer set/i);
    });
});

describe("GET /api/industry/:ticker/discover", () => {
    it("returns 404 when the ticker cannot be resolved to a company", async () => {
        companyService.resolveTicker.mockResolvedValue(null);

        const response = await request(app).get("/api/industry/ZZZZ/discover");

        expect(response.status).toBe(404);
        expect(industryDiscovery.discoverCandidates).not.toHaveBeenCalled();
    });

    it("returns discovered candidates for a resolved ticker", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        industryDiscovery.discoverCandidates.mockResolvedValue({
            classificationLevel: "industry",
            classificationValue: "Consumer Electronics",
            candidates: [{ ticker: "SONY", name: "Sony Group Corporation", exchange: "TYO", marketCap: 1000 }],
        });

        const response = await request(app).get("/api/industry/AAPL/discover");

        expect(response.status).toBe(200);
        expect(response.body.classificationValue).toBe("Consumer Electronics");
        expect(response.body.candidates).toHaveLength(1);
    });

    it("propagates a service-level error (e.g. no classification available) with its status code", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        const error = new Error("AAPL has no sector or industry classification.");
        error.statusCode = 422;
        industryDiscovery.discoverCandidates.mockRejectedValue(error);

        const response = await request(app).get("/api/industry/AAPL/discover");

        expect(response.status).toBe(422);
    });
});

describe("POST /api/industry/:ticker/discover/import", () => {
    it("rejects an empty tickers array before calling the service", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");

        const response = await request(app).post("/api/industry/AAPL/discover/import").send({ tickers: [] });

        expect(response.status).toBe(422);
        expect(industryDiscovery.importSelectedCompanies).not.toHaveBeenCalled();
    });

    it("imports the selected tickers, invalidates the benchmark cache, and returns a bucketed result", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        industryDiscovery.importSelectedCompanies.mockResolvedValue([
            { ticker: "SONY", companyImported: true, financialsImported: true, error: null },
            { ticker: "ZZZZ", companyImported: false, financialsImported: false, error: "Company could not be found." },
        ]);

        const response = await request(app).post("/api/industry/AAPL/discover/import").send({ tickers: ["sony", "zzzz"] });

        expect(response.status).toBe(200);
        expect(industryDiscovery.importSelectedCompanies).toHaveBeenCalledWith(["SONY", "ZZZZ"]);
        expect(industryService.invalidateUniverseCache).toHaveBeenCalledTimes(1);
        expect(response.body.imported).toEqual(["SONY"]);
        expect(response.body.failed.map((r) => r.ticker)).toEqual(["ZZZZ"]);
    });

    it("does not invalidate the cache when validation fails", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");

        await request(app).post("/api/industry/AAPL/discover/import").send({ tickers: ["not a ticker!"] });

        expect(industryService.invalidateUniverseCache).not.toHaveBeenCalled();
    });
});

describe("GET /api/industry/:ticker/metrics", () => {
    it("returns the supported metric catalog", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        industryService.getSupportedMetrics.mockResolvedValue({ ticker: "AAPL", metrics: { pe: { label: "P/E", unit: "multiple", category: "valuation", type: "market" } } });

        const response = await request(app).get("/api/industry/AAPL/metrics");

        expect(response.status).toBe(200);
        expect(response.body.metrics).toEqual([{ metric: "pe", label: "P/E", unit: "multiple", category: "valuation", type: "market" }]);
    });
});
