/**
 * Simulation Analytics Service
 *
 * Structurally mirrors portfolio.analytics.service.js's computeAnalytics,
 * sourcing positions from simulation.service.js's getSyntheticPortfolio
 * (a PaperPortfolio doc) instead of the real Holding collection. Reuses the
 * same pure calculators (portfolio.analytics.calculator.js/.risk.js/
 * .exposure.js/.correlation.js) unmodified - this module never recomputes
 * math the real service already implements correctly.
 *
 * TWO DELIBERATE SIMPLIFICATIONS vs. the real service (both intentional,
 * not oversights):
 *
 * 1. NO TRANSACTION-AWARE RECONSTRUCTION. A paper portfolio has no
 *    Transaction ledger, so historicalMethodology is always
 *    `{type: "current_weights_backward", transactionHistoryAvailable: false}`
 *    - performance is estimated by applying today's holding weights
 *    backward over each holding's own historical returns, never
 *    reconstructed from an actual trade history. See
 *    PortfolioCalculationAssumptions.md for what that estimate does and
 *    doesn't claim for the real portfolio equivalent.
 *
 * 2. NO EXCHANGE-WEIGHTED BENCHMARK AUTO-SELECTION. The real service picks
 *    a default benchmark ETF from whichever exchange holds the largest
 *    share of portfolio value (EXCHANGE_BENCHMARK_MAP). This module always
 *    defaults to DEFAULT_BENCHMARK_TICKER (SPY) unless the caller passes an
 *    explicit `benchmark` - both constants are reused, unmodified, from the
 *    real service so the two modules never disagree about what "SPY" or
 *    "the default" means, but the auto-selection heuristic itself isn't
 *    duplicated for what is explicitly a lower-stakes, exploratory tool.
 */

const Company = require("../models/company.model");
const marketService = require("../market/market.service");
const companyService = require("../services/company.service");
const riskFreeRateProvider = require("../valuation/providers/riskFreeRate.provider");
const analyticsCalculator = require("../portfolio/portfolio.analytics.calculator");
const riskCalculator = require("../portfolio/portfolio.analytics.risk");
const exposureCalculator = require("../portfolio/portfolio.analytics.exposure");
const correlationCalculator = require("../portfolio/portfolio.analytics.correlation");
const portfolioCalculator = require("../portfolio/portfolio.calculator");
const { DEFAULT_BENCHMARK_TICKER, ILLUSTRATIVE_RISK_FREE_RATE } = require("../portfolio/portfolio.analytics.service");
const simulationService = require("./simulation.service");

const SIMULATION_ANALYTICS_CACHE_TTL_MS = 5 * 60 * 1000;
const simulationAnalyticsCache = new Map();

const WINDOW_LABELS = { "1m": "1 Month", "3m": "3 Months", "6m": "6 Months", "1y": "1 Year", "5y": "5 Years" };

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

const labeled = (value, source, note) => ({ value: value === undefined ? null : value, source, ...(note ? { note } : {}) });

const emptyCorrelation = (reason) => ({ available: false, reason, tickers: [], matrix: {}, observations: {} });

const HISTORICAL_METHODOLOGY = {
    type: "current_weights_backward",
    transactionHistoryAvailable: false,
    reason:
        "Hypothetical portfolios have no transaction history - performance is always estimated by applying today's holding weights backward over each holding's own historical returns.",
};

const CURRENT_WEIGHTS_METHODOLOGY_NOTE =
    "Historical risk metrics are estimated by applying this what-if portfolio's current weights to each holding's own historical price returns - not a reconstruction of an actual trade history, which a hypothetical portfolio doesn't have.";

const buildAssumptions = ({ window, benchmarkTicker, benchmarkSource, riskFreeRate }) => ({
    analysisPeriod: {
        window,
        label: WINDOW_LABELS[window] || window,
        note: `Based on approximately ${WINDOW_LABELS[window] || window} of historical daily market data.`,
    },
    benchmark: {
        ticker: benchmarkTicker,
        source: benchmarkSource,
        note: benchmarkSource === "default" ? `Defaults to ${DEFAULT_BENCHMARK_TICKER}. Override with ?benchmark=TICKER.` : "User-specified via the benchmark parameter.",
    },
    riskFreeRate,
    historicalMethodology: HISTORICAL_METHODOLOGY,
    historicalWeightMethodology: CURRENT_WEIGHTS_METHODOLOGY_NOTE,
    tradingDaysPerYearAssumption: analyticsCalculator.TRADING_DAYS_PER_YEAR,
    dataFreshness: { generatedAt: new Date().toISOString() },
});

const emptyAnalytics = (window, benchmarkParam, message) => ({
    window: WINDOW_LABELS[window] || window,
    generatedAt: new Date().toISOString(),
    isEmpty: true,
    message,
    performance: null,
    risk: null,
    concentration: null,
    sectorExposure: [],
    industryExposure: [],
    holdings: [],
    correlation: emptyCorrelation(message),
    assumptions: buildAssumptions({ window, benchmarkTicker: benchmarkParam || DEFAULT_BENCHMARK_TICKER, benchmarkSource: "default", riskFreeRate: null }),
});

/** Resolves + fetches the benchmark's own period return/daily returns. Never throws - degrades to an unresolved benchmark, same as the real service. */
const resolveBenchmark = async (candidateTicker, source, window) => {
    try {
        const resolvedTicker = await companyService.resolveTicker(candidateTicker);
        if (!resolvedTicker) {
            return { ticker: candidateTicker, resolved: false, source, periodReturnPercent: null, dailyReturns: [] };
        }

        const bars = await marketService.getHistoricalPrices(resolvedTicker, window);
        const returns = analyticsCalculator.computeDailyReturns(bars);
        const periodReturn = analyticsCalculator.calculatePeriodReturn(returns);

        return {
            ticker: resolvedTicker,
            resolved: true,
            source,
            periodReturnPercent: periodReturn !== null ? periodReturn * 100 : null,
            dailyReturns: returns,
        };
    } catch {
        return { ticker: candidateTicker, resolved: false, source, periodReturnPercent: null, dailyReturns: [] };
    }
};

const computeSyntheticAnalytics = async (paperPortfolioDoc, window, benchmarkParam) => {
    const { holdings, summary } = await simulationService.getSyntheticPortfolio(paperPortfolioDoc);

    if (holdings.length === 0) {
        return emptyAnalytics(window, benchmarkParam, "Add holdings to this what-if portfolio to analyze risk and diversification.");
    }

    const positions = portfolioCalculator.groupByTicker(holdings).map((position) => ({
        ...position,
        weightPercent: position.currentValueUSD !== null && summary.totalCurrentValue > 0 ? (position.currentValueUSD / summary.totalCurrentValue) * 100 : null,
    }));

    const pricedPositions = positions.filter((p) => p.weightPercent !== null);
    const uniqueTickers = pricedPositions.map((p) => p.ticker);

    if (uniqueTickers.length === 0) {
        return emptyAnalytics(window, benchmarkParam, "No holdings currently have a live price - analytics require at least one priced holding.");
    }

    const [historicalEntries, quoteEntries, companies] = await Promise.all([
        Promise.all(uniqueTickers.map(async (ticker) => [ticker, await marketService.getHistoricalPrices(ticker, window).catch(() => [])])),
        Promise.all(uniqueTickers.map(async (ticker) => [ticker, await marketService.getCurrentMarketData(ticker).catch(() => null)])),
        Company.find({ ticker: { $in: uniqueTickers } }).select("ticker sector industry exchange").lean(),
    ]);

    const historicalByTicker = new Map(historicalEntries);
    const quotesByTicker = new Map(quoteEntries);
    const companiesByTicker = new Map(companies.map((c) => [c.ticker, c]));

    const returnsByTicker = {};
    uniqueTickers.forEach((ticker) => {
        returnsByTicker[ticker] = analyticsCalculator.computeDailyReturns(historicalByTicker.get(ticker) || []);
    });

    const weightsByTicker = {};
    pricedPositions.forEach((position) => {
        weightsByTicker[position.ticker] = position.weightPercent / 100;
    });

    const portfolioReturnSeries = analyticsCalculator.buildPortfolioReturnSeries(returnsByTicker, weightsByTicker);
    const periodReturn = analyticsCalculator.calculatePeriodReturn(portfolioReturnSeries);
    const observedTradingDays = portfolioReturnSeries.length;
    const annualizedReturnValue = analyticsCalculator.annualizeReturn(periodReturn, observedTradingDays);
    const volatility = analyticsCalculator.calculateVolatility(portfolioReturnSeries);
    const maxDrawdown = analyticsCalculator.calculateMaxDrawdown(portfolioReturnSeries);

    const liveRiskFreeRate = await riskFreeRateProvider.getRiskFreeRate().catch(() => null);
    const riskFreeRateLabeled = isFiniteNumber(liveRiskFreeRate)
        ? labeled(liveRiskFreeRate, "market", "10-Year US Treasury yield, fetched live from Yahoo Finance (^TNX).")
        : labeled(ILLUSTRATIVE_RISK_FREE_RATE, "illustrative_default", "The live 10-Year US Treasury yield could not be fetched. Using a documented illustrative assumption instead of a fabricated live value.");
    const sharpeRatio = analyticsCalculator.calculateSharpeRatio(annualizedReturnValue, riskFreeRateLabeled.value, volatility);

    const betaResult = riskCalculator.calculatePortfolioBeta(
        pricedPositions.map((p) => ({ ticker: p.ticker, weight: p.weightPercent / 100, beta: quotesByTicker.get(p.ticker)?.riskMetrics?.beta ?? null }))
    );

    const benchmarkCandidate = benchmarkParam || DEFAULT_BENCHMARK_TICKER;
    const benchmarkSource = benchmarkParam ? "user" : "default";
    const resolvedBenchmark = await resolveBenchmark(benchmarkCandidate, benchmarkSource, window);

    const benchmarkCorrelation = resolvedBenchmark.resolved
        ? correlationCalculator.calculatePairwiseCorrelation(portfolioReturnSeries, resolvedBenchmark.dailyReturns)
        : { correlation: null, observations: 0 };
    const benchmark = {
        ticker: resolvedBenchmark.ticker,
        resolved: resolvedBenchmark.resolved,
        source: resolvedBenchmark.source,
        periodReturnPercent: resolvedBenchmark.periodReturnPercent,
        correlation: benchmarkCorrelation.correlation,
        correlationObservations: benchmarkCorrelation.observations,
    };

    const classifyBySector = (ticker) => companiesByTicker.get(ticker)?.sector || null;
    const classifyByIndustry = (ticker) => companiesByTicker.get(ticker)?.industry || null;
    const positionWeights = pricedPositions.map((p) => ({ ticker: p.ticker, weightPercent: p.weightPercent }));

    const sectorExposure = exposureCalculator.groupByClassification(positionWeights, classifyBySector);
    const industryExposure = exposureCalculator.groupByClassification(positionWeights, classifyByIndustry);
    const concentration = exposureCalculator.calculateConcentration(positionWeights);

    const correlation =
        uniqueTickers.length >= 2
            ? { available: true, ...correlationCalculator.calculateCorrelationMatrix(returnsByTicker) }
            : emptyCorrelation("Correlation requires at least two holdings.");

    return {
        window: WINDOW_LABELS[window] || window,
        generatedAt: new Date().toISOString(),
        isEmpty: false,
        performance: {
            unrealizedReturnPercent: summary.totalReturnPercent,
            unrealizedReturnMethodology: "Cost-basis unrealized return: (current value - assumed cost basis) / assumed cost basis, summed across holdings. See PortfolioReturn.md.",
            periodReturnPercent: periodReturn !== null ? periodReturn * 100 : null,
            annualizedReturnPercent: annualizedReturnValue !== null ? annualizedReturnValue * 100 : null,
            periodReturnMethodology: "Estimated by applying this what-if portfolio's current holding weights to each holding's own historical daily returns over the selected window, then compounding.",
            observedTradingDays,
            benchmark,
        },
        risk: {
            volatilityPercent: volatility !== null ? volatility * 100 : null,
            volatilityMethodology: `Annualized standard deviation of estimated daily portfolio returns (daily std dev x sqrt(${analyticsCalculator.TRADING_DAYS_PER_YEAR})).`,
            beta: betaResult.beta,
            betaCoveragePercent: betaResult.coveragePercent,
            betaExcludedTickers: betaResult.excludedTickers,
            betaMethodology: "Weighted average of each holding's own beta (Yahoo Finance), not a regression of portfolio returns against the benchmark.",
            sharpeRatio,
            sharpeMethodology: "(Annualized return - risk-free rate) / annualized volatility.",
            maxDrawdown,
        },
        concentration,
        sectorExposure,
        industryExposure,
        holdings: pricedPositions.map((p) => ({ ticker: p.ticker, valueUSD: p.currentValueUSD, weightPercent: p.weightPercent })),
        unpricedHoldings: summary.unpricedHoldings,
        correlation,
        assumptions: buildAssumptions({ window, benchmarkTicker: benchmark.ticker, benchmarkSource, riskFreeRate: riskFreeRateLabeled }),
    };
};

/** GET /api/simulation/portfolios/:id/analytics - cached per (portfolio, window, benchmark, doc.updatedAt). */
const getSimulationAnalytics = async (userId, portfolioId, { window, benchmark }) => {
    const portfolio = await simulationService.loadOwnedPortfolio(userId, portfolioId);

    if (!portfolio.holdings || portfolio.holdings.length === 0) {
        return emptyAnalytics(window, benchmark, "Add holdings to this what-if portfolio to analyze risk and diversification.");
    }

    const cacheKey = `${userId}:${portfolioId}:${window}:${benchmark || "default"}:${portfolio.updatedAt.toISOString()}`;
    const cached = simulationAnalyticsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
    }

    const data = await computeSyntheticAnalytics(portfolio, window, benchmark);
    simulationAnalyticsCache.set(cacheKey, { data, expiresAt: Date.now() + SIMULATION_ANALYTICS_CACHE_TTL_MS });

    return data;
};

const _resetCache = () => {
    simulationAnalyticsCache.clear();
};

module.exports = {
    getSimulationAnalytics,
    computeSyntheticAnalytics,
    SIMULATION_ANALYTICS_CACHE_TTL_MS,
    _resetCache,
};
