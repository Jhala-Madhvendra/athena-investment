/**
 * Earnings Signals
 *
 * Deterministic Improving / Stable / Deteriorating classification per
 * metric - only where a meaningful comparison exists (no previous period =
 * no signal, never a guessed one). Thresholds are documented, not
 * arbitrary, per the Sprint 12 brief's "Signal Logic" section.
 *
 * Reuses backend/alerts/alert.rules.js's THRESHOLDS wherever an existing
 * number already defines "meaningful" for the same metric in Athena, so an
 * Earnings signal and an Alert Engine trigger never quietly disagree about
 * what counts as a significant change - see research/engineering/
 * FinancialSignalDetection.md and research/engineering/ServiceReuse.md.
 *
 * Balance sheet items (debt/cash/net debt) deliberately do NOT get an
 * Improving/Deteriorating label - the brief is explicit that debt in
 * isolation is not good or bad. They get a neutral ↑ / ↓ / → direction
 * instead, matching the brief's own worked example ("Balance Sheet: → Debt").
 */

const { THRESHOLDS: ALERT_THRESHOLDS } = require("../alerts/alert.rules");

const SIGNALS = { IMPROVING: "Improving", STABLE: "Stable", DETERIORATING: "Deteriorating" };
const DIRECTIONS = { UP: "↑", DOWN: "↓", FLAT: "→" };

const SIGNAL_THRESHOLDS = {
    // No existing Athena threshold measures raw period-over-period growth
    // magnitude for revenue/operating income/net income - alert.rules.js's
    // revenueGrowthChangePoints instead measures a *change in the growth
    // rate itself* (e.g. 18% -> 10%), a different question from "is this
    // period's growth rate itself notable." 5% is a deliberately modest
    // bar for calling single-period growth Improving/Deteriorating rather
    // than noise; roughly GDP-order growth (-5%..+5%) is the Stable band.
    growthPercent: 5,
    // Reuses alert.rules.js's fcfDeclinePercent (15) - the Alert Engine
    // already treats a 15%+ FCF decline as meaningful, so a Deteriorating
    // FCF signal here describes exactly the same threshold as an Alert
    // Engine FCF_DETERIORATION trigger.
    fcfPercent: ALERT_THRESHOLDS.financial.fcfDeclinePercent,
    // Reuses alert.rules.js's marginChangePoints (3pp) for every
    // percentage-point-based metric (operating margin, net margin). ROE's
    // alert threshold (roeChangePoints) is also 3pp, so the same constant
    // covers it without introducing a second identical number.
    marginPoints: ALERT_THRESHOLDS.financial.marginChangePoints,
    // Reuses alert.rules.js's debtIncreasePercent (15) as the bar for
    // calling a balance-sheet item's direction ↑/↓ rather than → (flat).
    balanceSheetPercent: ALERT_THRESHOLDS.financial.debtIncreasePercent,
};

/** Improving if value >= +threshold, Deteriorating if <= -threshold, Stable otherwise. Null in, null out - "no signal" is the correct answer when there's nothing to compare. */
const classifyByMagnitude = (value, threshold) => {
    if (typeof value !== "number") return null;
    if (value >= threshold) return SIGNALS.IMPROVING;
    if (value <= -threshold) return SIGNALS.DETERIORATING;
    return SIGNALS.STABLE;
};

/** Same three-way logic as classifyByMagnitude, but returns a neutral direction arrow instead of an Improving/Deteriorating judgment - for metrics the brief says should not be framed as good or bad. */
const classifyDirection = (value, threshold) => {
    if (typeof value !== "number") return null;
    if (value >= threshold) return DIRECTIONS.UP;
    if (value <= -threshold) return DIRECTIONS.DOWN;
    return DIRECTIONS.FLAT;
};

/** Signal for a variance-shaped metric (earnings.calculator.js's buildVarianceMetric output) using its relative percentChange. */
const signalForMetric = (metric, threshold) => classifyByMagnitude(metric?.percentChange, threshold);

/** Signal for a margin-shaped metric (earnings.calculator.js's buildMarginMetric output) using its percentage-point pointChange, never its relative percentChange. */
const signalForMarginMetric = (metric, threshold = SIGNAL_THRESHOLDS.marginPoints) =>
    classifyByMagnitude(metric?.pointChange, threshold);

/** Neutral ↑/↓/→ direction for a balance-sheet variance metric. */
const directionForBalanceSheetMetric = (metric, threshold = SIGNAL_THRESHOLDS.balanceSheetPercent) =>
    classifyDirection(metric?.percentChange, threshold);

/**
 * @param {object} metrics - earnings.calculator.js's calculateEarningsMetrics() output
 * @returns {{growth: object, profitability: object, cashFlow: object, balanceSheet: object}}
 */
const computeSignals = (metrics) => {
    if (!metrics) {
        return { growth: {}, profitability: {}, cashFlow: {}, balanceSheet: {} };
    }

    return {
        growth: {
            revenue: signalForMetric(metrics.growth?.revenue, SIGNAL_THRESHOLDS.growthPercent),
            operatingIncome: signalForMetric(metrics.growth?.operatingIncome, SIGNAL_THRESHOLDS.growthPercent),
            netIncome: signalForMetric(metrics.growth?.netIncome, SIGNAL_THRESHOLDS.growthPercent),
        },
        profitability: {
            operatingMargin: signalForMarginMetric(metrics.profitability?.operatingMargin),
            netMargin: signalForMarginMetric(metrics.profitability?.netMargin),
            returnOnEquity: signalForMarginMetric(metrics.profitability?.returnOnEquity),
            returnOnAssets: signalForMarginMetric(metrics.profitability?.returnOnAssets),
        },
        cashFlow: {
            freeCashFlow: signalForMetric(metrics.cashFlow?.freeCashFlow, SIGNAL_THRESHOLDS.fcfPercent),
            fcfMargin: signalForMarginMetric(metrics.cashFlow?.fcfMargin),
        },
        balanceSheet: {
            totalDebt: directionForBalanceSheetMetric(metrics.balanceSheet?.totalDebt),
            cash: directionForBalanceSheetMetric(metrics.balanceSheet?.cash),
            netDebt: directionForBalanceSheetMetric(metrics.balanceSheet?.netDebt),
        },
    };
};

module.exports = {
    SIGNALS,
    DIRECTIONS,
    SIGNAL_THRESHOLDS,
    classifyByMagnitude,
    classifyDirection,
    signalForMetric,
    signalForMarginMetric,
    directionForBalanceSheetMetric,
    computeSignals,
};
