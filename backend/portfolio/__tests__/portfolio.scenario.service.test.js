jest.mock("../portfolio.service", () => ({ getPortfolio: jest.fn() }));
jest.mock("../../models/company.model", () => ({ find: jest.fn() }));
jest.mock("../../market/market.service", () => ({ getCurrentMarketData: jest.fn() }));
jest.mock("../portfolio.analytics.service", () => ({ getPortfolioAnalytics: jest.fn() }));

const portfolioService = require("../portfolio.service");
const Company = require("../../models/company.model");
const marketService = require("../../market/market.service");
const portfolioAnalyticsService = require("../portfolio.analytics.service");
const scenarioService = require("../portfolio.scenario.service");

const chainableSelectLean = (docs) => ({ select: jest.fn(() => ({ lean: jest.fn(() => Promise.resolve(docs)) })) });

/** A holding shape compatible with portfolio.calculator.js's groupByTicker (what portfolio.service.getPortfolio actually returns per lot). */
const lot = (ticker, currentValueUSD, costBasisUSD = 1000) => ({
    ticker,
    shares: 10,
    costBasis: costBasisUSD,
    currentValue: currentValueUSD,
    costBasisUSD,
    currentValueUSD,
    priceUnavailable: false,
    fxRateUnavailable: false,
});

const mockCompanies = (rows) => Company.find.mockReturnValue(chainableSelectLean(rows));
const mockQuote = (ticker, beta) =>
    marketService.getCurrentMarketData.mockImplementation((t) => (t === ticker ? Promise.resolve({ riskMetrics: { beta } }) : Promise.resolve(null)));

afterEach(() => {
    jest.clearAllMocks();
});

describe("runScenario - empty portfolio", () => {
    it("returns a zeroed-out response without calling Company/marketService", async () => {
        portfolioService.getPortfolio.mockResolvedValue({ holdings: [] });

        const result = await scenarioService.runScenario("user1", {
            name: "Bear",
            rules: [{ targetType: "PORTFOLIO", target: null, shockPercent: -10 }],
            benchmark: null,
            window: "1y",
            sensitivity: null,
        });

        expect(result.currentPortfolioValueUSD).toBe(0);
        expect(result.historicalContext.available).toBe(false);
        expect(Company.find).not.toHaveBeenCalled();
    });
});

describe("runScenario - single asset shock", () => {
    it("computes portfolio impact for one holding and attaches historical context + assumptions", async () => {
        portfolioService.getPortfolio.mockResolvedValue({ holdings: [lot("AAPL", 200000)] });
        mockCompanies([{ ticker: "AAPL", sector: "Technology", industry: "Consumer Electronics" }]);
        mockQuote("AAPL", 1.2);
        portfolioAnalyticsService.getPortfolioAnalytics.mockResolvedValue({
            isEmpty: false,
            window: "1 Year",
            risk: { volatilityPercent: 18.4, beta: 1.2, maxDrawdown: { maxDrawdownPercent: -24 } },
            performance: { benchmark: { ticker: "SPY" } },
        });

        const result = await scenarioService.runScenario("user1", {
            name: "AAPL Crash",
            rules: [{ targetType: "ASSET", target: "AAPL", shockPercent: -30 }],
            benchmark: null,
            window: "1y",
            sensitivity: null,
        });

        expect(result.currentPortfolioValueUSD).toBe(200000);
        expect(result.scenarioPortfolioValueUSD).toBe(140000);
        expect(result.absoluteChangeUSD).toBe(-60000);
        expect(result.holdingImpact[0].ticker).toBe("AAPL");
        expect(result.holdingImpact[0].appliedRule.targetType).toBe("ASSET");

        expect(result.historicalContext.available).toBe(true);
        expect(result.historicalContext.maxDrawdown.maxDrawdownPercent).toBe(-24);

        expect(result.assumptions.scenarioName).toBe("AAPL Crash");
        expect(result.assumptions.methodologyNotes.some((note) => note.includes("hypothetical"))).toBe(true);
    });

    it("never lets historical context change the scenario's own numbers", async () => {
        portfolioService.getPortfolio.mockResolvedValue({ holdings: [lot("AAPL", 100000)] });
        mockCompanies([{ ticker: "AAPL", sector: "Technology", industry: "Consumer Electronics" }]);
        mockQuote("AAPL", 1.0);
        // Deliberately different historical numbers from the -20% the user entered.
        portfolioAnalyticsService.getPortfolioAnalytics.mockResolvedValue({
            isEmpty: false,
            window: "1 Year",
            risk: { volatilityPercent: 12, beta: 0.8, maxDrawdown: { maxDrawdownPercent: -11 } },
            performance: { benchmark: { ticker: "SPY" } },
        });

        const result = await scenarioService.runScenario("user1", {
            name: "Tech Shock",
            rules: [{ targetType: "SECTOR", target: "Technology", shockPercent: -20 }],
            benchmark: null,
            window: "1y",
            sensitivity: null,
        });

        expect(result.percentageChange).toBeCloseTo(-20, 6); // exactly what the user entered, not -11
    });
});

describe("runScenario - market shock uses per-holding beta, portfolio beta surfaced in assumptions", () => {
    it("scales the market shock by each holding's beta and reports portfolio beta in assumptions", async () => {
        portfolioService.getPortfolio.mockResolvedValue({ holdings: [lot("AAPL", 100000)] });
        mockCompanies([{ ticker: "AAPL", sector: "Technology", industry: "Consumer Electronics" }]);
        mockQuote("AAPL", 1.18);
        portfolioAnalyticsService.getPortfolioAnalytics.mockResolvedValue({ isEmpty: true });

        const result = await scenarioService.runScenario("user1", {
            name: "Market Shock",
            rules: [{ targetType: "MARKET", target: null, shockPercent: -20 }],
            benchmark: "SPY",
            window: "1y",
            sensitivity: null,
        });

        expect(result.percentageChange).toBeCloseTo(1.18 * -20, 4);
        expect(result.assumptions.betaUsed).toBeCloseTo(1.18, 4);
    });
});

describe("runScenario - sensitivity", () => {
    it("re-runs the calculator once per requested shock value for the targeted rule only", async () => {
        portfolioService.getPortfolio.mockResolvedValue({ holdings: [lot("AAPL", 100000)] });
        mockCompanies([{ ticker: "AAPL", sector: "Technology", industry: "Consumer Electronics" }]);
        mockQuote("AAPL", 1);
        portfolioAnalyticsService.getPortfolioAnalytics.mockResolvedValue({ isEmpty: true });

        const result = await scenarioService.runScenario("user1", {
            name: "Sensitivity",
            rules: [{ targetType: "SECTOR", target: "Technology", shockPercent: -20 }],
            benchmark: null,
            window: "1y",
            sensitivity: { targetType: "SECTOR", target: "Technology", shockValues: [-10, -20, -30] },
        });

        expect(result.sensitivity).toHaveLength(3);
        expect(result.sensitivity[0]).toEqual(
            expect.objectContaining({ shockPercent: -10, scenarioPortfolioValueUSD: 90000, absoluteChangeUSD: -10000 })
        );
        expect(result.sensitivity[2]).toEqual(
            expect.objectContaining({ shockPercent: -30, scenarioPortfolioValueUSD: 70000, absoluteChangeUSD: -30000 })
        );
    });
});

describe("compareScenarios", () => {
    it("fetches portfolio/company context exactly once regardless of scenario count", async () => {
        portfolioService.getPortfolio.mockResolvedValue({ holdings: [lot("AAPL", 100000), lot("JPM", 100000)] });
        mockCompanies([
            { ticker: "AAPL", sector: "Technology", industry: "Consumer Electronics" },
            { ticker: "JPM", sector: "Financial Services", industry: "Banks" },
        ]);
        marketService.getCurrentMarketData.mockImplementation((ticker) =>
            Promise.resolve({ riskMetrics: { beta: ticker === "AAPL" ? 1.2 : 1.0 } })
        );
        portfolioAnalyticsService.getPortfolioAnalytics.mockResolvedValue({ isEmpty: true });

        const result = await scenarioService.compareScenarios("user1", {
            scenarios: [
                { name: "Bear", rules: [{ targetType: "MARKET", target: null, shockPercent: -15 }] },
                { name: "Base", rules: [{ targetType: "PORTFOLIO", target: null, shockPercent: 0 }] },
                { name: "Bull", rules: [{ targetType: "MARKET", target: null, shockPercent: 10 }] },
            ],
            benchmark: null,
            window: "1y",
        });

        expect(portfolioService.getPortfolio).toHaveBeenCalledTimes(1);
        expect(Company.find).toHaveBeenCalledTimes(1);
        expect(result.scenarios).toHaveLength(3);
        expect(result.comparisonTable).toEqual([
            expect.objectContaining({ name: "Bear" }),
            expect.objectContaining({ name: "Base", absoluteChangeUSD: 0 }),
            expect.objectContaining({ name: "Bull" }),
        ]);
        // Largest modeled impact, not a "worst"/"best investment" label - the service returns raw numbers only, no ranking verdict.
        expect(result).not.toHaveProperty("bestScenario");
    });
});

describe("getPresets", () => {
    it("returns Bear/Base/Bull among the presets, each labeled hypothetical", () => {
        const { presets } = scenarioService.getPresets();
        const keys = presets.map((p) => p.key);

        expect(keys).toEqual(expect.arrayContaining(["bear", "base", "bull"]));
        presets.forEach((preset) => {
            expect(preset.isHypothetical).toBe(true);
            expect(preset.rules.length).toBeGreaterThan(0);
        });
    });
});
