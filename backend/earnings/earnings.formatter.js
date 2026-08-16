/**
 * Earnings Formatter
 *
 * Assembles the final GET /api/earnings/:ticker response shape from the
 * already-computed pieces (periods, calculator metrics, signals, related
 * news, market reaction) - the only place that decides the public API
 * shape, so internal module shapes (earnings.periods.js's `latest`/
 * `previous` statement documents, in particular) never leak directly onto
 * the wire.
 */

/** Only the fields the Sprint 10 News domain already exposes publicly (backend/news/news.service.js's own .select() already strips internal fields) - re-selected here so Earnings' news shape is stable even if news.service.js's projection changes. */
const formatArticle = (article) => ({
    title: article.title,
    description: article.description ?? null,
    source: article.source ?? null,
    publishedAt: article.publishedAt,
    category: article.category,
    url: article.url,
});

/**
 * @param {object} params
 * @param {string} params.ticker
 * @param {object} params.periods - earnings.periods.js's resolvePeriods() output
 * @param {object} params.metrics - earnings.calculator.js's calculateEarningsMetrics() output
 * @param {object} params.signals - earnings.signals.js's computeSignals() output
 * @param {Array} params.relatedNews - articles from newsService.getNews()
 * @param {object} params.marketReaction - earnings.marketReaction.js's output (or an "unavailable" stub before that module runs)
 */
const formatEarningsResponse = ({ ticker, periods, metrics, signals, relatedNews, marketReaction }) => ({
    ticker,
    period: {
        periodType: periods.periodType,
        latestPeriod: periods.latestPeriodLabel,
        previousPeriod: periods.previousPeriodLabel,
        comparisonAvailable: periods.comparisonAvailable,
        comparisonType: periods.comparisonType,
    },
    growth: metrics.growth,
    profitability: metrics.profitability,
    cashFlow: metrics.cashFlow,
    balanceSheet: metrics.balanceSheet,
    perShare: metrics.perShare,
    qualityObservations: metrics.qualityObservations,
    signals,
    marketReaction,
    relatedNews: (relatedNews || []).map(formatArticle),
    dataFreshness: {
        financialPeriod: periods.latestPeriodLabel,
        statementType: periods.periodType === "ANNUAL" ? "Annual" : periods.periodType,
        financialStatementSource: periods.latest?.source ?? null,
        marketObservationDate: marketReaction?.available ? marketReaction.anchorDate : null,
    },
    generatedAt: new Date().toISOString(),
});

module.exports = { formatEarningsResponse };
