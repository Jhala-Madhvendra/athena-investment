jest.mock("../holding.model", () => ({ find: jest.fn() }));
jest.mock("../portfolio.service", () => ({ getPortfolio: jest.fn() }));
jest.mock("../../models/company.model", () => ({ find: jest.fn() }));
jest.mock("../../market/market.service", () => ({ getHistoricalPrices: jest.fn(), getCurrentMarketData: jest.fn() }));
jest.mock("../../services/company.service", () => ({ resolveTicker: jest.fn() }));
jest.mock("../../valuation/providers/riskFreeRate.provider", () => ({ getRiskFreeRate: jest.fn() }));
jest.mock("../portfolioHistory.service", () => ({
    buildTransactionAwareReturnSeries: jest.fn(),
    getTransactionsVersion: jest.fn(),
}));

const Holding = require("../holding.model");
const Company = require("../../models/company.model");
const portfolioService = require("../portfolio.service");
const marketService = require("../../market/market.service");
const companyService = require("../../services/company.service");
const riskFreeRateProvider = require("../../valuation/providers/riskFreeRate.provider");
const portfolioHistoryService = require("../portfolioHistory.service");
const portfolioAnalyticsService = require("../portfolio.analytics.service");

/** No transaction ledger for this user - every pre-existing test exercises the legacy "today's weights backward" fallback, matching Sprint 14 behavior exactly. Transaction-aware-specific behavior is covered in its own describe block below. */
const NO_TRANSACTION_HISTORY = { available: false, reason: "No transaction history recorded for this user - cannot reconstruct historical holdings.", series: [] };

const chainableSelectLean = (docs) => ({ select: jest.fn(() => ({ lean: jest.fn(() => Promise.resolve(docs)) })) });

/** N ascending trading-day bars with a mildly noisy close price, seeded so two tickers built from different seeds aren't perfectly correlated. */
const buildBars = (count, seed) =>
    Array.from({ length: count }, (_, i) => ({
        date: new Date(2025, 0, i + 1).toISOString().slice(0, 10),
        close: 100 + i * 0.5 + Math.sin(i * seed) * 3,
    }));

const holdingRow = (ticker, shares = 10, price = 100, date = "2025-01-01T00:00:00.000Z") => ({
    ticker,
    shares,
    averagePurchasePrice: price,
    purchaseDate: { toISOString: () => date },
});

const enrichedHolding = (ticker, currentValue, costBasis = 1000) => ({
    ticker,
    shares: 10,
    averagePurchasePrice: costBasis / 10,
    currentPrice: currentValue / 10,
    costBasis,
    currentValue,
    costBasisUSD: costBasis, // USD-currency fixture (rate 1) - see fxRate.provider.test.js/portfolio.calculator.test.js for currency-conversion coverage
    currentValueUSD: currentValue,
    gainLoss: currentValue - costBasis,
    returnPercent: ((currentValue - costBasis) / costBasis) * 100,
    priceUnavailable: false,
    fxRateUnavailable: false,
    currency: "USD",
});

beforeEach(() => {
    portfolioHistoryService.buildTransactionAwareReturnSeries.mockResolvedValue(NO_TRANSACTION_HISTORY);
    portfolioHistoryService.getTransactionsVersion.mockResolvedValue("none");
});

afterEach(() => {
    jest.clearAllMocks();
    portfolioAnalyticsService._resetCache();
});

describe("getPortfolioAnalytics - empty portfolio", () => {
    it("returns an empty-state payload without calling the market service", async () => {
        Holding.find.mockReturnValue(chainableSelectLean([]));
        portfolioService.getPortfolio.mockResolvedValue({ holdings: [], summary: { totalCurrentValue: 0, unpricedHoldings: [] } });

        const result = await portfolioAnalyticsService.getPortfolioAnalytics("user1", { window: "1y", benchmark: null });

        expect(result.isEmpty).toBe(true);
        expect(result.message).toMatch(/Add holdings/);
        expect(result.correlation.available).toBe(false);
        expect(marketService.getHistoricalPrices).not.toHaveBeenCalled();
    });
});

describe("getPortfolioAnalytics - populated portfolio", () => {
    const setUpTwoHoldingPortfolio = () => {
        Holding.find.mockReturnValue(chainableSelectLean([holdingRow("AAPL"), holdingRow("MSFT")]));
        portfolioService.getPortfolio.mockResolvedValue({
            holdings: [enrichedHolding("AAPL", 6000), enrichedHolding("MSFT", 4000)],
            summary: { totalCurrentValue: 10000, totalReturnPercent: 25, unpricedHoldings: [] },
        });
        Company.find.mockReturnValue(
            chainableSelectLean([
                { ticker: "AAPL", sector: "Technology", industry: "Consumer Electronics", exchange: "NASDAQ" },
                { ticker: "MSFT", sector: "Technology", industry: "Software", exchange: "NASDAQ" },
            ])
        );
        marketService.getHistoricalPrices.mockImplementation((ticker) =>
            Promise.resolve(buildBars(30, ticker === "AAPL" ? 0.3 : 0.7))
        );
        marketService.getCurrentMarketData.mockImplementation((ticker) =>
            Promise.resolve({ riskMetrics: { beta: ticker === "AAPL" ? 1.2 : 0.9 } })
        );
        companyService.resolveTicker.mockResolvedValue("SPY");
        riskFreeRateProvider.getRiskFreeRate.mockResolvedValue(0.04);
    };

    it("computes performance, risk, exposure, concentration, and correlation", async () => {
        setUpTwoHoldingPortfolio();

        const result = await portfolioAnalyticsService.getPortfolioAnalytics("user1", { window: "1y", benchmark: null });

        expect(result.isEmpty).toBe(false);
        expect(result.performance.unrealizedReturnPercent).toBe(25);
        expect(typeof result.risk.volatilityPercent).toBe("number");
        expect(result.risk.beta).toBeCloseTo(0.6 * 1.2 + 0.4 * 0.9, 5);
        expect(result.sectorExposure[0]).toMatchObject({ label: "Technology", weightPercent: 100 });
        expect(result.concentration.top1WeightPercent).toBe(60);
        expect(result.correlation.available).toBe(true);
        expect(result.correlation.tickers).toEqual(["AAPL", "MSFT"]);
        expect(result.assumptions.benchmark.source).toBe("auto");
        expect(result.assumptions.riskFreeRate.value).toBe(0.04);
        expect(result.assumptions.riskFreeRate.source).toBe("market");
    });

    it("labels a fallback risk-free rate as illustrative_default when the live rate is unavailable", async () => {
        setUpTwoHoldingPortfolio();
        riskFreeRateProvider.getRiskFreeRate.mockResolvedValue(null);

        const result = await portfolioAnalyticsService.getPortfolioAnalytics("user1", { window: "1y", benchmark: null });

        expect(result.assumptions.riskFreeRate.source).toBe("illustrative_default");
        expect(result.assumptions.riskFreeRate.value).toBe(portfolioAnalyticsService.ILLUSTRATIVE_RISK_FREE_RATE);
    });

    it("degrades gracefully when the benchmark can't be resolved, without failing the request", async () => {
        setUpTwoHoldingPortfolio();
        companyService.resolveTicker.mockResolvedValue(null);

        const result = await portfolioAnalyticsService.getPortfolioAnalytics("user1", { window: "1y", benchmark: null });

        expect(result.isEmpty).toBe(false);
        expect(result.performance.benchmark.resolved).toBe(false);
        expect(result.performance.benchmark.periodReturnPercent).toBeNull();
    });

    it("uses an explicit benchmark override instead of auto-detecting one", async () => {
        setUpTwoHoldingPortfolio();
        companyService.resolveTicker.mockResolvedValue("NIFTYBEES.NS");

        const result = await portfolioAnalyticsService.getPortfolioAnalytics("user1", { window: "1y", benchmark: "NIFTYBEES.NS" });

        expect(companyService.resolveTicker).toHaveBeenCalledWith("NIFTYBEES.NS");
        expect(result.assumptions.benchmark.source).toBe("user");
    });

    it("auto-selects the NSE/BSE benchmark when the majority of portfolio value is on those exchanges", async () => {
        Holding.find.mockReturnValue(chainableSelectLean([holdingRow("RELIANCE.NS"), holdingRow("MSFT")]));
        portfolioService.getPortfolio.mockResolvedValue({
            holdings: [enrichedHolding("RELIANCE.NS", 8000), enrichedHolding("MSFT", 2000)],
            summary: { totalCurrentValue: 10000, totalReturnPercent: 10, unpricedHoldings: [] },
        });
        Company.find.mockReturnValue(
            chainableSelectLean([
                { ticker: "RELIANCE.NS", sector: "Energy", industry: "Oil & Gas", exchange: "NSE" },
                { ticker: "MSFT", sector: "Technology", industry: "Software", exchange: "NASDAQ" },
            ])
        );
        marketService.getHistoricalPrices.mockImplementation((ticker) => Promise.resolve(buildBars(30, 0.4)));
        marketService.getCurrentMarketData.mockResolvedValue({ riskMetrics: { beta: 1 } });
        companyService.resolveTicker.mockImplementation((ticker) => Promise.resolve(ticker));
        riskFreeRateProvider.getRiskFreeRate.mockResolvedValue(0.04);

        const result = await portfolioAnalyticsService.getPortfolioAnalytics("user1", { window: "1y", benchmark: null });

        expect(companyService.resolveTicker).toHaveBeenCalledWith("NIFTYBEES.NS");
        expect(result.assumptions.benchmark.ticker).toBe("NIFTYBEES.NS");
    });

    it("reports correlation as unavailable for a single-holding portfolio", async () => {
        Holding.find.mockReturnValue(chainableSelectLean([holdingRow("AAPL")]));
        portfolioService.getPortfolio.mockResolvedValue({
            holdings: [enrichedHolding("AAPL", 10000)],
            summary: { totalCurrentValue: 10000, totalReturnPercent: 0, unpricedHoldings: [] },
        });
        Company.find.mockReturnValue(chainableSelectLean([{ ticker: "AAPL", sector: "Technology", industry: "Consumer Electronics", exchange: "NASDAQ" }]));
        marketService.getHistoricalPrices.mockResolvedValue(buildBars(30, 0.3));
        marketService.getCurrentMarketData.mockResolvedValue({ riskMetrics: { beta: 1.2 } });
        companyService.resolveTicker.mockResolvedValue("SPY");
        riskFreeRateProvider.getRiskFreeRate.mockResolvedValue(0.04);

        const result = await portfolioAnalyticsService.getPortfolioAnalytics("user1", { window: "1y", benchmark: null });

        expect(result.correlation.available).toBe(false);
        expect(result.correlation.reason).toMatch(/at least two holdings/);
        expect(result.risk.beta).toBeCloseTo(1.2, 5);
    });
});

describe("getPortfolioAnalytics - transaction-aware historical methodology", () => {
    const setUpSingleHoldingPortfolio = () => {
        Holding.find.mockReturnValue(chainableSelectLean([holdingRow("AAPL")]));
        portfolioService.getPortfolio.mockResolvedValue({
            holdings: [enrichedHolding("AAPL", 10000)],
            summary: { totalCurrentValue: 10000, totalReturnPercent: 0, unpricedHoldings: [] },
        });
        Company.find.mockReturnValue(chainableSelectLean([{ ticker: "AAPL", sector: "Technology", industry: "Consumer Electronics", exchange: "NASDAQ" }]));
        marketService.getHistoricalPrices.mockResolvedValue(buildBars(30, 0.3));
        marketService.getCurrentMarketData.mockResolvedValue({ riskMetrics: { beta: 1.2 } });
        companyService.resolveTicker.mockResolvedValue("SPY");
        riskFreeRateProvider.getRiskFreeRate.mockResolvedValue(0.04);
    };

    /** A reconstructed series long enough to clear MIN_OBSERVATIONS_FOR_SERIES (10). */
    const sufficientTransactionAwareSeries = Array.from({ length: 15 }, (_, i) => ({
        date: new Date(2025, 0, i + 1).toISOString().slice(0, 10),
        return: 0.001 * (i % 3 === 0 ? -1 : 1),
    }));

    it("uses the transaction-aware series and labels it as such when it has enough observations", async () => {
        setUpSingleHoldingPortfolio();
        portfolioHistoryService.buildTransactionAwareReturnSeries.mockResolvedValue({
            available: true,
            reason: null,
            series: sufficientTransactionAwareSeries,
            analyticsStartDate: "2025-01-01",
            windowClipped: false,
            excludedTransactionDays: 2,
            excludedMissingPriceDays: 0,
            excludedZeroValueDays: 0,
            tickersInvolved: ["AAPL"],
        });

        const result = await portfolioAnalyticsService.getPortfolioAnalytics("user1", { window: "1y", benchmark: null });

        expect(result.assumptions.historicalMethodology.type).toBe("transaction_aware");
        expect(result.assumptions.historicalMethodology.analyticsStartDate).toBe("2025-01-01");
        expect(result.assumptions.historicalMethodology.excludedTransactionDays).toBe(2);
        expect(result.assumptions.historicalWeightMethodology).toMatch(/actual recorded transaction history/);
        expect(result.performance.observedTradingDays).toBe(sufficientTransactionAwareSeries.length);
    });

    it("falls back to the legacy current-weights methodology when the transaction-aware series is too thin, and says why", async () => {
        setUpSingleHoldingPortfolio();
        portfolioHistoryService.buildTransactionAwareReturnSeries.mockResolvedValue({
            available: true,
            reason: null,
            series: [{ date: "2025-01-02", return: 0.01 }], // only 1 observation - below MIN_OBSERVATIONS_FOR_SERIES
            analyticsStartDate: "2025-01-01",
            windowClipped: false,
            excludedTransactionDays: 0,
            excludedMissingPriceDays: 0,
            excludedZeroValueDays: 0,
            tickersInvolved: ["AAPL"],
        });

        const result = await portfolioAnalyticsService.getPortfolioAnalytics("user1", { window: "1y", benchmark: null });

        expect(result.assumptions.historicalMethodology.type).toBe("current_weights_backward");
        expect(result.assumptions.historicalMethodology.transactionHistoryAvailable).toBe(true);
        expect(result.assumptions.historicalMethodology.reason).toMatch(/only produced 1 usable observation/);
        expect(result.assumptions.historicalWeightMethodology).toMatch(/not a reconstruction/);
    });

    it("falls back to the legacy methodology when the user has no transaction ledger at all", async () => {
        setUpSingleHoldingPortfolio();
        // beforeEach's default (NO_TRANSACTION_HISTORY) already applies - asserting it explicitly here.
        const result = await portfolioAnalyticsService.getPortfolioAnalytics("user1", { window: "1y", benchmark: null });

        expect(result.assumptions.historicalMethodology.type).toBe("current_weights_backward");
        expect(result.assumptions.historicalMethodology.transactionHistoryAvailable).toBe(false);
    });
});

describe("getPortfolioAnalytics - caching", () => {
    const setUp = () => {
        Holding.find.mockReturnValue(chainableSelectLean([holdingRow("AAPL")]));
        portfolioService.getPortfolio.mockResolvedValue({
            holdings: [enrichedHolding("AAPL", 10000)],
            summary: { totalCurrentValue: 10000, totalReturnPercent: 0, unpricedHoldings: [] },
        });
        Company.find.mockReturnValue(chainableSelectLean([{ ticker: "AAPL", sector: "Technology", industry: "Consumer Electronics", exchange: "NASDAQ" }]));
        marketService.getHistoricalPrices.mockResolvedValue(buildBars(30, 0.3));
        marketService.getCurrentMarketData.mockResolvedValue({ riskMetrics: { beta: 1.2 } });
        companyService.resolveTicker.mockResolvedValue("SPY");
        riskFreeRateProvider.getRiskFreeRate.mockResolvedValue(0.04);
    };

    it("serves a second identical request from cache without re-fetching historical prices", async () => {
        setUp();

        await portfolioAnalyticsService.getPortfolioAnalytics("userCache1", { window: "1y", benchmark: null });
        const callsAfterFirst = marketService.getHistoricalPrices.mock.calls.length;
        await portfolioAnalyticsService.getPortfolioAnalytics("userCache1", { window: "1y", benchmark: null });

        expect(marketService.getHistoricalPrices.mock.calls.length).toBe(callsAfterFirst);
    });

    it("never shares one user's cached analytics with another user", async () => {
        setUp();

        await portfolioAnalyticsService.getPortfolioAnalytics("userA", { window: "1y", benchmark: null });
        const callsAfterFirst = marketService.getHistoricalPrices.mock.calls.length;
        await portfolioAnalyticsService.getPortfolioAnalytics("userB", { window: "1y", benchmark: null });

        expect(marketService.getHistoricalPrices.mock.calls.length).toBeGreaterThan(callsAfterFirst);
    });

    it("busts the cache when the user's holdings change", async () => {
        setUp();
        await portfolioAnalyticsService.getPortfolioAnalytics("userChanging", { window: "1y", benchmark: null });
        const callsAfterFirst = marketService.getHistoricalPrices.mock.calls.length;

        Holding.find.mockReturnValue(chainableSelectLean([holdingRow("AAPL", 20)])); // shares changed: 10 -> 20
        portfolioService.getPortfolio.mockResolvedValue({
            holdings: [enrichedHolding("AAPL", 10000)],
            summary: { totalCurrentValue: 10000, totalReturnPercent: 0, unpricedHoldings: [] },
        });

        await portfolioAnalyticsService.getPortfolioAnalytics("userChanging", { window: "1y", benchmark: null });

        expect(marketService.getHistoricalPrices.mock.calls.length).toBeGreaterThan(callsAfterFirst);
    });

    it("busts the cache when the user's transaction ledger changes, even with holdings unchanged", async () => {
        setUp();
        portfolioHistoryService.getTransactionsVersion.mockResolvedValue("v1");
        await portfolioAnalyticsService.getPortfolioAnalytics("userTxnChanging", { window: "1y", benchmark: null });
        const callsAfterFirst = marketService.getHistoricalPrices.mock.calls.length;

        portfolioHistoryService.getTransactionsVersion.mockResolvedValue("v2"); // a transaction was added/edited/deleted
        await portfolioAnalyticsService.getPortfolioAnalytics("userTxnChanging", { window: "1y", benchmark: null });

        expect(marketService.getHistoricalPrices.mock.calls.length).toBeGreaterThan(callsAfterFirst);
    });
});
