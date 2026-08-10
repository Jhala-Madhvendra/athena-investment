/**
 * Comps Statistics
 *
 * Pure aggregation over a set of peer multiple observations. No Express,
 * no MongoDB. Only ever called with the *valid* observations for a given
 * multiple (see comps.engine.js for how invalid/excluded ones are
 * filtered out and reported separately) - never with raw unfiltered data.
 *
 * Median is the primary statistic Athena defaults to: a single extreme
 * peer multiple shifts a mean by its full distance from the rest of the
 * group, but can shift a median by at most one rank - see
 * research/finance/TradingMultiples.md for the full reasoning.
 */

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

/** Percentiles below this sample size are reported as unavailable rather than computed on too few points to be meaningful. */
const MIN_OBSERVATIONS_FOR_PERCENTILE = 4;

const mean = (values) => {
    if (!Array.isArray(values) || values.length === 0) {
        return null;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
};

/** Linear-interpolation percentile (Excel PERCENTILE.INC / NIST method 7). `sortedValues` must already be ascending; `p` is 0-1. */
const percentile = (sortedValues, p) => {
    if (!Array.isArray(sortedValues) || sortedValues.length === 0) {
        return null;
    }

    if (sortedValues.length === 1) {
        return sortedValues[0];
    }

    const rank = p * (sortedValues.length - 1);
    const lowerIndex = Math.floor(rank);
    const upperIndex = Math.ceil(rank);

    if (lowerIndex === upperIndex) {
        return sortedValues[lowerIndex];
    }

    const weight = rank - lowerIndex;
    return sortedValues[lowerIndex] + weight * (sortedValues[upperIndex] - sortedValues[lowerIndex]);
};

const median = (sortedValues) => percentile(sortedValues, 0.5);

/**
 * Summarizes a set of numeric observations for one multiple.
 * @param {number[]} values - candidate observations (nulls/non-finite entries are dropped, not treated as zero)
 * @returns {{count: number, min: number|null, max: number|null, mean: number|null, median: number|null, p25: number|null, p75: number|null}}
 */
const summarize = (values) => {
    const validValues = Array.isArray(values) ? values.filter(isFiniteNumber) : [];

    if (validValues.length === 0) {
        return { count: 0, min: null, max: null, mean: null, median: null, p25: null, p75: null };
    }

    const sorted = [...validValues].sort((first, second) => first - second);
    const hasEnoughForPercentiles = sorted.length >= MIN_OBSERVATIONS_FOR_PERCENTILE;

    return {
        count: sorted.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        mean: mean(sorted),
        median: median(sorted),
        p25: hasEnoughForPercentiles ? percentile(sorted, 0.25) : null,
        p75: hasEnoughForPercentiles ? percentile(sorted, 0.75) : null,
    };
};

module.exports = { mean, median, percentile, summarize, MIN_OBSERVATIONS_FOR_PERCENTILE };
