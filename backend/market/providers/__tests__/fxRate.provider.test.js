jest.mock("../marketData.provider.registry", () => ({ getQuote: jest.fn() }));

const marketDataProvider = require("../marketData.provider.registry");
const fxRateProvider = require("../fxRate.provider");

beforeEach(() => {
    fxRateProvider._resetCache();
});

afterEach(() => {
    jest.clearAllMocks();
});

describe("getRateToUSD", () => {
    it("returns 1 for USD without calling the provider", async () => {
        const rate = await fxRateProvider.getRateToUSD("USD");
        expect(rate).toBe(1);
        expect(marketDataProvider.getQuote).not.toHaveBeenCalled();
    });

    it("returns 1 for a falsy currency without calling the provider", async () => {
        expect(await fxRateProvider.getRateToUSD(null)).toBe(1);
        expect(await fxRateProvider.getRateToUSD(undefined)).toBe(1);
        expect(marketDataProvider.getQuote).not.toHaveBeenCalled();
    });

    it("fetches USD<currency>=X and inverts it to USD-per-unit-of-currency", async () => {
        marketDataProvider.getQuote.mockResolvedValue({ price: { current: 87.5 } }); // 87.5 INR = 1 USD

        const rate = await fxRateProvider.getRateToUSD("INR");

        expect(rate).toBeCloseTo(1 / 87.5, 10);
        expect(marketDataProvider.getQuote).toHaveBeenCalledWith("USDINR=X");
    });

    it("caches the result per currency and does not re-fetch within the TTL", async () => {
        marketDataProvider.getQuote.mockResolvedValue({ price: { current: 87.5 } });

        await fxRateProvider.getRateToUSD("INR");
        await fxRateProvider.getRateToUSD("INR");

        expect(marketDataProvider.getQuote).toHaveBeenCalledTimes(1);
    });

    it("caches different currencies independently", async () => {
        marketDataProvider.getQuote.mockResolvedValueOnce({ price: { current: 87.5 } });
        marketDataProvider.getQuote.mockResolvedValueOnce({ price: { current: 0.92 } });

        const inr = await fxRateProvider.getRateToUSD("INR");
        const eur = await fxRateProvider.getRateToUSD("EUR");

        expect(inr).toBeCloseTo(1 / 87.5, 10);
        expect(eur).toBeCloseTo(1 / 0.92, 10);
        expect(marketDataProvider.getQuote).toHaveBeenCalledTimes(2);
    });

    it("returns null (never throws) when the provider fails", async () => {
        marketDataProvider.getQuote.mockRejectedValue(new Error("Yahoo Finance request failed."));

        const rate = await fxRateProvider.getRateToUSD("INR");

        expect(rate).toBeNull();
    });

    it("returns null when the quote has no usable numeric price", async () => {
        marketDataProvider.getQuote.mockResolvedValue({ price: { current: null } });
        expect(await fxRateProvider.getRateToUSD("INR")).toBeNull();

        marketDataProvider.getQuote.mockResolvedValue({ price: { current: 0 } });
        expect(await fxRateProvider.getRateToUSD("JPY")).toBeNull();

        marketDataProvider.getQuote.mockResolvedValue({ price: { current: -5 } });
        expect(await fxRateProvider.getRateToUSD("GBP")).toBeNull();
    });
});

describe("attachMarketCapUSD", () => {
    it("converts each item's market cap using its own currency, fetching one rate per unique currency", async () => {
        marketDataProvider.getQuote.mockImplementation(async (symbol) =>
            symbol === "USDINR=X" ? { price: { current: 87.5 } } : { price: { current: 1 } }
        );

        const items = [
            { ticker: "AAPL", marketCap: 3_000_000_000, currency: "USD" },
            { ticker: "TCS.BO", marketCap: 262_500_000_000, currency: "INR" }, // ~$3B at 87.5 INR/USD
        ];

        const result = await fxRateProvider.attachMarketCapUSD(items);

        expect(result[0].marketCapUSD).toBeCloseTo(3_000_000_000, 0);
        expect(result[1].marketCapUSD).toBeCloseTo(3_000_000_000, 0);
        // USD short-circuits with no provider call (see getRateToUSD); only INR needs a live fetch, and only once.
        expect(marketDataProvider.getQuote).toHaveBeenCalledTimes(1);
        expect(marketDataProvider.getQuote).toHaveBeenCalledWith("USDINR=X");
    });

    it("returns null marketCapUSD (not a wrong number) when the item's marketCap is missing", async () => {
        const result = await fxRateProvider.attachMarketCapUSD([{ ticker: "X", marketCap: null, currency: "USD" }]);
        expect(result[0].marketCapUSD).toBeNull();
    });

    it("returns null marketCapUSD when the currency's exchange rate is unavailable", async () => {
        marketDataProvider.getQuote.mockRejectedValue(new Error("rate unavailable"));

        const result = await fxRateProvider.attachMarketCapUSD([{ ticker: "TCS.BO", marketCap: 100, currency: "INR" }]);

        expect(result[0].marketCapUSD).toBeNull();
    });

    it("preserves item order and every original field", async () => {
        const items = [
            { ticker: "B", marketCap: 200, currency: "USD" },
            { ticker: "A", marketCap: 100, currency: "USD" },
        ];

        const result = await fxRateProvider.attachMarketCapUSD(items);

        expect(result.map((i) => i.ticker)).toEqual(["B", "A"]);
        expect(result[0]).toMatchObject({ ticker: "B", marketCap: 200, currency: "USD" });
    });
});
