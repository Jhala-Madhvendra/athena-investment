const mockValidate = jest.fn();

jest.mock("../../models/company.model", () => ({ findOne: jest.fn() }));
jest.mock("../market.model", () => {
    // MarketHistory is `new`-ed for per-document validation before bulkWrite -
    // needs a real constructor, not just a plain object of static mocks.
    const MockMarketHistory = jest.fn().mockImplementation(function (doc) {
        Object.assign(this, doc);
        this.validate = mockValidate;
    });
    MockMarketHistory.find = jest.fn();
    MockMarketHistory.bulkWrite = jest.fn();
    return MockMarketHistory;
});
jest.mock("../providers/marketData.provider.registry", () => ({
    getQuote: jest.fn(),
    getHistoricalPrices: jest.fn(),
}));

const Company = require("../../models/company.model");
const MarketHistory = require("../market.model");
const marketDataProvider = require("../providers/marketData.provider.registry");
const marketService = require("../market.service");

const isoDate = (date) => date.toISOString().slice(0, 10);
const daysAgo = (n) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - n);
    return isoDate(date);
};
const TODAY = isoDate(new Date());

/** Chainable mock matching Mongoose's find().sort().select().lean() usage in market.service.js */
const chainableResult = (records) => {
    const chain = {
        sort: jest.fn(() => chain),
        select: jest.fn(() => chain),
        lean: jest.fn(() => Promise.resolve(records)),
    };
    return chain;
};

beforeEach(() => {
    mockValidate.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
    jest.clearAllMocks();
});

describe("getCurrentMarketData", () => {
    it("throws CompanyNotFoundError when the ticker has no stored company", async () => {
        Company.findOne.mockResolvedValue(null);

        await expect(marketService.getCurrentMarketData("ZZZZ")).rejects.toThrow(
            marketService.CompanyNotFoundError
        );
    });

    it("caches the live quote so repeated calls within the TTL skip the provider", async () => {
        Company.findOne.mockResolvedValue({ _id: "company1" });
        marketDataProvider.getQuote
            .mockResolvedValueOnce({ ticker: "CACHETEST", price: { current: 100 } })
            .mockResolvedValueOnce({ ticker: "CACHETEST", price: { current: 999 } });

        const first = await marketService.getCurrentMarketData("CACHETEST");
        const second = await marketService.getCurrentMarketData("CACHETEST");

        expect(first.price.current).toBe(100);
        expect(second.price.current).toBe(100);
        expect(marketDataProvider.getQuote).toHaveBeenCalledTimes(1);
    });
});

describe("getHistoricalPrices", () => {
    it("rejects an unsupported period before touching the database", async () => {
        await expect(marketService.getHistoricalPrices("AAPL", "2y")).rejects.toThrow(
            marketService.InvalidPeriodError
        );
        expect(Company.findOne).not.toHaveBeenCalled();
    });

    it("throws CompanyNotFoundError when the ticker has no stored company", async () => {
        Company.findOne.mockResolvedValue(null);

        await expect(marketService.getHistoricalPrices("ZZZZ", "1y")).rejects.toThrow(
            marketService.CompanyNotFoundError
        );
    });

    it("backfills from the provider when there is no cached coverage", async () => {
        Company.findOne.mockResolvedValue({ _id: "company1" });
        MarketHistory.find
            .mockReturnValueOnce(chainableResult([])) // existing coverage check: empty
            .mockReturnValueOnce(chainableResult([{ date: TODAY, close: 42 }])); // final filtered read
        marketDataProvider.getHistoricalPrices.mockResolvedValue([
            { date: TODAY, open: 40, high: 43, low: 39, close: 42, adjClose: 42, volume: 1000 },
        ]);
        MarketHistory.bulkWrite.mockResolvedValue({});

        const bars = await marketService.getHistoricalPrices("NEWTICKER", "1m");

        expect(marketDataProvider.getHistoricalPrices).toHaveBeenCalledWith("NEWTICKER", "10y");
        expect(MarketHistory.bulkWrite).toHaveBeenCalledTimes(1);
        expect(MarketHistory.bulkWrite.mock.calls[0][0]).toHaveLength(1);
        expect(bars).toEqual([{ date: TODAY, close: 42 }]);
    });

    it("drops bars that fail schema validation before writing, keeping the valid ones", async () => {
        Company.findOne.mockResolvedValue({ _id: "company1" });
        MarketHistory.find
            .mockReturnValueOnce(chainableResult([]))
            .mockReturnValueOnce(chainableResult([{ date: TODAY, close: 42 }]));
        marketDataProvider.getHistoricalPrices.mockResolvedValue([
            { date: TODAY, open: 40, high: 43, low: 39, close: 42, adjClose: 42, volume: 1000 },
            { date: daysAgo(1), open: 40, high: 43, low: 39, close: null, adjClose: null, volume: 1000 },
        ]);
        mockValidate
            .mockResolvedValueOnce(undefined) // first bar: valid
            .mockRejectedValueOnce(new Error("close: Path `close` is required.")); // second bar: invalid
        MarketHistory.bulkWrite.mockResolvedValue({});

        await marketService.getHistoricalPrices("MIXEDTICKER", "1m");

        expect(MarketHistory.bulkWrite).toHaveBeenCalledTimes(1);
        expect(MarketHistory.bulkWrite.mock.calls[0][0]).toHaveLength(1);
    });

    it("accepts the 10y period and requires a start date roughly 10 years back", async () => {
        Company.findOne.mockResolvedValue({ _id: "company1" });
        const cachedRecords = [{ date: daysAgo(365 * 11) }, { date: TODAY }];
        MarketHistory.find
            .mockReturnValueOnce(chainableResult(cachedRecords))
            .mockReturnValueOnce(chainableResult([{ date: TODAY, close: 42 }]));

        const bars = await marketService.getHistoricalPrices("TENYEAR", "10y");

        expect(marketDataProvider.getHistoricalPrices).not.toHaveBeenCalled(); // 11y-old anchor already covers a 10y request
        expect(bars).toEqual([{ date: TODAY, close: 42 }]);
    });

    it("skips the provider refresh when cached coverage already spans the period and is fresh", async () => {
        Company.findOne.mockResolvedValue({ _id: "company1" });
        const cachedRecords = [{ date: daysAgo(365 * 6) }, { date: TODAY }];
        MarketHistory.find
            .mockReturnValueOnce(chainableResult(cachedRecords))
            .mockReturnValueOnce(chainableResult([{ date: TODAY, close: 42 }]));

        await marketService.getHistoricalPrices("CACHEDTICKER", "1y");

        expect(marketDataProvider.getHistoricalPrices).not.toHaveBeenCalled();
    });
});

describe("getPerformance", () => {
    it("rejects an unsupported period", async () => {
        await expect(marketService.getPerformance("AAPL", "20y")).rejects.toThrow(
            marketService.InvalidPeriodError
        );
    });

    const setupSufficientHistory = (bars) => {
        Company.findOne.mockResolvedValue({ _id: "company1" });
        // Coverage check sees the full history (old anchor bar + real bars) -> sufficient, no refresh.
        // Anchor is older than MAX_PERIOD (10y) so getPerformance's internal
        // full-history fetch (always MAX_PERIOD) never triggers a refresh.
        MarketHistory.find
            .mockReturnValueOnce(chainableResult([{ date: daysAgo(365 * 11) }, ...bars]))
            .mockReturnValueOnce(chainableResult(bars));
    };

    it("returns null for a period with fewer than two bars in the window", async () => {
        setupSufficientHistory([{ date: TODAY, close: 100 }]);

        const performance = await marketService.getPerformance("SINGLEBAR", "6m");

        expect(performance["6M"]).toBeNull();
        expect(marketDataProvider.getHistoricalPrices).not.toHaveBeenCalled();
    });

    it("calculates a positive return correctly", async () => {
        setupSufficientHistory([
            { date: daysAgo(150), close: 100 },
            { date: TODAY, close: 110 },
        ]);

        const performance = await marketService.getPerformance("POSRETURN", "6m");

        expect(performance["6M"]).toBe(10);
    });

    it("calculates a negative return correctly", async () => {
        setupSufficientHistory([
            { date: daysAgo(150), close: 200 },
            { date: TODAY, close: 150 },
        ]);

        const performance = await marketService.getPerformance("NEGRETURN", "6m");

        expect(performance["6M"]).toBe(-25);
    });

    it("returns null instead of dividing by zero when the starting price is 0", async () => {
        setupSufficientHistory([
            { date: daysAgo(150), close: 0 },
            { date: TODAY, close: 50 },
        ]);

        const performance = await marketService.getPerformance("ZEROSTART", "6m");

        expect(performance["6M"]).toBeNull();
    });

    it("computes all periods when no period is specified, nulling out windows without enough data", async () => {
        setupSufficientHistory([
            { date: daysAgo(150), close: 100 },
            { date: TODAY, close: 110 },
        ]);

        const performance = await marketService.getPerformance("ALLPERIODS", undefined);

        expect(performance["1M"]).toBeNull();
        expect(performance["3M"]).toBeNull();
        expect(performance["6M"]).toBe(10);
        expect(performance["1Y"]).toBe(10);
        expect(performance["5Y"]).toBe(10);
        expect(performance["10Y"]).toBe(10);
    });
});
