const mockSave = jest.fn();

jest.mock("../watchlist.model", () => {
    const MockWatchlist = jest.fn().mockImplementation(function (doc) {
        Object.assign(this, doc);
        this.save = mockSave;
    });
    MockWatchlist.findOne = jest.fn();
    return MockWatchlist;
});
jest.mock("../../models/company.model", () => ({ findOne: jest.fn() }));
jest.mock("../../market/market.service", () => ({
    getCurrentMarketData: jest.fn(),
    getPerformance: jest.fn(),
}));
jest.mock("../../analysis/analysis.service", () => ({ calculateAnalysis: jest.fn() }));
jest.mock("../../valuation/valuation.service", () => ({
    getDCFDefaults: jest.fn(),
    calculateDCFValuation: jest.fn(),
}));
jest.mock("../../news/news.service", () => ({ getLatestStoredArticle: jest.fn() }));

const Watchlist = require("../watchlist.model");
const Company = require("../../models/company.model");
const marketService = require("../../market/market.service");
const analysisService = require("../../analysis/analysis.service");
const valuationService = require("../../valuation/valuation.service");
const newsService = require("../../news/news.service");
const watchlistService = require("../watchlist.service");

beforeEach(() => {
    mockSave.mockReset().mockResolvedValue(undefined);
    newsService.getLatestStoredArticle.mockResolvedValue(null);
});

afterEach(() => {
    jest.clearAllMocks();
});

describe("addCompany", () => {
    it("creates a new watchlist and adds the ticker when the user has none yet", async () => {
        Watchlist.findOne.mockResolvedValue(null);

        const watchlist = await watchlistService.addCompany("user1", "aapl");

        // Watchlist mock's `.companies` array is the same reference passed to the
        // constructor, so it reflects post-push state - assert on final state, not
        // the constructor call snapshot.
        expect(Watchlist.mock.calls[0][0].userId).toBe("user1");
        expect(watchlist.companies).toEqual([expect.objectContaining({ ticker: "AAPL" })]);
        expect(mockSave).toHaveBeenCalledTimes(1);
    });

    it("appends to an existing watchlist", async () => {
        Watchlist.findOne.mockResolvedValue({
            userId: "user1",
            companies: [{ ticker: "MSFT", addedAt: new Date() }],
            save: mockSave,
        });

        const watchlist = await watchlistService.addCompany("user1", "AAPL");

        expect(watchlist.companies.map((c) => c.ticker)).toEqual(["MSFT", "AAPL"]);
    });

    it("throws DuplicateCompanyError when the ticker is already present, without saving", async () => {
        Watchlist.findOne.mockResolvedValue({
            userId: "user1",
            companies: [{ ticker: "AAPL", addedAt: new Date() }],
            save: mockSave,
        });

        await expect(watchlistService.addCompany("user1", "aapl")).rejects.toThrow(
            watchlistService.DuplicateCompanyError
        );
        expect(mockSave).not.toHaveBeenCalled();
    });
});

describe("removeCompany", () => {
    it("throws CompanyNotInWatchlistError when the user has no watchlist", async () => {
        Watchlist.findOne.mockResolvedValue(null);

        await expect(watchlistService.removeCompany("user1", "AAPL")).rejects.toThrow(
            watchlistService.CompanyNotInWatchlistError
        );
    });

    it("throws CompanyNotInWatchlistError when the ticker isn't in the watchlist", async () => {
        Watchlist.findOne.mockResolvedValue({ companies: [{ ticker: "MSFT" }], save: mockSave });

        await expect(watchlistService.removeCompany("user1", "AAPL")).rejects.toThrow(
            watchlistService.CompanyNotInWatchlistError
        );
    });

    it("removes the matching ticker and saves", async () => {
        const doc = { companies: [{ ticker: "AAPL" }, { ticker: "MSFT" }], save: mockSave };
        Watchlist.findOne.mockResolvedValue(doc);

        const result = await watchlistService.removeCompany("user1", "aapl");

        expect(result.companies.map((c) => c.ticker)).toEqual(["MSFT"]);
        expect(mockSave).toHaveBeenCalledTimes(1);
    });
});

describe("getWatchlistWithMetrics", () => {
    it("returns an empty companies array when the user has no watchlist yet", async () => {
        Watchlist.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

        const result = await watchlistService.getWatchlistWithMetrics("user1");

        expect(result).toEqual({ name: "My Watchlist", companies: [] });
    });

    it("degrades a row gracefully when market/analysis/DCF data is unavailable", async () => {
        Watchlist.findOne.mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                name: "My Watchlist",
                companies: [{ ticker: "ZZZZ", addedAt: new Date("2026-01-01") }],
            }),
        });
        Company.findOne.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) });
        marketService.getCurrentMarketData.mockRejectedValue(new Error("not found"));
        marketService.getPerformance.mockRejectedValue(new Error("not found"));
        analysisService.calculateAnalysis.mockResolvedValue({ error: "no data", status: 404 });
        valuationService.getDCFDefaults.mockRejectedValue(new Error("no data"));

        const result = await watchlistService.getWatchlistWithMetrics("user1");

        expect(result.companies).toHaveLength(1);
        const row = result.companies[0];
        expect(row.ticker).toBe("ZZZZ");
        expect(row.price.current).toBeNull();
        expect(row.financialHealthScore).toBeNull();
        expect(row.dcf.available).toBe(false);
        expect(row.latestEvent).toBeNull();
    });

    it("assembles a full row when every data source succeeds", async () => {
        Watchlist.findOne.mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                name: "My Watchlist",
                companies: [{ ticker: "AAPL", addedAt: new Date("2026-01-01") }],
            }),
        });
        Company.findOne.mockReturnValue({
            select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ name: "Apple Inc.", exchange: "NASDAQ" }) }),
        });
        marketService.getCurrentMarketData.mockResolvedValue({
            price: { current: 210, previousClose: 200, marketCap: 3_000_000_000_000 },
            valuation: { peRatio: 30 },
            asOf: "2026-08-13T00:00:00.000Z",
        });
        marketService.getPerformance.mockResolvedValue({ "1Y": 15.2 });
        analysisService.calculateAnalysis.mockResolvedValue({
            healthScore: { overall: 88 },
            growth: { revenueCAGR: 12.4 },
            period: { endYear: 2025 },
        });
        valuationService.getDCFDefaults.mockResolvedValue({
            suggestedAssumptions: {
                revenueGrowth: { value: 0.1 },
                ebitMargin: { value: 0.3 },
                taxRate: { value: 0.21 },
                depreciationPercentRevenue: { value: 0.03 },
                capexPercentRevenue: { value: 0.04 },
                workingCapitalPercentRevenue: { value: 0.01 },
                terminalGrowthRate: { value: 0.025 },
                forecastYears: { value: 5 },
            },
            waccInputs: {
                riskFreeRate: { value: 0.04 },
                beta: { value: 1.2 },
                equityRiskPremium: { value: 0.05 },
            },
        });
        valuationService.calculateDCFValuation.mockResolvedValue({
            isValid: true,
            intrinsicValuePerShare: 230,
            upsideDownsidePercent: 9.5,
            calculatedAt: "2026-08-13T00:00:00.000Z",
        });
        newsService.getLatestStoredArticle.mockResolvedValue({
            title: "Apple reports quarterly earnings",
            category: "Earnings",
            publishedAt: "2026-08-12T00:00:00.000Z",
            url: "https://example.com/apple-earnings",
        });

        const result = await watchlistService.getWatchlistWithMetrics("user1");
        const row = result.companies[0];

        expect(row.name).toBe("Apple Inc.");
        expect(row.price.current).toBe(210);
        expect(row.price.dailyChangePercent).toBeCloseTo(5);
        expect(row.peRatio).toBe(30);
        expect(row.oneYearReturnPercent).toBe(15.2);
        expect(row.financialHealthScore).toBe(88);
        expect(row.revenueCAGRPercent).toBe(12.4);
        expect(row.dcf.available).toBe(true);
        expect(row.dcf.intrinsicValuePerShare).toBe(230);
        expect(row.dcf.valuationGapPercent).toBe(9.5);
        expect(row.latestEvent).toEqual({
            title: "Apple reports quarterly earnings",
            category: "Earnings",
            publishedAt: "2026-08-12T00:00:00.000Z",
            url: "https://example.com/apple-earnings",
        });
    });
});
