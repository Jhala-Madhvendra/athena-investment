/**
 * Watchlist Change Detection
 *
 * Compares each tracked ticker's current metrics against the last values
 * *this user* was shown (WatchlistSnapshot, scoped by (userId, ticker) -
 * see watchlistSnapshot.model.js for why not a shared/global snapshot),
 * then overwrites the snapshot with the current values. This makes
 * GET /api/watchlist/insights a deliberate "check what's new" checkpoint,
 * not a side effect of casually viewing the list (GET /api/watchlist
 * never touches a snapshot). No scheduled job - compare-then-update on
 * read matches the rest of Athena, which computes everything at request
 * time. Reuses watchlist.service.getWatchlistWithMetrics rather than
 * re-fetching market/analysis/DCF data itself, so insights and the list
 * view can never drift out of sync with each other.
 */

const WatchlistSnapshot = require("./watchlistSnapshot.model");
const watchlistService = require("./watchlist.service");

/**
 * The five metrics tracked for change detection, and why each was chosen:
 *  - stockPrice: cheapest signal, most immediately meaningful to a user.
 *  - healthScore: one composite number already summarizing profitability/
 *    liquidity/solvency/cash-flow/growth (Sprint 3) - captures multi-
 *    dimensional fundamental change without re-deriving raw ratios.
 *  - peRatio: cheap (comes free with the quote), flags valuation re-rating.
 *  - revenueCAGR: a fundamentals signal orthogonal to price - only moves
 *    when a new statement period lands, so it flags "the story changed,"
 *    not daily market noise.
 *  - dcfValuationGapPercent: ties Sprint 6's research-grade valuation back
 *    into the tracking surface.
 * Deliberately not tracking ROE/debt/FCF individually yet - the sprint
 * asks for "a carefully selected subset," and Health Score already
 * summarizes those dimensions at a glance.
 */
const THRESHOLDS = {
    stockPrice: { type: "percent", min: 1 },
    healthScore: { type: "absolute", min: 1 },
    peRatio: { type: "percent", min: 3 },
    revenueCAGR: { type: "absolute", min: 1 },
    dcfValuationGapPercent: { type: "absolute", min: 2 },
};

const METRIC_LABELS = {
    stockPrice: "Stock Price",
    healthScore: "Financial Health Score",
    peRatio: "P/E Ratio",
    revenueCAGR: "Revenue CAGR",
    dcfValuationGapPercent: "DCF Valuation Gap",
};

const extractTrackedMetrics = (row) => ({
    stockPrice: row.price?.current ?? null,
    healthScore: row.financialHealthScore ?? null,
    peRatio: row.peRatio ?? null,
    revenueCAGR: row.revenueCAGRPercent ?? null,
    dcfValuationGapPercent: row.dcf?.available ? row.dcf.valuationGapPercent : null,
});

/** Never flags a change against a missing value on either side - "unknown" is not "changed". */
const hasMeaningfullyChanged = (metricKey, previous, current) => {
    if (typeof previous !== "number" || typeof current !== "number") return false;

    const threshold = THRESHOLDS[metricKey];
    if (threshold.type === "absolute") {
        return Math.abs(current - previous) >= threshold.min;
    }

    if (previous === 0) return current !== 0;
    return Math.abs(((current - previous) / previous) * 100) >= threshold.min;
};

const formatSignedPercent = (value) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;

const formatChangeText = (metricKey, previous, current) => {
    switch (metricKey) {
        case "stockPrice": {
            const direction = current >= previous ? "up" : "down";
            const percent = previous !== 0 ? Math.abs(((current - previous) / previous) * 100).toFixed(1) : null;
            return `Stock price ${direction}${percent !== null ? ` ${percent}%` : ""} since you last checked (${previous.toFixed(2)} → ${current.toFixed(2)}).`;
        }
        case "healthScore":
            return `Financial Health Score changed from ${previous} to ${current}.`;
        case "peRatio":
            return `P/E ratio changed from ${previous.toFixed(1)} to ${current.toFixed(1)}.`;
        case "revenueCAGR": {
            const direction = current >= previous ? "accelerated" : "slowed";
            return `Revenue growth ${direction} - CAGR changed from ${previous.toFixed(1)}% to ${current.toFixed(1)}%.`;
        }
        case "dcfValuationGapPercent":
            return `DCF valuation gap changed from ${formatSignedPercent(previous)} to ${formatSignedPercent(current)}.`;
        default:
            return `${METRIC_LABELS[metricKey]} changed from ${previous} to ${current}.`;
    }
};

const getInsights = async (userId) => {
    const { companies } = await watchlistService.getWatchlistWithMetrics(userId);

    const insights = await Promise.all(
        companies.map(async (row) => {
            const current = extractTrackedMetrics(row);
            const previousSnapshot = await WatchlistSnapshot.findOne({ userId, ticker: row.ticker }).lean();

            const changes = previousSnapshot
                ? Object.keys(THRESHOLDS)
                      .filter((metricKey) =>
                          hasMeaningfullyChanged(metricKey, previousSnapshot.metrics?.[metricKey], current[metricKey])
                      )
                      .map((metricKey) => ({
                          metric: metricKey,
                          label: METRIC_LABELS[metricKey],
                          previous: previousSnapshot.metrics[metricKey],
                          current: current[metricKey],
                          text: formatChangeText(metricKey, previousSnapshot.metrics[metricKey], current[metricKey]),
                      }))
                : [];

            await WatchlistSnapshot.findOneAndUpdate(
                { userId, ticker: row.ticker },
                { metrics: current, observedAt: new Date() },
                { upsert: true }
            );

            return {
                ticker: row.ticker,
                name: row.name,
                status: previousSnapshot ? "compared" : "baseline_established",
                changes,
            };
        })
    );

    return { insights, generatedAt: new Date().toISOString() };
};

module.exports = { getInsights, extractTrackedMetrics, hasMeaningfullyChanged, THRESHOLDS, METRIC_LABELS };
