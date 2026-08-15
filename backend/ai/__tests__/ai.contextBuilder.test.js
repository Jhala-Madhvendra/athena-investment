jest.mock("../../services/company.service", () => ({ getCompanyDetails: jest.fn() }));
jest.mock("../../ratio/ratio.service", () => ({ getRatiosByTicker: jest.fn() }));
jest.mock("../../analysis/analysis.service", () => ({ calculateAnalysis: jest.fn() }));
jest.mock("../../market/market.service", () => ({
    getCurrentMarketData: jest.fn(),
    getPerformance: jest.fn(),
}));
jest.mock("../../valuation/valuation.service", () => ({
    getDCFDefaults: jest.fn(),
    calculateDCFValuation: jest.fn(),
}));
jest.mock("../../valuation/comps/comps.service", () => ({ calculateComparableCompanyAnalysis: jest.fn() }));
jest.mock("../../valuation/comps/comps.peerSelector", () => ({ getAvailablePeerCandidates: jest.fn() }));
jest.mock("../../news/news.service", () => ({ getRecentArticlesForContext: jest.fn() }));

const companyService = require("../../services/company.service");
const ratioService = require("../../ratio/ratio.service");
const analysisService = require("../../analysis/analysis.service");
const marketService = require("../../market/market.service");
const valuationService = require("../../valuation/valuation.service");
const compsService = require("../../valuation/comps/comps.service");
const compsPeerSelector = require("../../valuation/comps/comps.peerSelector");
const newsService = require("../../news/news.service");

const { buildResearchContext, buildEvidenceAllowList } = require("../ai.contextBuilder");

const ratioLeaf = (value) => ({ label: "x", value, unit: "ratio", available: value !== null });

const COMPANY = {
    name: "Apple Inc.",
    ticker: "AAPL",
    sector: "Technology",
    industry: "Consumer Electronics",
    exchange: "NASDAQ",
    country: "US",
    currency: "USD",
    marketCap: 3_000_000_000_000,
    description: "A".repeat(400),
};

const RATIOS = {
    ticker: "AAPL",
    year: 2024,
    ratios: {
        profitability: {
            grossMargin: ratioLeaf(0.461),
            operatingMargin: ratioLeaf(0.312),
            netProfitMargin: ratioLeaf(0.264),
            returnOnEquity: ratioLeaf(1.51),
            returnOnAssets: ratioLeaf(0.28),
        },
        liquidity: { currentRatio: ratioLeaf(0.95), quickRatio: ratioLeaf(0.83) },
        solvency: { debtToEquity: ratioLeaf(1.87), debtRatio: ratioLeaf(0.42) },
        cashFlow: { freeCashFlow: ratioLeaf(99_000_000_000) },
        efficiency: { assetTurnover: ratioLeaf(1.07) },
    },
};

const ANALYSIS = {
    ticker: "AAPL",
    period: { startYear: 2020, endYear: 2024, numYears: 5 },
    growth: { revenueCAGR: 0.078, netIncomeCAGR: 0.091, freeCashFlowCAGR: 0.065 },
    trends: {},
    insights: [
        {
            category: "profitMargin",
            categoryLabel: "Profit Margin",
            priority: 1,
            text: "Net margin expanded 3.1pp over 5 years.",
            confidence: "high",
            investorImportance: "high",
            forward: null,
        },
    ],
    healthScore: {
        overall: 78,
        label: "Strong",
        riskLevel: "Low",
        components: { profitability: 85, liquidity: 60, solvency: 70, cashFlow: 88, growth: 75 },
        weights: {},
        explanation: "Solid all-round profile.",
    },
    calculatedAt: "2026-08-11T10:00:00.000Z",
};

const QUOTE = {
    ticker: "AAPL",
    currency: "USD",
    price: {
        current: 227.5,
        previousClose: 225,
        open: 226,
        dayHigh: 228,
        dayLow: 224,
        fiftyTwoWeekHigh: 260.1,
        fiftyTwoWeekLow: 164.1,
        volume: 1000,
        averageVolume: 900,
        marketCap: 3_000_000_000_000,
    },
    valuation: { peRatio: 34.2, forwardPE: 30.1, priceToBook: 48.6, eps: 6.65, forwardEps: 7.1 },
    dividend: { yield: 0.0044, rate: 1.0 },
    riskMetrics: { beta: 1.24 },
    asOf: "2026-08-11T09:30:00.000Z",
};

const PERFORMANCE = { "1M": 2.1, "3M": -4.5, "6M": 8.2, "1Y": 22.4, "5Y": 165.3 };

const dcfDefaults = (overrides = {}) => ({
    ticker: "AAPL",
    latestFiscalYear: 2024,
    suggestedAssumptions: {
        forecastYears: { value: 5, source: "default" },
        revenueGrowth: { value: 0.078, source: "derived" },
        ebitMargin: { value: 0.31, source: "derived" },
        taxRate: { value: 0.15, source: "derived" },
        depreciationPercentRevenue: { value: 0.03, source: "derived" },
        capexPercentRevenue: { value: 0.03, source: "derived" },
        workingCapitalPercentRevenue: { value: 0.02, source: "derived" },
        terminalGrowthRate: { value: 0.025, source: "illustrative_default" },
        ...overrides.suggestedAssumptions,
    },
    waccInputs: {
        riskFreeRate: { value: 0.042, source: "market" },
        beta: { value: 1.24, source: "market" },
        equityRiskPremium: { value: 0.05, source: "illustrative_default" },
        preTaxCostOfDebt: { value: null, source: "required_user_input" },
        ...overrides.waccInputs,
    },
});

const DCF_RESULT = {
    isValid: true,
    intrinsicValuePerShare: 198.4123,
    currentMarketPrice: 227.5,
    upsideDownsidePercent: -12.789,
    waccBreakdown: { costOfEquity: 0.1, afterTaxCostOfDebt: 0.04, marketValueOfEquity: 1, marketValueOfDebt: 1, wacc: 0.09123 },
    calculatedAt: "2026-08-11T10:00:00.000Z",
    disclaimer: "DCF valuation is highly sensitive to assumptions...",
};

const CANDIDATES_RESPONSE = {
    target: { ticker: "AAPL", name: "Apple Inc.", sector: "Technology", industry: "Consumer Electronics", marketCap: 3_000_000_000_000 },
    candidates: [
        { ticker: "MSFT", name: "Microsoft", exchange: "NASDAQ", sector: "Technology", industry: "Software", marketCap: 2_900_000_000_000, revenue: 1, revenueFiscalYear: 2024, hasFinancialStatements: true },
        { ticker: "GOOGL", name: "Alphabet", exchange: "NASDAQ", sector: "Technology", industry: "Internet", marketCap: 1_800_000_000_000, revenue: 1, revenueFiscalYear: 2024, hasFinancialStatements: true },
        { ticker: "META", name: "Meta", exchange: "NASDAQ", sector: "Technology", industry: "Internet", marketCap: 1_200_000_000_000, revenue: 1, revenueFiscalYear: 2024, hasFinancialStatements: true },
        { ticker: "XOM", name: "Exxon", exchange: "NYSE", sector: "Energy", industry: "Oil & Gas", marketCap: 400_000_000_000, revenue: 1, revenueFiscalYear: 2024, hasFinancialStatements: true },
    ],
    limitation: "These are companies already known to Athena...",
};

const COMPS_RESULT = {
    isValid: true,
    ticker: "AAPL",
    statistic: "median",
    peers: [],
    unavailablePeers: [],
    impliedValuations: {
        pe: { isApplicable: true, multiple: "P/E", basis: "equity", impliedValuePerShare: 210.0, upsideDownsidePercent: -7.6, reason: null },
    },
    valuationRange: { low: 190, median: 210, high: 240, methodologiesApplied: ["pe"] },
    marketDataAsOf: "2026-08-11T09:30:00.000Z",
    disclaimer: "Comparable Company Analysis is a relative valuation...",
    calculatedAt: "2026-08-11T10:00:00.000Z",
};

const RECENT_ARTICLES = [
    {
        title: "Apple reports record quarterly earnings",
        description: "Revenue and EPS both ahead of consensus.",
        source: "Reuters",
        publishedAt: "2026-08-10T09:00:00.000Z",
        category: "Earnings",
        url: "https://example.com/apple-earnings",
    },
];

const mockHappyPath = () => {
    companyService.getCompanyDetails.mockResolvedValue(COMPANY);
    ratioService.getRatiosByTicker.mockResolvedValue(RATIOS);
    analysisService.calculateAnalysis.mockResolvedValue(ANALYSIS);
    marketService.getCurrentMarketData.mockResolvedValue(QUOTE);
    marketService.getPerformance.mockResolvedValue(PERFORMANCE);
    valuationService.getDCFDefaults.mockResolvedValue(dcfDefaults());
    valuationService.calculateDCFValuation.mockResolvedValue(DCF_RESULT);
    compsPeerSelector.getAvailablePeerCandidates.mockResolvedValue(CANDIDATES_RESPONSE);
    compsService.calculateComparableCompanyAnalysis.mockResolvedValue(COMPS_RESULT);
    newsService.getRecentArticlesForContext.mockResolvedValue(RECENT_ARTICLES);
};

afterEach(() => {
    jest.clearAllMocks();
});

describe("buildResearchContext - happy path", () => {
    it("assembles every section from the mocked services without inventing values", async () => {
        mockHappyPath();

        const { context, dataFreshness } = await buildResearchContext("aapl");

        expect(context.ticker).toBe("AAPL");
        expect(context.profile).toEqual({
            available: true,
            name: "Apple Inc.",
            ticker: "AAPL",
            sector: "Technology",
            industry: "Consumer Electronics",
            exchange: "NASDAQ",
            country: "US",
            currency: "USD",
            marketCap: 3_000_000_000_000,
            description: "A".repeat(280),
        });

        expect(context.ratios).toEqual({
            available: true,
            asOfYear: 2024,
            profitability: { grossMargin: 0.461, operatingMargin: 0.312, netProfitMargin: 0.264, returnOnEquity: 1.51, returnOnAssets: 0.28 },
            liquidity: { currentRatio: 0.95, quickRatio: 0.83 },
            solvency: { debtToEquity: 1.87, debtRatio: 0.42 },
            cashFlow: { freeCashFlow: 99_000_000_000 },
            efficiency: { assetTurnover: 1.07 },
        });

        expect(context.analysis.available).toBe(true);
        expect(context.analysis.growth).toEqual(ANALYSIS.growth);
        expect(context.analysis.healthScore.overall).toBe(78);
        expect(context.analysis.insights).toEqual([
            { category: "profitMargin", text: ANALYSIS.insights[0].text, confidence: "high", investorImportance: "high" },
        ]);

        expect(context.marketData.available).toBe(true);
        expect(context.marketData.price.current).toBe(227.5);
        expect(context.marketData.performance).toEqual(PERFORMANCE);

        expect(context.dcf).toEqual({
            available: true,
            calculatedAt: DCF_RESULT.calculatedAt,
            intrinsicValuePerShare: 198.4123,
            currentMarketPrice: 227.5,
            upsideDownsidePercent: -12.789,
            wacc: 0.0912,
            terminalGrowthRate: 0.025,
            forecastYears: 5,
            costOfDebtSource: "illustrative_default",
            disclaimer: DCF_RESULT.disclaimer,
        });

        // Illustrative fallback = riskFreeRate (0.042) + 150bps spread = 0.057
        expect(valuationService.calculateDCFValuation).toHaveBeenCalledWith(
            "AAPL",
            expect.objectContaining({ preTaxCostOfDebt: 0.057 })
        );

        expect(context.comps.available).toBe(true);
        // Same-sector (Technology) peers only, ranked by closest market cap to AAPL's 3T: MSFT, GOOGL, META - XOM excluded (different sector).
        expect(context.comps.peersUsed).toEqual(["MSFT", "GOOGL", "META"]);
        expect(compsService.calculateComparableCompanyAnalysis).toHaveBeenCalledWith("AAPL", ["MSFT", "GOOGL", "META"], "median");

        expect(dataFreshness).toEqual({
            marketDataAsOf: QUOTE.asOf,
            financialDataPeriod: ANALYSIS.period,
            dcfCalculatedAt: DCF_RESULT.calculatedAt,
        });

        expect(context.recentEvents).toEqual({
            available: true,
            events: [
                {
                    title: "Apple reports record quarterly earnings",
                    description: "Revenue and EPS both ahead of consensus.",
                    source: "Reuters",
                    publishedAt: "2026-08-10T09:00:00.000Z",
                    category: "Earnings",
                    url: "https://example.com/apple-earnings",
                },
            ],
        });
        expect(newsService.getRecentArticlesForContext).toHaveBeenCalledWith("AAPL", 5);
    });

    it("uses the caller-supplied preTaxCostOfDebt instead of the illustrative fallback", async () => {
        mockHappyPath();

        await buildResearchContext("AAPL", { preTaxCostOfDebt: 0.048 });

        expect(valuationService.calculateDCFValuation).toHaveBeenCalledWith(
            "AAPL",
            expect.objectContaining({ preTaxCostOfDebt: 0.048 })
        );
    });
});

describe("buildResearchContext - partial failure tolerance", () => {
    it("marks only the failing section unavailable, keeping the rest intact", async () => {
        mockHappyPath();
        companyService.getCompanyDetails.mockRejectedValue(new Error("upstream profile lookup failed"));

        const { context } = await buildResearchContext("AAPL");

        expect(context.profile).toEqual({ available: false, reason: "upstream profile lookup failed" });
        expect(context.ratios.available).toBe(true);
        expect(context.marketData.available).toBe(true);
        expect(context.dcf.available).toBe(true);
        expect(context.comps.available).toBe(true);
    });

    it("treats analysis.service's {error, status} return (not a throw) as unavailable", async () => {
        mockHappyPath();
        analysisService.calculateAnalysis.mockResolvedValue({ error: "No financial statements found.", status: 404 });

        const { context } = await buildResearchContext("AAPL");

        expect(context.analysis).toEqual({ available: false, reason: "No financial statements found." });
    });

    it("marks marketData unavailable when the quote fails, but keeps other sections intact", async () => {
        mockHappyPath();
        marketService.getCurrentMarketData.mockRejectedValue(new Error("Company NOPE was not found."));

        const { context } = await buildResearchContext("AAPL");

        expect(context.marketData).toEqual({ available: false, reason: "Company NOPE was not found." });
        expect(context.dcf.available).toBe(true);
    });

    it("keeps marketData available with performance:null when only getPerformance fails", async () => {
        mockHappyPath();
        marketService.getPerformance.mockRejectedValue(new Error("history unavailable"));

        const { context } = await buildResearchContext("AAPL");

        expect(context.marketData.available).toBe(true);
        expect(context.marketData.performance).toBeNull();
    });

    it("marks DCF unavailable (never fabricated) when a company-derived assumption is missing", async () => {
        mockHappyPath();
        valuationService.getDCFDefaults.mockResolvedValue(
            dcfDefaults({ suggestedAssumptions: { revenueGrowth: { value: null, source: "unavailable" } } })
        );

        const { context } = await buildResearchContext("AAPL");

        expect(context.dcf.available).toBe(false);
        expect(context.dcf.reason).toMatch(/revenueGrowth/);
        expect(valuationService.calculateDCFValuation).not.toHaveBeenCalled();
    });

    it("marks DCF unavailable when the engine itself reports invalid assumptions", async () => {
        mockHappyPath();
        valuationService.calculateDCFValuation.mockResolvedValue({ isValid: false, errors: ["Terminal growth rate must be less than WACC."] });

        const { context } = await buildResearchContext("AAPL");

        expect(context.dcf).toEqual({ available: false, reason: "Terminal growth rate must be less than WACC." });
    });

    it("marks recentEvents unavailable (not an error) when no news has been retrieved yet", async () => {
        mockHappyPath();
        newsService.getRecentArticlesForContext.mockResolvedValue([]);

        const { context } = await buildResearchContext("AAPL");

        expect(context.recentEvents).toEqual({
            available: false,
            reason: "No recent news has been retrieved for AAPL yet.",
        });
    });

    it("marks recentEvents unavailable when the news lookup itself throws", async () => {
        mockHappyPath();
        newsService.getRecentArticlesForContext.mockRejectedValue(new Error("DB unavailable"));

        const { context } = await buildResearchContext("AAPL");

        expect(context.recentEvents).toEqual({ available: false, reason: "DB unavailable" });
    });

    it("marks comps unavailable when fewer than 2 usable peers exist", async () => {
        mockHappyPath();
        compsPeerSelector.getAvailablePeerCandidates.mockResolvedValue({
            target: CANDIDATES_RESPONSE.target,
            candidates: [CANDIDATES_RESPONSE.candidates[0]],
            limitation: "...",
        });

        const { context } = await buildResearchContext("AAPL");

        expect(context.comps.available).toBe(false);
        expect(compsService.calculateComparableCompanyAnalysis).not.toHaveBeenCalled();
    });
});

describe("buildEvidenceAllowList", () => {
    it("only includes paths from available sections, excluding structural keys", async () => {
        mockHappyPath();
        companyService.getCompanyDetails.mockRejectedValue(new Error("boom"));

        const { context } = await buildResearchContext("AAPL");
        const allowList = buildEvidenceAllowList(context);

        expect(allowList).toContain("ratios.profitability.grossMargin");
        expect(allowList).toContain("analysis.healthScore.overall");
        expect(allowList).toContain("dcf.intrinsicValuePerShare");
        expect(allowList).toContain("comps.valuationRange.low");
        expect(allowList.some((p) => p.startsWith("profile."))).toBe(false);
        expect(allowList).not.toContain("dcf.available");
    });

    it("includes each recent event's article url, not a dot-path, when recentEvents is available", async () => {
        mockHappyPath();

        const { context } = await buildResearchContext("AAPL");
        const allowList = buildEvidenceAllowList(context);

        expect(allowList).toContain("https://example.com/apple-earnings");
    });

    it("excludes article urls when recentEvents is unavailable", async () => {
        mockHappyPath();
        newsService.getRecentArticlesForContext.mockResolvedValue([]);

        const { context } = await buildResearchContext("AAPL");
        const allowList = buildEvidenceAllowList(context);

        expect(allowList).not.toContain("https://example.com/apple-earnings");
    });
});
