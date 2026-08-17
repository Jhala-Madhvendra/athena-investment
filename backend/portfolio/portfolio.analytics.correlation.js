/**
 * Portfolio Analytics Correlation
 *
 * Pure functions for pairwise return correlation between holdings.
 * Each pair is computed over its own OVERLAPPING dates only - not the
 * whole-portfolio aligned date set used by portfolio.analytics.calculator.js.
 * Truncating an older pair of tickers down to a third, more-recently-listed
 * ticker's shorter history (which the portfolio-wide alignment would imply)
 * would throw away real data for no reason; correlation between two
 * tickers should use every date both of them actually traded.
 */

/** Below this many overlapping observations, a correlation coefficient is not reported - too few points make it noise, not signal. */
const MIN_OVERLAPPING_OBSERVATIONS = 20;

/**
 * Pearson correlation coefficient between two return series, restricted to
 * dates present in both.
 * @param {{date: string, return: number}[]} returnsA
 * @param {{date: string, return: number}[]} returnsB
 * @returns {{correlation: number|null, observations: number}}
 */
const calculatePairwiseCorrelation = (returnsA, returnsB) => {
    const byDateB = new Map((returnsB || []).map((entry) => [entry.date, entry.return]));
    const paired = (returnsA || [])
        .filter((entry) => byDateB.has(entry.date))
        .map((entry) => [entry.return, byDateB.get(entry.date)]);

    if (paired.length < MIN_OVERLAPPING_OBSERVATIONS) {
        return { correlation: null, observations: paired.length };
    }

    const n = paired.length;
    const meanA = paired.reduce((sum, [a]) => sum + a, 0) / n;
    const meanB = paired.reduce((sum, [, b]) => sum + b, 0) / n;

    let covariance = 0;
    let varianceA = 0;
    let varianceB = 0;

    paired.forEach(([a, b]) => {
        const diffA = a - meanA;
        const diffB = b - meanB;
        covariance += diffA * diffB;
        varianceA += diffA ** 2;
        varianceB += diffB ** 2;
    });

    // Effectively-zero variance (a constant series, allowing for float rounding) has undefined correlation, not 0.
    const ZERO_VARIANCE_EPSILON = 1e-12;
    if (varianceA < ZERO_VARIANCE_EPSILON || varianceB < ZERO_VARIANCE_EPSILON) {
        return { correlation: null, observations: n };
    }

    const correlation = covariance / Math.sqrt(varianceA * varianceB);
    return { correlation, observations: n };
};

/**
 * Full pairwise correlation matrix across every held ticker.
 * @param {Record<string, {date: string, return: number}[]>} returnsByTicker
 * @returns {{tickers: string[], matrix: Record<string, Record<string, number|null>>, observations: Record<string, Record<string, number>>}}
 */
const calculateCorrelationMatrix = (returnsByTicker) => {
    const tickers = Object.keys(returnsByTicker || {}).sort();
    const matrix = {};
    const observations = {};

    tickers.forEach((tickerA) => {
        matrix[tickerA] = {};
        observations[tickerA] = {};

        tickers.forEach((tickerB) => {
            if (tickerA === tickerB) {
                matrix[tickerA][tickerB] = 1;
                observations[tickerA][tickerB] = returnsByTicker[tickerA]?.length ?? 0;
                return;
            }

            const { correlation, observations: obs } = calculatePairwiseCorrelation(
                returnsByTicker[tickerA],
                returnsByTicker[tickerB]
            );
            matrix[tickerA][tickerB] = correlation;
            observations[tickerA][tickerB] = obs;
        });
    });

    return { tickers, matrix, observations };
};

module.exports = { MIN_OVERLAPPING_OBSERVATIONS, calculatePairwiseCorrelation, calculateCorrelationMatrix };
