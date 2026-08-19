/**
 * Portfolio Analytics Service
 *
 * Orchestrates GET /api/portfolio/analytics: reuses Sprint 9's
 * portfolioService.getPortfolio (holdings + cost basis/value/unrealized
 * return - never recomputed here), fetches each held ticker's historical
 * prices/beta/sector/industry, and hands everything to the pure
 * calculators (portfolio.analytics.calculator.js/.risk.js/.exposure.js/
 * .correlation.js) to produce the analytics payload.
 *
 * HISTORICAL METHODOLOGY (Sprint 15)
 * ------------------------------------
 * Every historical metric here (volatility, Sharpe, drawdown, period
 * return, benchmark correlation) is built from ONE portfolioReturnSeries,
 * sourced from whichever of these two is usable for the request:
 *   1. Transaction-aware (preferred): portfolioHistory.service reconstructs
 *      actual holdings-on-each-date from the user's Transaction ledger and
 *      values them at real historical prices. Used whenever it produces at
 *      least MIN_OBSERVATIONS_FOR_SERIES usable days for the window.
 *   2. Legacy fallback (portfolio.analytics.calculator.js's documented
 *      approximation): TODAY'S weights applied backward over each
 *      holding's own historical returns - used when the user has no
 *      transaction ledger, or too little of one for this window.
 * Which one was used, and why, is always surfaced in
 * `assumptions.historicalMethodology.type` and the human-readable
 * `assumptions.historicalWeightMethodology` string - never silently picked.
 * See PortfolioCalculationAssumptions.md.
 *
 * BENCHMARK
 * ---------
 * Configurable via the `benchmark` query param (a ticker). With no
 * override, the default is auto-selected from the portfolio's own
 * composition: the exchange with the largest share of portfolio value
 * maps to a benchmark ETF via EXCHANGE_BENCHMARK_MAP (falls back to SPY).
 * The benchmark is resolved as an ordinary Company (auto-imported via
 * companyService.resolveTicker if not already known) so it reuses
 * market.service's existing MarketHistory caching - no new provider code.
 * Portfolio Beta itself does NOT depend on the benchmark resolving
 * successfully (see portfolio.analytics.risk.js) - the benchmark is only
 * used to label what beta is measured against and to show its own period
 * return as neutral context. A benchmark that fails to resolve degrades
 * to `null` with a note; it never fails the whole analytics request.
 *
 * CACHING
 * -------
 * Cache key: `${userId}:${window}:${benchmarkParam}:${portfolioVersion}:${transactionsVersion}`.
 * `portfolioVersion` and `transactionsVersion` are cheap deterministic
 * strings built from the raw Holding rows and Transaction rows
 * respectively - either changing (a holding OR a transaction added,
 * edited, or deleted) invalidates the cache, since both now feed the
 * response. TTL on top of that (ANALYTICS_CACHE_TTL_MS) bounds staleness
 * of the underlying market data itself. Always keyed by userId first -
 * never shared across users, unlike market.service's ticker-only quote
 * cache.
 */

const Holding = require("./holding.model");
const Company = require("../models/company.model");
const portfolioService = require("./portfolio.service");
const portfolioCalculator = require("./portfolio.calculator");
const portfolioHistoryService = require("./portfolioHistory.service");
const marketService = require("../market/market.service");
const companyService = require("../services/company.service");
const riskFreeRateProvider = require("../valuation/providers/riskFreeRate.provider");
const analyticsCalculator = require("./portfolio.analytics.calculator");
const riskCalculator = require("./portfolio.analytics.risk");
const exposureCalculator = require("./portfolio.analytics.exposure");
const correlationCalculator = require("./portfolio.analytics.correlation");

const ANALYTICS_CACHE_TTL_MS = 5 * 60 * 1000;
const analyticsCache = new Map();

const DEFAULT_BENCHMARK_TICKER = "SPY";
/** Exchange -> default benchmark ETF, used only when the caller doesn't pass an explicit `benchmark`. Both sides trade as ordinary securities, so they reuse existing Company/MarketHistory machinery with no new provider code. */
const EXCHANGE_BENCHMARK_MAP = { NSE: "NIFTYBEES.NS", BSE: "NIFTYBEES.NS" };

const WINDOW_LABELS = { "1m": "1 Month", "3m": "3 Months", "6m": "6 Months", "1y": "1 Year", "5y": "5 Years" };

/**
 * Not fetched live from anywhere - the DCF flow (dcfInput.mapper.js) only
 * ever labels the live risk-free rate as "unavailable" and leaves it to
 * the user, but Sharpe Ratio needs a number to produce a result at all.
 * Used only when riskFreeRateProvider.getRiskFreeRate() itself returns
 * null, and always labeled "illustrative_default", never "market".
 */
const ILLUSTRATIVE_RISK_FREE_RATE = 0.04;

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

const labeled = (value, source, note) => ({
    value: value === undefined ? null : value,
    source,
    ...(note ? { note } : {}),
});

const emptyCorrelation = (reason) => ({ available: false, reason, tickers: [], matrix: {}, observations: {} });

/** Holdings-only half of the cache key. Combined with the transactions version below - both must be unchanged for a cache hit, since the transaction ledger drives a separate (transaction-aware) part of the response now. */
const buildPortfolioVersion = async (userId) => {
    const rows = await Holding.find({ userId })
        .select("ticker shares averagePurchasePrice purchaseDate -_id")
        .lean();

    if (rows.length === 0) {
        return "empty";
    }

    return rows
        .map((r) => `${r.ticker}:${r.shares}:${r.averagePurchasePrice}:${r.purchaseDate?.toISOString?.() ?? r.purchaseDate}`)
        .sort()
        .join("|");
};

const emptyPortfolioAnalytics = (window, benchmarkParam) => ({
    window: WINDOW_LABELS[window] || window,
    generatedAt: new Date().toISOString(),
    isEmpty: true,
    message: "Add holdings to analyze portfolio risk and diversification.",
    performance: null,
    risk: null,
    concentration: null,
    sectorExposure: [],
    industryExposure: [],
    holdings: [],
    correlation: emptyCorrelation("Add holdings to analyze diversification and correlation."),
    assumptions: buildAssumptions({ window, benchmarkTicker: benchmarkParam || DEFAULT_BENCHMARK_TICKER, benchmarkSource: "default", riskFreeRate: null }),
});

/** Picks the default benchmark from the exchange holding the largest share of portfolio value. Falls back to SPY when there's no clear majority or exchange data is missing. */
const resolveDefaultBenchmarkTicker = (pricedPositions, companiesByTicker) => {
    const weightByExchange = new Map();

    pricedPositions.forEach((position) => {
        const exchange = companiesByTicker.get(position.ticker)?.exchange;
        if (!exchange) return;
        weightByExchange.set(exchange, (weightByExchange.get(exchange) || 0) + (position.weightPercent || 0));
    });

    let topExchange = null;
    let topWeight = 0;
    weightByExchange.forEach((weight, exchange) => {
        if (weight > topWeight) {
            topWeight = weight;
            topExchange = exchange;
        }
    });

    return EXCHANGE_BENCHMARK_MAP[topExchange] || DEFAULT_BENCHMARK_TICKER;
};

/** Resolves + fetches the benchmark's own period return (and daily return series, for correlation) for context. Never throws - any failure degrades to a null/unresolved benchmark rather than failing the whole analytics request, since Beta itself doesn't depend on this succeeding. */
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

const TRANSACTION_AWARE_METHODOLOGY_NOTE =
    "Historical risk metrics are computed from your actual recorded transaction history - holdings are reconstructed on each date from your Transaction ledger, then valued at that date's real historical prices. Days where a BUY/SELL changed your holdings, or a held ticker's price was unavailable, are excluded from the return series rather than estimated. See PortfolioCalculationAssumptions.md.";

const CURRENT_WEIGHTS_METHODOLOGY_NOTE =
    "Historical risk metrics are estimated by applying today's portfolio weights to each holding's own historical price returns - not a reconstruction of this portfolio's actual historical value. Record transactions (POST /api/portfolio/transactions) to switch to transaction-aware reconstruction. See PortfolioCalculationAssumptions.md.";

function buildAssumptions({ window, benchmarkTicker, benchmarkSource, riskFreeRate, historicalMethodology }) {
    const methodology = historicalMethodology || { type: "current_weights_backward" };

    return {
        analysisPeriod: {
            window,
            label: WINDOW_LABELS[window] || window,
            note: `Based on approximately ${WINDOW_LABELS[window] || window} of historical daily market data.`,
        },
        benchmark: {
            ticker: benchmarkTicker,
            source: benchmarkSource,
            note:
                benchmarkSource === "auto"
                    ? "Auto-selected from the exchange holding the largest share of portfolio value. Override with ?benchmark=TICKER."
                    : "User-specified via the benchmark parameter.",
        },
        riskFreeRate,
        // `type` is the machine-readable signal for "was this actually reconstructed from your transactions, or estimated" -
        // historicalWeightMethodology stays as the human-readable sentence, its content now varies with `type`.
        historicalMethodology: methodology,
        historicalWeightMethodology:
            methodology.type === "transaction_aware" ? TRANSACTION_AWARE_METHODOLOGY_NOTE : CURRENT_WEIGHTS_METHODOLOGY_NOTE,
        tradingDaysPerYearAssumption: analyticsCalculator.TRADING_DAYS_PER_YEAR,
        dataFreshness: { generatedAt: new Date().toISOString() },
    };
}

/** The expensive path: fetch historical prices/quotes/company metadata for every priced position and run every calculator. Only reached on a cache miss. */
const computeAnalytics = async (userId, window, benchmarkParam) => {
    const { holdings, summary } = await portfolioService.getPortfolio(userId);

    if (holdings.length === 0) {
        return emptyPortfolioAnalytics(window, benchmarkParam);
    }

    // Weight is cross-holding by definition - must use USD-normalized value (currentValueUSD), never native currency, or a portfolio mixing e.g. USD and INR holdings silently gets wrong weights (see portfolio.calculator.js's currency-normalization note).
    const positions = portfolioCalculator.groupByTicker(holdings).map((position) => ({
        ...position,
        weightPercent:
            position.currentValueUSD !== null && summary.totalCurrentValue > 0
                ? (position.currentValueUSD / summary.totalCurrentValue) * 100
                : null,
    }));

    const pricedPositions = positions.filter((p) => p.weightPercent !== null);
    const uniqueTickers = pricedPositions.map((p) => p.ticker);

    if (uniqueTickers.length === 0) {
        return { ...emptyPortfolioAnalytics(window, benchmarkParam), isEmpty: false, message: "No holdings currently have a live price - analytics require at least one priced holding." };
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

    const legacyPortfolioReturnSeries = analyticsCalculator.buildPortfolioReturnSeries(returnsByTicker, weightsByTicker);

    // Transaction-aware reconstruction takes priority whenever it produces
    // enough observations to be meaningful - see portfolioHistory.service.js's
    // module header for why some days are excluded rather than estimated.
    // Falls back to the legacy "today's weights applied backward" series
    // (still disclosed as an estimate, see buildAssumptions) when the user
    // hasn't recorded transactions, or hasn't recorded enough of them yet.
    const transactionAware = await portfolioHistoryService
        .buildTransactionAwareReturnSeries(userId, window)
        .catch(() => ({ available: false, reason: "Transaction-aware reconstruction failed unexpectedly.", series: [] }));

    const useTransactionAware = transactionAware.available && transactionAware.series.length >= analyticsCalculator.MIN_OBSERVATIONS_FOR_SERIES;
    const portfolioReturnSeries = useTransactionAware ? transactionAware.series : legacyPortfolioReturnSeries;

    const historicalMethodology = useTransactionAware
        ? {
              type: "transaction_aware",
              analyticsStartDate: transactionAware.analyticsStartDate,
              windowClipped: transactionAware.windowClipped,
              excludedTransactionDays: transactionAware.excludedTransactionDays,
              excludedMissingPriceDays: transactionAware.excludedMissingPriceDays,
              excludedZeroValueDays: transactionAware.excludedZeroValueDays,
          }
        : {
              type: "current_weights_backward",
              // Surfaced even on the fallback path so a caller can tell "no ledger at all" apart from "ledger exists but too short/thin for this window."
              transactionHistoryAvailable: transactionAware.available,
              reason: transactionAware.available
                  ? `Transaction ledger only produced ${transactionAware.series.length} usable observations for this window (need at least ${analyticsCalculator.MIN_OBSERVATIONS_FOR_SERIES}).`
                  : transactionAware.reason,
          };

    const periodReturn = analyticsCalculator.calculatePeriodReturn(portfolioReturnSeries);
    const observedTradingDays = portfolioReturnSeries.length;
    const annualizedReturnValue = analyticsCalculator.annualizeReturn(periodReturn, observedTradingDays);
    const volatility = analyticsCalculator.calculateVolatility(portfolioReturnSeries);
    const maxDrawdown = analyticsCalculator.calculateMaxDrawdown(portfolioReturnSeries);

    const liveRiskFreeRate = await riskFreeRateProvider.getRiskFreeRate().catch(() => null);
    const riskFreeRateLabeled = isFiniteNumber(liveRiskFreeRate)
        ? labeled(liveRiskFreeRate, "market", "10-Year US Treasury yield, fetched live from Yahoo Finance (^TNX).")
        : labeled(
              ILLUSTRATIVE_RISK_FREE_RATE,
              "illustrative_default",
              "The live 10-Year US Treasury yield could not be fetched. Using a documented illustrative assumption instead of a fabricated live value."
          );
    const sharpeRatio = analyticsCalculator.calculateSharpeRatio(annualizedReturnValue, riskFreeRateLabeled.value, volatility);

    const betaResult = riskCalculator.calculatePortfolioBeta(
        pricedPositions.map((p) => ({ ticker: p.ticker, weight: p.weightPercent / 100, beta: quotesByTicker.get(p.ticker)?.riskMetrics?.beta ?? null }))
    );

    const benchmarkCandidate = benchmarkParam || resolveDefaultBenchmarkTicker(pricedPositions, companiesByTicker);
    const benchmarkSource = benchmarkParam ? "user" : "auto";
    const resolvedBenchmark = await resolveBenchmark(benchmarkCandidate, benchmarkSource, window);

    // Correlation between the ACTUAL portfolio return series used above (transaction-aware when available, legacy otherwise) and the benchmark's own daily returns - each date pair drawn from wherever both series have data, same overlap rule as the holdings-pairwise matrix below.
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
            unrealizedReturnMethodology:
                "Cost-basis unrealized return: (current value - cost basis) / cost basis, summed across holdings. Not time-weighted or annualized - see PortfolioReturn.md.",
            periodReturnPercent: periodReturn !== null ? periodReturn * 100 : null,
            annualizedReturnPercent: annualizedReturnValue !== null ? annualizedReturnValue * 100 : null,
            periodReturnMethodology:
                historicalMethodology.type === "transaction_aware"
                    ? "Compounded from the transaction-aware return series: reconstructed holdings valued at each date's real historical price, days spanning a BUY/SELL excluded."
                    : "Estimated by applying today's holding weights to each holding's own historical daily returns over the selected window, then compounding - not a reconstruction of this portfolio's actual historical value.",
            observedTradingDays,
            benchmark,
        },
        risk: {
            volatilityPercent: volatility !== null ? volatility * 100 : null,
            volatilityMethodology: `Annualized standard deviation of ${historicalMethodology.type === "transaction_aware" ? "transaction-aware reconstructed" : "estimated"} daily portfolio returns (daily std dev x sqrt(${analyticsCalculator.TRADING_DAYS_PER_YEAR})).`,
            beta: betaResult.beta,
            betaCoveragePercent: betaResult.coveragePercent,
            betaExcludedTickers: betaResult.excludedTickers,
            betaMethodology:
                "Weighted average of each holding's own beta (Yahoo Finance), not a regression of portfolio returns against the benchmark. Individual betas may be computed against different home-market indices for a multi-market portfolio.",
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
        assumptions: buildAssumptions({
            window,
            benchmarkTicker: benchmark.ticker,
            benchmarkSource,
            riskFreeRate: riskFreeRateLabeled,
            historicalMethodology,
        }),
    };
};

/** GET /api/portfolio/analytics - cached per (user, window, benchmark, portfolio composition). */
const getPortfolioAnalytics = async (userId, { window, benchmark }) => {
    const portfolioVersion = await buildPortfolioVersion(userId);

    if (portfolioVersion === "empty") {
        return emptyPortfolioAnalytics(window, benchmark);
    }

    // Included in the cache key alongside portfolioVersion - the transaction
    // ledger now drives its own part of the response, so a cache hit
    // requires both to be unchanged.
    const transactionsVersion = await portfolioHistoryService.getTransactionsVersion(userId);
    const cacheKey = `${userId}:${window}:${benchmark || "auto"}:${portfolioVersion}:${transactionsVersion}`;
    const cached = analyticsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
    }

    const data = await computeAnalytics(userId, window, benchmark);
    analyticsCache.set(cacheKey, { data, expiresAt: Date.now() + ANALYTICS_CACHE_TTL_MS });

    return data;
};

/** Test-only: clears the in-memory analytics cache so tests don't leak state across runs (same pattern as riskFreeRate.provider.js's _resetCache). */
const _resetCache = () => {
    analyticsCache.clear();
};

module.exports = {
    getPortfolioAnalytics,
    DEFAULT_BENCHMARK_TICKER,
    EXCHANGE_BENCHMARK_MAP,
    ILLUSTRATIVE_RISK_FREE_RATE,
    ANALYTICS_CACHE_TTL_MS,
    _resetCache,
};
