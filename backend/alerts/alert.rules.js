/**
 * Centralized Alert thresholds and rule metadata. alert.engine.js reads
 * exclusively from this file - no threshold is ever inlined at a call site.
 * See the "Why this number" comment on each group; the fuller reasoning
 * (worked examples, why not a lower/higher number) lives in the matching
 * research/finance doc.
 *
 * No CRITICAL severity - see alert.severity.js. Valuation (DCF/Comps) has
 * no rules here: both require inputs Athena deliberately never fabricates
 * (cost of debt, peer selection) and neither can run unattended - see
 * research/finance/ValuationAlerts.md.
 */

const THRESHOLDS = {
    market: {
        // A large-cap's typical daily move is ~1-2%; 5% is a clear outlier
        // day. See research/finance/MarketEventAnalysis.md.
        dailyMovePercent: 5,
        // Matches the sprint brief's own worked example (AAPL -8.4% over 5
        // sessions) and its own example threshold (0.08).
        fiveDayMovePercent: 8,
        // Today's (high-low)/close vs. the trailing 5-day average of the
        // same ratio - 1.5x flags a volatility spike, not routine noise.
        rangeWidthSpikeMultiple: 1.5,
    },
    financial: {
        // The sprint brief's own example (32.1% -> 28.7%) is a 3.4pp move;
        // 3pp catches that while filtering normal <=1pp noise.
        marginChangePoints: 3,
        // The sprint brief's own example (18.2% -> 10.4%) is a 7.8pp move.
        revenueGrowthChangePoints: 5,
        // Same order of magnitude as margin - a meaningful move in a ratio.
        roeChangePoints: 3,
        // Cash flow is lumpier than margins (capex timing); needs a bigger
        // relative move to be signal, not noise.
        fcfDeclinePercent: 15,
        // Debt increases are a slower, deliberate signal - small moves are
        // routine refinancing.
        debtIncreasePercent: 15,
        // Health Score is already a smoothed 0-100 composite; needs a real
        // move to matter.
        healthScoreChangePoints: 8,
    },
    business: {
        // A multi-year margin/FCF trend must be at least this consistent
        // (see trend.engine.js's detectTrendDirection) to be called a
        // sustained trend rather than a couple of noisy years.
        trendConsistencyPercent: 75,
    },
    news: {
        // Matches the sprint brief's suggested important categories, drawn
        // from Sprint 10's existing taxonomy (news.classifier.js CATEGORIES).
        importantCategories: ["Earnings", "Acquisition / Merger", "Regulation / Legal", "Leadership"],
        // Generous window so no important article is missed between two
        // monitoring calls; dedup is per-article-id, so re-scanning the same
        // window on every call is safe and cheap (indexed query).
        lookbackDays: 14,
    },
    portfolio: {
        // Common concentration-risk rule-of-thumb; matches the qualitative
        // framing already in research/finance/ConcentrationRisk.md.
        concentrationPercent: 25,
        concentrationHighPercent: 40,
        // Large enough to be decision-relevant, not day-to-day noise.
        gainLossPercent: 20,
        // Same order as the market/financial thresholds, for consistency.
        valueChangePercent: 10,
    },
};

/** HIGH = a magnitude-based rule firing at roughly 2x its MEDIUM threshold - see alert.severity.js. */
const SEVERITY_MULTIPLIER = 2;

module.exports = { THRESHOLDS, SEVERITY_MULTIPLIER };
