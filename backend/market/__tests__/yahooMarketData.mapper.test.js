const { mapYahooQuote, mapYahooHistoricalPrices } = require("../mappers/yahooMarketData.mapper");

describe("mapYahooQuote", () => {
    it("maps a full quoteSummary response into the normalized shape", () => {
        const response = {
            quoteSummary: {
                result: [
                    {
                        price: { symbol: "AAPL", regularMarketPrice: { raw: 190.5 }, currency: "USD" },
                        summaryDetail: {
                            previousClose: { raw: 189 },
                            open: { raw: 190 },
                            dayHigh: { raw: 191.2 },
                            dayLow: { raw: 188.9 },
                            fiftyTwoWeekHigh: { raw: 220 },
                            fiftyTwoWeekLow: { raw: 150 },
                            volume: { raw: 50000000 },
                            averageVolume: { raw: 60000000 },
                            marketCap: { raw: 3000000000000 },
                            trailingPE: { raw: 30.5 },
                            forwardPE: { raw: 28.1 },
                            dividendYield: { raw: 0.005 },
                            dividendRate: { raw: 1 },
                        },
                        defaultKeyStatistics: {
                            priceToBook: { raw: 45.2 },
                            trailingEps: { raw: 6.2 },
                            forwardEps: { raw: 6.8 },
                            beta: { raw: 1.25 },
                        },
                    },
                ],
            },
        };

        const quote = mapYahooQuote(response, "AAPL");

        expect(quote.ticker).toBe("AAPL");
        expect(quote.currency).toBe("USD");
        expect(quote.price.current).toBe(190.5);
        expect(quote.price.marketCap).toBe(3000000000000);
        expect(quote.valuation.peRatio).toBe(30.5);
        expect(quote.valuation.priceToBook).toBe(45.2);
        expect(quote.dividend.yield).toBe(0.005);
        expect(quote.riskMetrics.beta).toBe(1.25);
        expect(typeof quote.asOf).toBe("string");
    });

    it("returns null fields instead of throwing when optional modules are missing", () => {
        const response = {
            quoteSummary: {
                result: [{ price: {}, summaryDetail: {}, defaultKeyStatistics: {} }],
            },
        };

        const quote = mapYahooQuote(response, "ZZZZ");

        expect(quote.ticker).toBe("ZZZZ");
        expect(quote.price.current).toBeNull();
        expect(quote.valuation.peRatio).toBeNull();
        expect(quote.valuation.eps).toBeNull();
        expect(quote.dividend.yield).toBeNull();
        expect(quote.riskMetrics.beta).toBeNull();
    });

    it("returns null when Yahoo returns no result for the ticker", () => {
        expect(mapYahooQuote({ quoteSummary: { result: [] } }, "ZZZZ")).toBeNull();
        expect(mapYahooQuote({}, "ZZZZ")).toBeNull();
    });

    it("prefers Yahoo's own regularMarketTime for asOf, over Athena's fetch time", () => {
        const response = {
            quoteSummary: {
                result: [{ price: { regularMarketTime: { raw: 1700000000 } }, summaryDetail: {}, defaultKeyStatistics: {} }],
            },
        };

        const quote = mapYahooQuote(response, "AAPL");

        expect(quote.asOf).toBe(new Date(1700000000 * 1000).toISOString());
    });

    it("falls back to the current time for asOf when Yahoo didn't supply regularMarketTime", () => {
        const response = { quoteSummary: { result: [{ price: {}, summaryDetail: {}, defaultKeyStatistics: {} }] } };

        const before = Date.now();
        const quote = mapYahooQuote(response, "AAPL");
        const after = Date.now();

        const asOfMs = new Date(quote.asOf).getTime();
        expect(asOfMs).toBeGreaterThanOrEqual(before);
        expect(asOfMs).toBeLessThanOrEqual(after);
    });
});

describe("mapYahooHistoricalPrices", () => {
    it("zips timestamps with OHLCV arrays into daily bars", () => {
        const response = {
            chart: {
                result: [
                    {
                        timestamp: [1700000000, 1700086400],
                        indicators: {
                            quote: [{ open: [10, 11], high: [12, 13], low: [9, 10], close: [11, 12], volume: [1000, 1100] }],
                            adjclose: [{ adjclose: [11, 12] }],
                        },
                    },
                ],
            },
        };

        const bars = mapYahooHistoricalPrices(response);

        expect(bars).toHaveLength(2);
        expect(bars[0]).toEqual({
            date: "2023-11-14",
            open: 10,
            high: 12,
            low: 9,
            close: 11,
            adjClose: 11,
            volume: 1000,
        });
    });

    it("drops bars with a null/undefined close (non-trading days in the raw series)", () => {
        const response = {
            chart: {
                result: [
                    {
                        timestamp: [1700000000, 1700086400],
                        indicators: {
                            quote: [{ open: [10, null], high: [12, null], low: [9, null], close: [11, null], volume: [1000, null] }],
                            adjclose: [{ adjclose: [11, null] }],
                        },
                    },
                ],
            },
        };

        expect(mapYahooHistoricalPrices(response)).toHaveLength(1);
    });

    it("returns an empty array when Yahoo returns no chart result", () => {
        expect(mapYahooHistoricalPrices({ chart: { result: [] } })).toEqual([]);
        expect(mapYahooHistoricalPrices({})).toEqual([]);
    });
});
