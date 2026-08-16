const mapYahooFinanceCompany = require("../yahooFinance.mapper");
const { mapYahooScreenerCandidates, normalizeCompanyName } = mapYahooFinanceCompany;

const quote = (overrides) => ({
    symbol: "TICK",
    longName: "Test Co",
    exchange: "NMS",
    fullExchangeName: "NasdaqGS",
    marketCap: 1000,
    averageDailyVolume3Month: 100,
    ...overrides,
});

const screenerResponse = (quotes) => ({ finance: { result: [{ quotes }] } });

describe("yahooFinance.mapper.mapYahooScreenerCandidates", () => {
    it("returns an empty array when the response has no quotes", () => {
        expect(mapYahooScreenerCandidates({})).toEqual([]);
        expect(mapYahooScreenerCandidates({ finance: { result: [] } })).toEqual([]);
    });

    it("maps a single quote to a candidate", () => {
        const result = mapYahooScreenerCandidates(screenerResponse([quote({ symbol: "AAPL", longName: "Apple Inc." })]));
        expect(result).toEqual([{ ticker: "AAPL", name: "Apple Inc.", exchange: "NasdaqGS", marketCap: 1000 }]);
    });

    it("collapses cross-listings of the same company down to the highest-volume listing", () => {
        // Mirrors real Yahoo screener behavior: the same company appears many times across exchanges,
        // most with near-zero volume (phantom cross-listings) and one genuine, liquid primary listing.
        const quotes = [
            quote({ symbol: "AAPLCO.CL", longName: "Apple Inc.", averageDailyVolume3Month: 0, marketCap: 999999999999 }),
            quote({ symbol: "AAPL.WA", longName: "Apple Inc.", averageDailyVolume3Month: 11, marketCap: 50000 }),
            quote({ symbol: "AAPL", longName: "Apple Inc.", averageDailyVolume3Month: 56191185, marketCap: 4464797286400 }),
        ];

        const result = mapYahooScreenerCandidates(screenerResponse(quotes));

        expect(result).toHaveLength(1);
        expect(result[0].ticker).toBe("AAPL"); // the genuinely liquid listing, not the largest (currency-distorted) market cap
    });

    it("keeps distinct companies as separate candidates", () => {
        const quotes = [
            quote({ symbol: "AAPL", longName: "Apple Inc.", marketCap: 3000 }),
            quote({ symbol: "005930.KS", longName: "Samsung Electronics Co., Ltd.", marketCap: 2000 }),
            quote({ symbol: "6758.T", longName: "Sony Group Corporation", marketCap: 1000 }),
        ];

        const result = mapYahooScreenerCandidates(screenerResponse(quotes));
        expect(result.map((c) => c.ticker).sort()).toEqual(["005930.KS", "6758.T", "AAPL"]);
    });

    it("sorts the deduplicated candidates by market cap, descending", () => {
        const quotes = [
            quote({ symbol: "SMALL", longName: "Small Co", marketCap: 100 }),
            quote({ symbol: "BIG", longName: "Big Co", marketCap: 9000 }),
            quote({ symbol: "MID", longName: "Mid Co", marketCap: 500 }),
        ];

        const result = mapYahooScreenerCandidates(screenerResponse(quotes));
        expect(result.map((c) => c.ticker)).toEqual(["BIG", "MID", "SMALL"]);
    });

    it("skips a quote missing both longName and shortName rather than fabricating a name", () => {
        const quotes = [quote({ symbol: "NONAME", longName: undefined, shortName: undefined })];
        expect(mapYahooScreenerCandidates(screenerResponse(quotes))).toEqual([]);
    });

    it("falls back to shortName when longName is missing", () => {
        const quotes = [quote({ symbol: "SH", longName: undefined, shortName: "Short Name Co" })];
        const result = mapYahooScreenerCandidates(screenerResponse(quotes));
        expect(result[0].name).toBe("Short Name Co");
    });

    it("treats a missing averageDailyVolume3Month as zero rather than throwing", () => {
        const quotes = [
            quote({ symbol: "A", longName: "Ambiguous Co", averageDailyVolume3Month: undefined, marketCap: 100 }),
            quote({ symbol: "B", longName: "Ambiguous Co", averageDailyVolume3Month: 5, marketCap: 90 }),
        ];
        const result = mapYahooScreenerCandidates(screenerResponse(quotes));
        expect(result).toHaveLength(1);
        expect(result[0].ticker).toBe("B"); // 5 > 0 (treated as the missing value)
    });
});

describe("yahooFinance.mapper.normalizeCompanyName", () => {
    it("strips common legal-entity suffixes and normalizes case/whitespace", () => {
        expect(normalizeCompanyName("Apple Inc.")).toBe("apple");
        expect(normalizeCompanyName("Samsung Electronics Co., Ltd.")).toBe("samsung electronics");
        expect(normalizeCompanyName("LG Corp.")).toBe("lg");
    });

    it("returns an empty string for an empty/undefined input rather than throwing", () => {
        expect(normalizeCompanyName("")).toBe("");
        expect(normalizeCompanyName(undefined)).toBe("");
    });
});
