jest.mock("../../../market/providers/marketData.provider.registry", () => ({
    getQuote: jest.fn(),
}));

const marketDataProvider = require("../../../market/providers/marketData.provider.registry");
const riskFreeRateProvider = require("../riskFreeRate.provider");

beforeEach(() => {
    riskFreeRateProvider._resetCache();
});

afterEach(() => {
    jest.clearAllMocks();
});

describe("getRiskFreeRate", () => {
    it("fetches the 10-year treasury yield and converts percentage points to a decimal", async () => {
        marketDataProvider.getQuote.mockResolvedValue({ price: { current: 4.32 } });

        const rate = await riskFreeRateProvider.getRiskFreeRate();

        expect(rate).toBeCloseTo(0.0432);
        expect(marketDataProvider.getQuote).toHaveBeenCalledWith(riskFreeRateProvider.TEN_YEAR_TREASURY_SYMBOL);
    });

    it("caches the result and does not re-fetch on the next call within the TTL", async () => {
        marketDataProvider.getQuote.mockResolvedValue({ price: { current: 4.32 } });

        await riskFreeRateProvider.getRiskFreeRate();
        await riskFreeRateProvider.getRiskFreeRate();

        expect(marketDataProvider.getQuote).toHaveBeenCalledTimes(1);
    });

    it("returns null (never throws) when the provider fails", async () => {
        marketDataProvider.getQuote.mockRejectedValue(new Error("Yahoo Finance request failed."));

        const rate = await riskFreeRateProvider.getRiskFreeRate();

        expect(rate).toBeNull();
    });

    it("returns null when the quote has no numeric price", async () => {
        marketDataProvider.getQuote.mockResolvedValue({ price: { current: null } });

        const rate = await riskFreeRateProvider.getRiskFreeRate();

        expect(rate).toBeNull();
    });
});
