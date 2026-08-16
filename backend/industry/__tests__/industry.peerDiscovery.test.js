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
    it("ranks candidates by closest market cap to the target, nearest first", () => {
        const target = { marketCap: 1000 };
        const candidates = [
            { ticker: "FAR", marketCap: 5000 },
            { ticker: "CLOSE", marketCap: 1100 },
            { ticker: "MID", marketCap: 2000 },
        ];

        const ranked = rankByMarketCapProximity(target, candidates, 10);

        expect(ranked.map((c) => c.ticker)).toEqual(["CLOSE", "MID", "FAR"]);
    });

    it("caps the result at the given limit", () => {
        const target = { marketCap: 1000 };
        const candidates = [
            { ticker: "A", marketCap: 1000 },
            { ticker: "B", marketCap: 1100 },
            { ticker: "C", marketCap: 900 },
        ];

        expect(rankByMarketCapProximity(target, candidates, 2)).toHaveLength(2);
    });

    it("pushes candidates with an unknown market cap to the end rather than crashing", () => {
        const target = { marketCap: 1000 };
        const candidates = [
            { ticker: "UNKNOWN", marketCap: null },
            { ticker: "KNOWN", marketCap: 1050 },
        ];

        const ranked = rankByMarketCapProximity(target, candidates, 10);
        expect(ranked[0].ticker).toBe("KNOWN");
    });
});
