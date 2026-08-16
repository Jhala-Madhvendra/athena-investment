/**
 * Industry Benchmark
 *
 * Pure statistics for comparing one company's metric against a reference
 * universe of peer companies. Builds directly on comps.statistics.js
 * (mean/median/percentile/summarize) rather than re-implementing
 * aggregation - see research/finance/MeanVsMedian.md for why median is
 * preferred here for the same reason Comps prefers it.
 *
 * No Express, no MongoDB, no Yahoo Finance - every function takes plain
 * numbers/arrays and returns a plain object, mirroring comps.engine.js's
 * discipline.
 */

const { summarize, MIN_OBSERVATIONS_FOR_PERCENTILE } = require("../valuation/comps/comps.statistics");

/**
 * Minimum number of universe companies with a *valid* observation for a
 * given metric before Athena will report any statistic (mean, median,
 * or percentile) for it - not just percentiles, unlike Comps. A 2-3
 * company "industry benchmark" is not a meaningful reference set per the
 * Sprint 13 product principle, so below this threshold the metric is
 * reported as unavailable with a stated reason instead of a misleading
 * number computed from too few peers.
 */
const MIN_UNIVERSE_SIZE = MIN_OBSERVATIONS_FOR_PERCENTILE;

/** Percentage-point threshold below which a difference is not called a strength/weakness for percent-based metrics (margins, growth, ROE, ROA, FCF margin). */
const MATERIALITY_THRESHOLD_PP = 3;

/** Relative threshold (as a fraction) below which a difference is not called a strength/weakness for multiple-based metrics (P/E, EV/EBITDA). */
const MATERIALITY_THRESHOLD_RELATIVE = 0.15;

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

/**
 * Summarizes a metric across the reference universe, gated by
 * MIN_UNIVERSE_SIZE. Returns {available: false, count, reason} instead of
 * computing a mean/median on an insufficient sample.
 *
 * @param {Array<number|null>} values - one observation per universe company (nulls dropped, never treated as zero)
 * @returns {{available: boolean, count: number, mean?: number|null, median?: number|null, min?: number|null, max?: number|null, p25?: number|null, p75?: number|null, reason?: string}}
 */
const summarizeMetric = (values) => {
    const validCount = (Array.isArray(values) ? values : []).filter(isFiniteNumber).length;

    if (validCount < MIN_UNIVERSE_SIZE) {
        return {
            available: false,
            count: validCount,
            reason: `Not available - only ${validCount} of the reference universe report this metric; at least ${MIN_UNIVERSE_SIZE} are required for a benchmark.`,
        };
    }

    return { available: true, ...summarize(values) };
};

/**
 * Percentile RANK of a target value within a universe - the inverse
 * question to comps.statistics.percentile() (which returns the value AT a
 * given percentile). Uses the standard "percent of the universe at or
 * below this value" definition, with ties counted at half weight so a
 * value tied with several peers doesn't jump to the top of its tie band.
 *
 * @param {number[]} validValues - the universe's valid (non-null) observations for this metric, NOT including the target
 * @param {number} targetValue
 * @returns {number|null} 0-100, rounded to the nearest whole percentile, or null if the universe is empty
 */
const percentileRank = (validValues, targetValue) => {
    if (!Array.isArray(validValues) || validValues.length === 0 || !isFiniteNumber(targetValue)) {
        return null;
    }

    const below = validValues.filter((value) => value < targetValue).length;
    const equal = validValues.filter((value) => value === targetValue).length;

    return Math.round(((below + 0.5 * equal) / validValues.length) * 100);
};

/**
 * Compares a company's value to its universe benchmark using neutral,
 * analytical language - never "better"/"worse" (see NO INVESTMENT
 * RECOMMENDATIONS in the Sprint 13 brief).
 *
 * @param {number|null} companyValue
 * @param {{available: boolean, median?: number|null}} universeSummary - from summarizeMetric()
 * @param {"percent"|"ratio"|"multiple"} unit
 * @returns {{available: boolean, companyValue: number|null, universeMedian: number|null, difference: number|null, relative: number|null, unit: string, note: string, reason?: string}}
 */
const compareToTarget = (companyValue, universeSummary, unit) => {
    if (!universeSummary?.available) {
        return {
            available: false,
            companyValue: isFiniteNumber(companyValue) ? companyValue : null,
            universeMedian: null,
            difference: null,
            relative: null,
            unit,
            reason: universeSummary?.reason || "Industry benchmark is not available for this metric.",
        };
    }

    if (!isFiniteNumber(companyValue)) {
        return {
            available: false,
            companyValue: null,
            universeMedian: universeSummary.median,
            difference: null,
            relative: null,
            unit,
            reason: "Not available for this company.",
        };
    }

    const universeMedian = universeSummary.median;
    const difference = isFiniteNumber(universeMedian) ? Number((companyValue - universeMedian).toFixed(4)) : null;
    const relative = isFiniteNumber(universeMedian) && universeMedian !== 0
        ? Number((companyValue / universeMedian).toFixed(4))
        : null;

    const note = unit === "multiple"
        ? relative !== null
            ? `Trading at ${relative.toFixed(2)}x the industry median.`
            : "Industry median is not available for this comparison."
        : difference !== null
            ? `${difference >= 0 ? "+" : ""}${unit === "percent" ? difference.toFixed(1) + " percentage points" : difference.toFixed(2)} versus the industry median.`
            : "Industry median is not available for this comparison.";

    return { available: true, companyValue, universeMedian, difference, relative, unit, note };
};

/**
 * Classifies a comparison as a relative strength, weakness, or neither -
 * using the documented materiality threshold so small/insignificant
 * differences are never labeled a strength or weakness (see Sprint 13's
 * RELATIVE WEAKNESSES section: "Do not call something a weakness if the
 * difference is statistically or economically insignificant.").
 *
 * Deliberately only applies to percent-based operating metrics (growth,
 * margins, ROE, ROA, FCF margin), where a percentage-point threshold is
 * meaningful. Valuation multiples (P/E, EV/EBITDA) are never classified
 * as a strength/weakness here, since "trading at a premium" carries no
 * inherent positive/negative judgment (see Sprint 13's INDUSTRY
 * VALUATION guidance: never conclude "cheap" or "expensive"). Leverage
 * ratios (debt-to-equity) are shown as benchmarks but likewise not
 * classified here - a percentage-point threshold does not apply to a
 * ratio. Callers should only invoke this for `unit: "percent"` comparisons.
 *
 * @param {{available: boolean, difference: number|null, unit: string}} comparison - from compareToTarget(), unit must be "percent"
 * @returns {"strength"|"weakness"|"neutral"|"unavailable"}
 */
const classifyPosition = (comparison) => {
    if (!comparison?.available || comparison.difference === null) {
        return "unavailable";
    }

    if (comparison.difference >= MATERIALITY_THRESHOLD_PP) return "strength";
    if (comparison.difference <= -MATERIALITY_THRESHOLD_PP) return "weakness";
    return "neutral";
};

module.exports = {
    MIN_UNIVERSE_SIZE,
    MATERIALITY_THRESHOLD_PP,
    MATERIALITY_THRESHOLD_RELATIVE,
    summarizeMetric,
    percentileRank,
    compareToTarget,
    classifyPosition,
};
