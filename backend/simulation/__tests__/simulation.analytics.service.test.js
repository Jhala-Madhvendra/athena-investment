jest.mock("../simulation.service", () => ({ loadOwnedPortfolio: jest.fn(), getSyntheticPortfolio: jest.fn() }));
jest.mock("../../models/company.model", () => ({ find: jest.fn() }));
jest.mock("../../market/market.service", () => ({ getHistoricalPrices: jest.fn(), getCurrentMarketData: jest.fn() }));
jest.mock("../../services/company.service", () => ({ resolveTicker: jest.fn() }));
jest.mock("../../valuation/providers/riskFreeRate.provider", () => ({ getRiskFreeRate: jest.fn() }));

const Company = require("../../models/company.model");
const marketService = require("../../market/market.service");
const companyService = require("../../services/company.service");
const riskFreeRateProvider = require("../../valuation/providers/riskFreeRate.provider");
const simulationService = require("../simulation.service");
const simulationAnalyticsService = require("../simulation.analytics.service");

const chainableSelectLean = (docs) => ({ select: jest.fn(() => ({ lean: jest.fn(() => Promise.resolve(docs)) })) });

const buildBars = (count, seed) =>
    Array.from({ length: count }, (_, i) => ({
        date: new Date(2025, 0, i + 1).toISOString().slice(0, 10),
        close: 100 + i * 0.5 + Math.sin(i * seed) * 3,
    }));

const enrichedHolding = (ticker, currentValue, costBasis = 1000) => ({
    ticker,
    shares: 10,
    averagePurchasePrice: costBasis / 10,
    currentPrice: currentValue / 10,
    costBasis,
    currentValue,
    costBasisUSD: costBasis,
    currentValueUSD: currentValue,
    gainLoss: currentValue - costBasis,
    returnPercent: ((currentValue - costBasis) / costBasis) * 100,
    priceUnavailable: false,
    fxRateUnavailable: false,
    assumedPriceDefaulted: false,
    currency: "USD",
});

beforeEach(() => {
    riskFreeRateProvider.getRiskFreeRate.mockResolvedValue(0.04);
});

afterEach(() => {
    jest.clearAllMocks();
    simulationAnalyticsService._resetCache();
});

describe("getSimulationAnalytics - empty portfolio", () => {
    it("returns an empty-state payload without calling the market service", async () => {
        simulationService.loadOwnedPortfolio.mockResolvedValue({ _id: "p1", holdings: [], updatedAt: new Date("2026-01-01") });

        const result = await simulationAnalyticsService.getSimulationAnalytics("user1", "p1", { window: "1y", benchmark: null });

        expect(result.isEmpty).toBe(true);
        expect(marketService.getHistoricalPrices).not.toHaveBeenCalled();
    });
});

describe("getSimulationAnalytics - populated portfolio", () => {
    const setUpTwoHoldingPortfolio = () => {
        simulationService.loadOwnedPortfolio.mockResolvedValue({
            _id: "p1",
            holdings: [{ ticker: "AAPL" }, { ticker: "MSFT" }],
            updatedAt: new Date("2026-01-01"),
        });
        simulationService.getSyntheticPortfolio.mockResolvedValue({
            holdings: [enrichedHolding("AAPL", 6000), enrichedHolding("MSFT", 4000)],
            summary: { totalCurrentValue: 10000, totalReturnPercent: 25, unpricedHoldings: [] },
        });
        Company.find.mockReturnValue(
            chainableSelectLean([
                { ticker: "AAPL", sector: "Technology", industry: "Consumer Electronics", exchange: "NASDAQ" },
                { ticker: "MSFT", sector: "Technology", industry: "Software", exchange: "NASDAQ" },
            ])
        );
        marketService.getHistoricalPrices.mockImplementation((ticker) => Promise.resolve(buildBars(60, ticker === "AAPL" ? 1 : 2)));
        marketService.getCurrentMarketData.mockImplementation((ticker) =>
            Promise.resolve({ riskMetrics: { beta: ticker === "AAPL" ? 1.2 : 0.9 } })
        );
        companyService.resolveTicker.mockResolvedValue("SPY");
    };

    it("always reports current_weights_backward - a paper portfolio has no transaction ledger", async () => {
        setUpTwoHoldingPortfolio();

        const result = await simulationAnalyticsService.getSimulationAnalytics("user1", "p1", { window: "1y", benchmark: null });

        expect(result.assumptions.historicalMethodology.type).toBe("current_weights_backward");
        expect(result.assumptions.historicalMethodology.transactionHistoryAvailable).toBe(false);
    });

    it("defaults the benchmark to DEFAULT_BENCHMARK_TICKER without an exchange-weighted auto-selection", async () => {
        setUpTwoHoldingPortfolio();

        const result = await simulationAnalyticsService.getSimulationAnalytics("user1", "p1", { window: "1y", benchmark: null });

        expect(result.performance.benchmark.source).toBe("default");
        expect(companyService.resolveTicker).toHaveBeenCalledWith("SPY");
    });

    it("uses an explicit benchmark override when provided", async () => {
        setUpTwoHoldingPortfolio();

        const result = await simulationAnalyticsService.getSimulationAnalytics("user1", "p1", { window: "1y", benchmark: "QQQ" });

        expect(result.performance.benchmark.source).toBe("user");
        expect(companyService.resolveTicker).toHaveBeenCalledWith("QQQ");
    });

    it("computes concentration and sector exposure from the two holdings", async () => {
        setUpTwoHoldingPortfolio();

        const result = await simulationAnalyticsService.getSimulationAnalytics("user1", "p1", { window: "1y", benchmark: null });

        expect(result.concentration.top1WeightPercent).toBeCloseTo(60, 5);
        expect(result.sectorExposure.find((s) => s.label === "Technology").weightPercent).toBeCloseTo(100, 5);
    });

    it("caches per portfolio+window+benchmark+updatedAt, avoiding a second market fetch", async () => {
        setUpTwoHoldingPortfolio();

        await simulationAnalyticsService.getSimulationAnalytics("user1", "p1", { window: "1y", benchmark: null });
        await simulationAnalyticsService.getSimulationAnalytics("user1", "p1", { window: "1y", benchmark: null });

        expect(simulationService.getSyntheticPortfolio).toHaveBeenCalledTimes(1);
    });

    it("invalidates the cache when the portfolio's updatedAt changes", async () => {
        setUpTwoHoldingPortfolio();
        await simulationAnalyticsService.getSimulationAnalytics("user1", "p1", { window: "1y", benchmark: null });

        simulationService.loadOwnedPortfolio.mockResolvedValue({
            _id: "p1",
            holdings: [{ ticker: "AAPL" }, { ticker: "MSFT" }],
            updatedAt: new Date("2026-02-01"),
        });
        await simulationAnalyticsService.getSimulationAnalytics("user1", "p1", { window: "1y", benchmark: null });

        expect(simulationService.getSyntheticPortfolio).toHaveBeenCalledTimes(2);
    });
});
