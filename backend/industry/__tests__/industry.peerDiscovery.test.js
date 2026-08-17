jest.mock("../../models/company.model", () => ({ findOne: jest.fn(), find: jest.fn() }));
jest.mock("../../financials/financials.model", () => ({ distinct: jest.fn() }));

const Company = require("../../models/company.model");
const FinancialStatement = require("../../financials/financials.model");
const { resolveReferenceUniverse, rankByMarketCapProximity, CompanyNotFoundError } = require("../industry.peerDiscovery");

/** Chainable mock matching Mongoose's find()/findOne() usage in industry.peerDiscovery.js. */
const chainableResult = (result) => {
    const chain = {
        select: jest.fn(() => chain),
        sort: jest.fn(() => chain),
        limit: jest.fn(() => chain),
        lean: jest.fn(() => Promise.resolve(result)),
    };
    return chain;
};

const company = (ticker, overrides = {}) => ({ ticker, name: `${ticker} Inc.`, sector: "Technology", industry: "Software", marketCap: 1000, ...overrides });

afterEach(() => {
    jest.clearAllMocks();
});

describe("industry.peerDiscovery.resolveReferenceUniverse", () => {
    it("throws CompanyNotFoundError when the target ticker has no company record", async () => {
        Company.findOne.mockReturnValue(chainableResult(null));

        await expect(resolveReferenceUniverse("ZZZZ")).rejects.toThrow(CompanyNotFoundError);
    });

    it("uses the industry level when at least MIN_UNIVERSE_SIZE same-industry companies with statements exist", async () => {
        Company.findOne.mockReturnValue(chainableResult(company("AAPL")));
        Company.find
            .mockReturnValueOnce(chainableResult([company("A"), company("B"), company("C"), company("D")])) // industry pool
            .mockReturnValueOnce(chainableResult([company("A"), company("B"), company("C"), company("D")])); // sector pool
        FinancialStatement.distinct.mockResolvedValue(["A", "B", "C", "D"]);

        const result = await resolveReferenceUniverse("AAPL");

        expect(result.universe.level).toBe("industry");
        expect(result.universe.key).toBe("Software");
        expect(result.universe.size).toBe(4);
        expect(result.candidates).toHaveLength(4);
    });

    it("falls back to the sector level when the industry-level set is too small, and says so", async () => {
        Company.findOne.mockReturnValue(chainableResult(company("AAPL")));
        Company.find
            .mockReturnValueOnce(chainableResult([company("A"), company("B")])) // industry pool: only 2
            .mockReturnValueOnce(chainableResult([company("A"), company("B"), company("C"), company("D"), company("E")])); // sector pool: 5
        FinancialStatement.distinct.mockResolvedValue(["A", "B", "C", "D", "E"]);

        const result = await resolveReferenceUniverse("AAPL");

        expect(result.universe.level).toBe("sector");
        expect(result.universe.key).toBe("Technology");
        expect(result.universe.note).toMatch(/broader sector level/i);
    });

    it("excludes candidates that have no imported financial statements from the universe count", async () => {
        Company.findOne.mockReturnValue(chainableResult(company("AAPL")));
        Company.find
            .mockReturnValueOnce(chainableResult([company("A"), company("B"), company("C"), company("D"), company("E")]))
            .mockReturnValueOnce(chainableResult([company("A"), company("B"), company("C"), company("D"), company("E")]));
        FinancialStatement.distinct.mockResolvedValue(["A", "B", "C"]); // only 3 of 5 have statements

        const result = await resolveReferenceUniverse("AAPL");

        // 3 valid industry candidates is below MIN_UNIVERSE_SIZE (4); sector pool has the same 3 valid -> best-effort industry/sector tie, still insufficient
        expect(result.universe.size).toBe(3);
        expect(result.universe.note).toMatch(/below the minimum/i);
    });

    it("reports 'none' when the target has no sector or industry classification at all", async () => {
        Company.findOne.mockReturnValue(chainableResult(company("AAPL", { sector: null, industry: null })));
        FinancialStatement.distinct.mockResolvedValue([]);

        const result = await resolveReferenceUniverse("AAPL");

        expect(result.universe.level).toBe("none");
        expect(result.candidates).toHaveLength(0);
        expect(Company.find).not.toHaveBeenCalled();
    });
});

describe("industry.peerDiscovery.rankByMarketCapProximity", () => {
    // Ranks on marketCapUSD (already currency-normalized by the caller via
    // fxRate.provider.js's attachMarketCapUSD) - this pure function never
    // touches the native-currency `marketCap` field or fetches an exchange
    // rate itself. See PortfolioCurrencyNormalization.md.
    it("ranks candidates by closest market cap to the target, nearest first", () => {
        const target = { marketCapUSD: 1000 };
        const candidates = [
            { ticker: "FAR", marketCapUSD: 5000 },
            { ticker: "CLOSE", marketCapUSD: 1100 },
            { ticker: "MID", marketCapUSD: 2000 },
        ];

        const ranked = rankByMarketCapProximity(target, candidates, 10);

        expect(ranked.map((c) => c.ticker)).toEqual(["CLOSE", "MID", "FAR"]);
    });

    it("caps the result at the given limit", () => {
        const target = { marketCapUSD: 1000 };
        const candidates = [
            { ticker: "A", marketCapUSD: 1000 },
            { ticker: "B", marketCapUSD: 1100 },
            { ticker: "C", marketCapUSD: 900 },
        ];

        expect(rankByMarketCapProximity(target, candidates, 2)).toHaveLength(2);
    });

    it("ranks purely by marketCapUSD, ignoring a native-currency marketCap that would give a different (wrong) answer", () => {
        // A candidate with a huge raw INR number but a genuinely small USD value should NOT rank as "far" just because its raw number is large.
        const target = { marketCap: 1000, marketCapUSD: 1000 };
        const candidates = [
            { ticker: "TRUE_MATCH", marketCap: 1050, marketCapUSD: 1050 },
            { ticker: "LARGE_RAW_NUMBER_SMALL_USD", marketCap: 90000, marketCapUSD: 12 }, // e.g. a small INR-denominated company
        ];

        const ranked = rankByMarketCapProximity(target, candidates, 10);

        // TRUE_MATCH is genuinely closer in USD terms, even though its raw `marketCap` (1050) looks less "round" than the other's 90000.
        expect(ranked[0].ticker).toBe("TRUE_MATCH");
    });

    it("pushes candidates with an unknown market cap to the end rather than crashing", () => {
        const target = { marketCapUSD: 1000 };
        const candidates = [
            { ticker: "UNKNOWN", marketCapUSD: null },
            { ticker: "KNOWN", marketCapUSD: 1050 },
        ];

        const ranked = rankByMarketCapProximity(target, candidates, 10);
        expect(ranked[0].ticker).toBe("KNOWN");
    });
});
