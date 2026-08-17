/**
 * Portfolio Analytics Risk
 *
 * Pure functions for portfolio beta. Kept separate from
 * portfolio.analytics.calculator.js because this metric doesn't touch the
 * historical return series at all - it's a snapshot weighted-average of
 * each holding's own (Yahoo-supplied) beta, not something derived from
 * daily price bars. See PortfolioBeta.md for why this method was chosen
 * over regressing portfolio returns against a benchmark.
 */

const { MIN_COVERAGE_WEIGHT } = require("./portfolio.analytics.calculator");

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

/**
 * Portfolio beta = Σ wi × βi, computed only over holdings with a known
 * beta. A holding's own beta comes from the market data provider (Yahoo),
 * generally computed against that stock's home-market index - mixing
 * betas from different home-market benchmarks into one weighted average
 * is a known limitation, not something this function can fix (see
 * PortfolioBeta.md's "Limitations" section).
 *
 * @param {{ticker: string, weight: number, beta: number|null}[]} holdings - weight is a decimal (0-1) of total portfolio value
 * @returns {{beta: number|null, coveragePercent: number, excludedTickers: string[]}}
 */
const calculatePortfolioBeta = (holdings) => {
    const priced = Array.isArray(holdings) ? holdings.filter((h) => isFiniteNumber(h.weight) && h.weight > 0) : [];
    const covered = priced.filter((h) => isFiniteNumber(h.beta));
    const excludedTickers = priced.filter((h) => !isFiniteNumber(h.beta)).map((h) => h.ticker);
    const coveredWeight = covered.reduce((sum, h) => sum + h.weight, 0);

    if (coveredWeight === 0) {
        return { beta: null, coveragePercent: 0, excludedTickers };
    }

    if (coveredWeight < MIN_COVERAGE_WEIGHT) {
        return { beta: null, coveragePercent: Number((coveredWeight * 100).toFixed(2)), excludedTickers };
    }

    const beta = covered.reduce((sum, h) => sum + (h.weight / coveredWeight) * h.beta, 0);

    return { beta, coveragePercent: Number((coveredWeight * 100).toFixed(2)), excludedTickers };
};

module.exports = { calculatePortfolioBeta };
