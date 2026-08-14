jest.mock("../watchlistSnapshot.model", () => ({ findOne: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock("../watchlist.service", () => ({ getWatchlistWithMetrics: jest.fn() }));

const WatchlistSnapshot = require("../watchlistSnapshot.model");
const watchlistService = require("../watchlist.service");
const insightsService = require("../watchlistInsights.service");

afterEach(() => {
    jest.clearAllMocks();
});

describe("hasMeaningfullyChanged", () => {
    it("never flags a change when either side is missing", () => {
        expect(insightsService.hasMeaningfullyChanged("healthScore", null, 90)).toBe(false);
        expect(insightsService.hasMeaningfullyChanged("healthScore", 80, null)).toBe(false);
        expect(insightsService.hasMeaningfullyChanged("healthScore", undefined, 90)).toBe(false);
    });

    it("flags an absolute-threshold metric only past its minimum change", () => {
        expect(insightsService.hasMeaningfullyChanged("healthScore", 82, 82)).toBe(false);
        expect(insightsService.hasMeaningfullyChanged("healthScore", 82, 82.5)).toBe(false);
        expect(insightsService.hasMeaningfullyChanged("healthScore", 82, 89)).toBe(true);
    });

    it("flags a percent-threshold metric only past its minimum percent change", () => {
        expect(insightsService.hasMeaningfullyChanged("stockPrice", 100, 100.5)).toBe(false); // 0.5%
        expect(insightsService.hasMeaningfullyChanged("stockPrice", 100, 102)).toBe(true); // 2%
    });

    it("guards against dividing by a zero previous value on a percent metric", () => {
        expect(insightsService.hasMeaningfullyChanged("peRatio", 0, 0)).toBe(false);
        expect(insightsService.hasMeaningfullyChanged("peRatio", 0, 5)).toBe(true);
    });
});

describe("extractTrackedMetrics", () => {
    it("pulls the five tracked metrics from a watchlist row", () => {
        const row = {
            price: { current: 200 },
            financialHealthScore: 88,
            peRatio: 30,
            revenueCAGRPercent: 12.4,
            dcf: { available: true, valuationGapPercent: -10 },
        };

        expect(insightsService.extractTrackedMetrics(row)).toEqual({
            stockPrice: 200,
            healthScore: 88,
            peRatio: 30,
            revenueCAGR: 12.4,
            dcfValuationGapPercent: -10,
        });
    });

    it("reports dcfValuationGapPercent as null when the DCF is unavailable", () => {
        const row = { price: {}, dcf: { available: false } };
        expect(insightsService.extractTrackedMetrics(row).dcfValuationGapPercent).toBeNull();
    });
});

describe("getInsights", () => {
    const rowFor = (ticker, overrides = {}) => ({
        ticker,
        name: `${ticker} Inc.`,
        price: { current: 100 },
        financialHealthScore: 80,
        peRatio: 20,
        revenueCAGRPercent: 10,
        dcf: { available: true, valuationGapPercent: 5 },
        ...overrides,
    });

    it("establishes a baseline (no changes reported) on the first view of a ticker", async () => {
        watchlistService.getWatchlistWithMetrics.mockResolvedValue({ companies: [rowFor("AAPL")] });
        WatchlistSnapshot.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
        WatchlistSnapshot.findOneAndUpdate.mockResolvedValue({});

        const result = await insightsService.getInsights("user1");

        expect(result.insights).toHaveLength(1);
        expect(result.insights[0]).toMatchObject({ ticker: "AAPL", status: "baseline_established", changes: [] });
        expect(WatchlistSnapshot.findOneAndUpdate).toHaveBeenCalledWith(
            { userId: "user1", ticker: "AAPL" },
            expect.objectContaining({ metrics: expect.any(Object) }),
            { upsert: true }
        );
    });

    it("reports no changes when nothing moved past the thresholds", async () => {
        watchlistService.getWatchlistWithMetrics.mockResolvedValue({ companies: [rowFor("AAPL")] });
        WatchlistSnapshot.findOne.mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                metrics: { stockPrice: 100, healthScore: 80, peRatio: 20, revenueCAGR: 10, dcfValuationGapPercent: 5 },
            }),
        });
        WatchlistSnapshot.findOneAndUpdate.mockResolvedValue({});

        const result = await insightsService.getInsights("user1");

        expect(result.insights[0].status).toBe("compared");
        expect(result.insights[0].changes).toEqual([]);
    });

    it("reports an increased metric with human-readable text", async () => {
        watchlistService.getWatchlistWithMetrics.mockResolvedValue({
            companies: [rowFor("AAPL", { financialHealthScore: 89 })],
        });
        WatchlistSnapshot.findOne.mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                metrics: { stockPrice: 100, healthScore: 82, peRatio: 20, revenueCAGR: 10, dcfValuationGapPercent: 5 },
            }),
        });
        WatchlistSnapshot.findOneAndUpdate.mockResolvedValue({});

        const result = await insightsService.getInsights("user1");
        const change = result.insights[0].changes.find((c) => c.metric === "healthScore");

        expect(change).toBeDefined();
        expect(change.previous).toBe(82);
        expect(change.current).toBe(89);
        expect(change.text).toBe("Financial Health Score changed from 82 to 89.");
    });

    it("reports a decreased metric", async () => {
        watchlistService.getWatchlistWithMetrics.mockResolvedValue({
            companies: [rowFor("AAPL", { revenueCAGRPercent: 4 })],
        });
        WatchlistSnapshot.findOne.mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                metrics: { stockPrice: 100, healthScore: 80, peRatio: 20, revenueCAGR: 18, dcfValuationGapPercent: 5 },
            }),
        });
        WatchlistSnapshot.findOneAndUpdate.mockResolvedValue({});

        const result = await insightsService.getInsights("user1");
        const change = result.insights[0].changes.find((c) => c.metric === "revenueCAGR");

        expect(change.text).toContain("slowed");
        expect(change.text).toContain("18.0%");
        expect(change.text).toContain("4.0%");
    });

    it("always overwrites the snapshot with current values regardless of whether anything changed", async () => {
        watchlistService.getWatchlistWithMetrics.mockResolvedValue({ companies: [rowFor("AAPL")] });
        WatchlistSnapshot.findOne.mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                metrics: { stockPrice: 100, healthScore: 80, peRatio: 20, revenueCAGR: 10, dcfValuationGapPercent: 5 },
            }),
        });
        WatchlistSnapshot.findOneAndUpdate.mockResolvedValue({});

        await insightsService.getInsights("user1");

        expect(WatchlistSnapshot.findOneAndUpdate).toHaveBeenCalledTimes(1);
        expect(WatchlistSnapshot.findOneAndUpdate).toHaveBeenCalledWith(
            { userId: "user1", ticker: "AAPL" },
            expect.objectContaining({
                metrics: { stockPrice: 100, healthScore: 80, peRatio: 20, revenueCAGR: 10, dcfValuationGapPercent: 5 },
            }),
            { upsert: true }
        );
    });
});
