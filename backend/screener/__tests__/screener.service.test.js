jest.mock("../../models/company.model", () => ({ find: jest.fn(), distinct: jest.fn() }));
jest.mock("../../financials/financials.model", () => ({ distinct: jest.fn() }));
jest.mock("../../analysis/analysis.service", () => ({ calculateAnalysis: jest.fn() }));
jest.mock("../../ratio/ratio.service", () => ({ getRatiosByTicker: jest.fn() }));

const Company = require("../../models/company.model");
const FinancialStatement = require("../../financials/financials.model");
const analysisService = require("../../analysis/analysis.service");
const ratioService = require("../../ratio/ratio.service");
const fxRateProvider = require("../../market/providers/fxRate.provider");
const screenerService = require("../screener.service");

const chainableSelectLimitLean = (docs) => ({
    select: jest.fn(() => ({ limit: jest.fn(() => ({ lean: jest.fn(() => Promise.resolve(docs)) })) })),
});

const baseCriteria = {
    sector: null,
    industry: null,
    minMarketCap: null,
    maxMarketCap: null,
    minHealthScore: null,
    maxHealthScore: null,
    sortBy: "healthScore",
    sortDirection: "desc",
    limit: 20,
};

const healthyAnalysis = (overall) => ({
    healthScore: { overall, label: "Strong", riskLevel: "low" },
});

beforeEach(() => {
    screenerService._resetCache();
});

afterEach(() => {
    jest.clearAllMocks();
});

describe("runScreener", () => {
    it("returns an empty result when no companies match the filter", async () => {
        Company.find.mockReturnValue(chainableSelectLimitLean([]));
        FinancialStatement.distinct.mockResolvedValue([]);

        const result = await screenerService.runScreener(baseCriteria);

        expect(result.universeMatchedCount).toBe(0);
        expect(result.companies).toEqual([]);
        expect(analysisService.calculateAnalysis).not.toHaveBeenCalled();
    });

    it("excludes candidates with no imported financial statements", async () => {
        Company.find.mockReturnValue(
            chainableSelectLimitLean([
                { ticker: "AAPL", name: "Apple", sector: "Tech", industry: "Hardware", marketCap: 3e12, currency: "USD" },
                { ticker: "NOFIN", name: "No Financials Inc", sector: "Tech", industry: "Hardware", marketCap: 1e9, currency: "USD" },
            ])
        );
        FinancialStatement.distinct.mockResolvedValue(["AAPL"]);
        analysisService.calculateAnalysis.mockResolvedValue(healthyAnalysis(85));
        ratioService.getRatiosByTicker.mockResolvedValue({ ratios: { profitability: {} } });

        const result = await screenerService.runScreener(baseCriteria);

        expect(result.universeMatchedCount).toBe(1);
        expect(result.companies).toHaveLength(1);
        expect(result.companies[0].ticker).toBe("AAPL");
    });

    it("caps scored companies at the request limit and reports cappedNote", async () => {
        const candidates = Array.from({ length: 5 }, (_, i) => ({
            ticker: `T${i}`,
            name: `Company ${i}`,
            sector: "Tech",
            industry: "Hardware",
            marketCap: 1e9,
            currency: "USD",
        }));
        Company.find.mockReturnValue(chainableSelectLimitLean(candidates));
        FinancialStatement.distinct.mockResolvedValue(candidates.map((c) => c.ticker));
        analysisService.calculateAnalysis.mockResolvedValue(healthyAnalysis(70));
        ratioService.getRatiosByTicker.mockResolvedValue({ ratios: {} });

        const result = await screenerService.runScreener({ ...baseCriteria, limit: 2 });

        expect(result.universeMatchedCount).toBe(5);
        expect(result.scoredCount).toBe(2);
        expect(result.companies).toHaveLength(2);
        expect(result.cappedNote).toMatch(/Showing 2 of 5/);
    });

    it("marks a company unavailable, without failing the request, when Health Score calculation errors", async () => {
        Company.find.mockReturnValue(chainableSelectLimitLean([{ ticker: "BADCO", name: "Bad Co", marketCap: 1e9, currency: "USD" }]));
        FinancialStatement.distinct.mockResolvedValue(["BADCO"]);
        analysisService.calculateAnalysis.mockResolvedValue({ error: "No financial data.", status: 404 });
        ratioService.getRatiosByTicker.mockResolvedValue({ ratios: {} });

        const result = await screenerService.runScreener(baseCriteria);

        expect(result.companies[0].dataAvailable).toBe(false);
        expect(result.companies[0].healthScore).toBeNull();
        expect(result.companies[0].unavailableReason).toBe("No financial data.");
    });

    it("filters out companies below minHealthScore", async () => {
        Company.find.mockReturnValue(
            chainableSelectLimitLean([
                { ticker: "STRONG", name: "Strong Co", marketCap: 1e9, currency: "USD" },
                { ticker: "WEAK", name: "Weak Co", marketCap: 1e9, currency: "USD" },
            ])
        );
        FinancialStatement.distinct.mockResolvedValue(["STRONG", "WEAK"]);
        analysisService.calculateAnalysis.mockImplementation((ticker) =>
            Promise.resolve(healthyAnalysis(ticker === "STRONG" ? 90 : 30))
        );
        ratioService.getRatiosByTicker.mockResolvedValue({ ratios: {} });

        const result = await screenerService.runScreener({ ...baseCriteria, minHealthScore: 50 });

        expect(result.companies.map((c) => c.ticker)).toEqual(["STRONG"]);
    });

    it("sorts by healthScore descending by default", async () => {
        Company.find.mockReturnValue(
            chainableSelectLimitLean([
                { ticker: "LOW", name: "Low Co", marketCap: 1e9, currency: "USD" },
                { ticker: "HIGH", name: "High Co", marketCap: 1e9, currency: "USD" },
            ])
        );
        FinancialStatement.distinct.mockResolvedValue(["LOW", "HIGH"]);
        analysisService.calculateAnalysis.mockImplementation((ticker) => Promise.resolve(healthyAnalysis(ticker === "HIGH" ? 95 : 40)));
        ratioService.getRatiosByTicker.mockResolvedValue({ ratios: {} });

        const result = await screenerService.runScreener(baseCriteria);

        expect(result.companies.map((c) => c.ticker)).toEqual(["HIGH", "LOW"]);
    });

    it("filters by minMarketCap/maxMarketCap in USD, not raw native-currency marketCap", async () => {
        // TCS.BO's raw marketCap (in INR) is numerically far larger than AAPL's (in USD) despite
        // being a smaller company once converted - a currency-blind $gte/$lte would misfilter this.
        jest.spyOn(fxRateProvider, "getRateToUSD").mockImplementation(async (currency) => (currency === "INR" ? 1 / 87.5 : 1));
        Company.find.mockReturnValue(
            chainableSelectLimitLean([
                { ticker: "AAPL", name: "Apple", marketCap: 3_000_000_000, currency: "USD" }, // $3B
                { ticker: "TCS.BO", name: "TCS", marketCap: 26_250_000_000, currency: "INR" }, // ~$300M at 87.5 INR/USD
            ])
        );
        FinancialStatement.distinct.mockResolvedValue(["AAPL", "TCS.BO"]);
        analysisService.calculateAnalysis.mockResolvedValue(healthyAnalysis(80));
        ratioService.getRatiosByTicker.mockResolvedValue({ ratios: {} });

        const result = await screenerService.runScreener({ ...baseCriteria, minMarketCap: 1_000_000_000 });

        expect(result.companies.map((c) => c.ticker)).toEqual(["AAPL"]);
    });

    it("excludes a company whose currency has no available exchange rate when a market cap bound is set", async () => {
        jest.spyOn(fxRateProvider, "getRateToUSD").mockResolvedValue(null);
        Company.find.mockReturnValue(chainableSelectLimitLean([{ ticker: "X", name: "X Co", marketCap: 1e9, currency: "XYZ" }]));
        FinancialStatement.distinct.mockResolvedValue(["X"]);

        const result = await screenerService.runScreener({ ...baseCriteria, minMarketCap: 0 });

        expect(result.companies).toEqual([]);
        expect(analysisService.calculateAnalysis).not.toHaveBeenCalled();
    });

    it("never fetches an exchange rate when no market cap bound is set", async () => {
        const rateSpy = jest.spyOn(fxRateProvider, "getRateToUSD");
        Company.find.mockReturnValue(chainableSelectLimitLean([{ ticker: "TCS.BO", name: "TCS", marketCap: 1e9, currency: "INR" }]));
        FinancialStatement.distinct.mockResolvedValue(["TCS.BO"]);
        analysisService.calculateAnalysis.mockResolvedValue(healthyAnalysis(80));
        ratioService.getRatiosByTicker.mockResolvedValue({ ratios: {} });

        const result = await screenerService.runScreener(baseCriteria);

        expect(result.companies.map((c) => c.ticker)).toEqual(["TCS.BO"]);
        expect(rateSpy).not.toHaveBeenCalled();
    });

    it("caches a scored company so a second run within TTL doesn't recompute it", async () => {
        Company.find.mockReturnValue(chainableSelectLimitLean([{ ticker: "AAPL", name: "Apple", marketCap: 1e9, currency: "USD" }]));
        FinancialStatement.distinct.mockResolvedValue(["AAPL"]);
        analysisService.calculateAnalysis.mockResolvedValue(healthyAnalysis(85));
        ratioService.getRatiosByTicker.mockResolvedValue({ ratios: {} });

        await screenerService.runScreener(baseCriteria);
        await screenerService.runScreener(baseCriteria);

        expect(analysisService.calculateAnalysis).toHaveBeenCalledTimes(1);
    });
});

describe("getFacets", () => {
    it("returns sorted, deduplicated sector/industry values with nulls excluded", async () => {
        Company.distinct.mockImplementation((field) =>
            Promise.resolve(field === "sector" ? ["Technology", "Basic Materials"] : ["Software - Application", "Steel"])
        );

        const result = await screenerService.getFacets();

        expect(result).toEqual({
            sectors: ["Basic Materials", "Technology"],
            industries: ["Software - Application", "Steel"],
        });
        expect(Company.distinct).toHaveBeenCalledWith("sector", { sector: { $ne: null } });
        expect(Company.distinct).toHaveBeenCalledWith("industry", { industry: { $ne: null } });
    });

    it("caches the result so a second call within TTL doesn't re-query", async () => {
        Company.distinct.mockResolvedValue([]);

        await screenerService.getFacets();
        await screenerService.getFacets();

        expect(Company.distinct).toHaveBeenCalledTimes(2); // one call each for sector + industry, on the FIRST getFacets() only
    });
});
