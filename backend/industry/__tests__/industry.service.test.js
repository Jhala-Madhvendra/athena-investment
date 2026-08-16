jest.mock("../../services/company.service", () => ({ getCompanyDetails: jest.fn() }));
jest.mock("../../financials/financials.service", () => ({ getFinancialStatementsByTicker: jest.fn() }));
jest.mock("../../market/market.service", () => ({ getCurrentMarketData: jest.fn() }));
jest.mock("../industry.peerDiscovery", () => ({
    ...jest.requireActual("../industry.peerDiscovery"),
    resolveReferenceUniverse: jest.fn(),
}));

const companyService = require("../../services/company.service");
const financialsService = require("../../financials/financials.service");
const marketService = require("../../market/market.service");
const peerDiscovery = require("../industry.peerDiscovery");
const industryService = require("../industry.service");

const statement = ({ year, revenue, netIncome, operatingIncome, equity, assets, debt, cash, dna, ocf, capex }) => ({
    year,
    source: "yahoo",
    incomeStatement: { totalRevenue: revenue, netIncome, operatingIncome },
    balanceSheet: { totalStockholderEquity: equity, totalAssets: assets, totalDebt: debt, cashAndCashEquivalents: cash },
    cashFlow: { depreciationAndAmortization: dna, operatingCashFlow: ocf, capitalExpenditure: capex },
});

const quote = (marketCap) => ({ price: { marketCap }, asOf: "2026-08-16T00:00:00.000Z" });

const member = (ticker, overrides = {}) => ({ ticker, name: `${ticker} Inc.`, sector: "Technology", industry: "Software", marketCap: 1000, ...overrides });

const TARGET = { ticker: "AAPL", name: "Apple Inc.", sector: "Technology", industry: "Software", marketCap: 3000 };
const UNIVERSE = { level: "industry", key: "Software", size: 4, note: "Industry benchmark based on 4 tracked companies." };
const CANDIDATES = [member("A"), member("B"), member("C"), member("D")];

/**
 * Peers A-D each report a ~35-38% operating margin - well above AAPL's
 * ~26% (300/1150) by more than the 3pp materiality threshold - so AAPL's
 * operating margin lands as a clear, unambiguous weakness in the tests
 * below (not just barely below median).
 */
const PEER_OPERATING_INCOME = { A: 350, B: 360, C: 370, D: 380 };
const peerStatementsFor = (ticker) => ({
    latest: statement({
        year: 2025,
        revenue: 1000,
        netIncome: 180,
        operatingIncome: PEER_OPERATING_INCOME[ticker],
        equity: 800,
        assets: 2000,
        debt: 300,
        cash: 200,
        dna: 50,
        ocf: 300,
        capex: -50,
    }),
    prior: statement({ year: 2024, revenue: 900 }),
});

beforeEach(() => {
    peerDiscovery.resolveReferenceUniverse.mockResolvedValue({ target: TARGET, universe: UNIVERSE, candidates: CANDIDATES });

    financialsService.getFinancialStatementsByTicker.mockImplementation((ticker) => {
        if (ticker === "AAPL") {
            return Promise.resolve([
                statement({ year: 2025, revenue: 1150, netIncome: 200, operatingIncome: 300, equity: 800, assets: 2000, debt: 400, cash: 100, dna: 50, ocf: 250, capex: -50 }),
                statement({ year: 2024, revenue: 1000 }),
            ]);
        }

        const { latest, prior } = peerStatementsFor(ticker);
        return Promise.resolve([latest, prior]);
    });

    marketService.getCurrentMarketData.mockImplementation((ticker) => {
        const caps = { AAPL: 4000, A: 3000, B: 3200, C: 2800, D: 3100 };
        return Promise.resolve(quote(caps[ticker] ?? 1000));
    });

    companyService.getCompanyDetails.mockResolvedValue({ ticker: "AAPL", name: "Apple Inc." });
});

afterEach(() => {
    jest.clearAllMocks();
});

describe("industry.service.getIndustryIntelligence", () => {
    it("throws NoFinancialDataError when the target has no imported financial statements", async () => {
        financialsService.getFinancialStatementsByTicker.mockImplementation((ticker) =>
            Promise.resolve(ticker === "AAPL" ? [] : [statement({ year: 2025, revenue: 1000 })])
        );

        await expect(industryService.getIndustryIntelligence("AAPL")).rejects.toThrow(industryService.NoFinancialDataError);
    });

    it("computes a benchmark for every supported metric using the reference universe", async () => {
        const result = await industryService.getIndustryIntelligence("AAPL");

        expect(result.ticker).toBe("AAPL");
        expect(result.universe).toEqual(UNIVERSE);
        expect(result.benchmarks).toHaveLength(9); // one per METRIC_DEFINITIONS key

        const operatingMargin = result.benchmarks.find((b) => b.metric === "operatingMargin");
        expect(operatingMargin.universe.available).toBe(true); // 4 peers, meets MIN_UNIVERSE_SIZE
        expect(operatingMargin.comparison.available).toBe(true);
        expect(typeof operatingMargin.percentile).toBe("number");
    });

    it("classifies a materially below-median operating margin as a weakness, not a strength", async () => {
        const result = await industryService.getIndustryIntelligence("AAPL");
        const operatingMargin = result.benchmarks.find((b) => b.metric === "operatingMargin");

        // AAPL's operating margin (300/1150 ~= 26%) is below all 4 peers (each with higher operatingIncome/revenue)
        expect(operatingMargin.classification).toBe("weakness");
    });

    it("never classifies a valuation multiple (P/E, EV/EBITDA) as a strength or weakness", async () => {
        const result = await industryService.getIndustryIntelligence("AAPL");
        const pe = result.benchmarks.find((b) => b.metric === "pe");
        const evEbitda = result.benchmarks.find((b) => b.metric === "evEbitda");

        expect(pe.classification).toBe("not_classified");
        expect(evEbitda.classification).toBe("not_classified");
    });

    it("carries separate freshness for the financial statement period and the market quote timestamp", async () => {
        const result = await industryService.getIndustryIntelligence("AAPL");

        expect(result.dataFreshness.financialPeriod).toBe(2025);
        expect(result.dataFreshness.marketDataAsOf).toBe("2026-08-16T00:00:00.000Z");
    });

    it("caches the universe bundle across repeated calls for the same industry, avoiding redundant lookups", async () => {
        // A cache key unique to this test - guarantees a genuine cache miss on the
        // first call regardless of what other tests in this file already warmed.
        peerDiscovery.resolveReferenceUniverse.mockResolvedValue({
            target: TARGET,
            universe: { ...UNIVERSE, key: "Software-CacheTest" },
            candidates: CANDIDATES,
        });

        await industryService.getIndustryIntelligence("AAPL");
        const callsAfterFirst = financialsService.getFinancialStatementsByTicker.mock.calls.length;

        await industryService.getIndustryIntelligence("AAPL");
        const callsAfterSecond = financialsService.getFinancialStatementsByTicker.mock.calls.length;

        // Second call still fetches the target's own statements fresh (2 more calls: target + nothing for cached peers)
        expect(callsAfterSecond - callsAfterFirst).toBe(1);
    });
});

describe("industry.service.getPeerSuggestions", () => {
    it("ranks suggested peers by market-cap proximity and respects the limit", async () => {
        const result = await industryService.getPeerSuggestions("AAPL", 2);

        expect(result.suggestedPeers).toHaveLength(2);
        // Ranking uses the target's own profile marketCap from resolveReferenceUniverse (3000, not a live quote):
        // distances are A=0, D=100, B=200, C=200 -> closest two are A then D.
        expect(result.suggestedPeers.map((p) => p.ticker)).toEqual(["A", "D"]);
    });
});

describe("industry.service.getSupportedMetrics", () => {
    it("throws a 404 when the company does not exist", async () => {
        companyService.getCompanyDetails.mockResolvedValue(null);

        await expect(industryService.getSupportedMetrics("ZZZZ")).rejects.toMatchObject({ statusCode: 404 });
    });

    it("returns the full metric catalog for a known company", async () => {
        const result = await industryService.getSupportedMetrics("AAPL");
        expect(Object.keys(result.metrics)).toEqual(
            expect.arrayContaining(["revenueGrowth", "operatingMargin", "netMargin", "roe", "roa", "fcfMargin", "debtToEquity", "pe", "evEbitda"])
        );
    });
});
