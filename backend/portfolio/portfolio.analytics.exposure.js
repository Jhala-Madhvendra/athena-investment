/**
 * Portfolio Analytics Exposure
 *
 * Pure functions for sector/industry exposure and concentration (Top N,
 * HHI). Operates on already ticker-grouped, already-weighted positions -
 * see portfolio.analytics.service.js for how positions get their
 * sector/industry (reused directly from Company.sector/Company.industry,
 * Sprint 13's classification - no separate taxonomy is introduced here).
 */

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

const UNCLASSIFIED_LABEL = "Unclassified";

/**
 * Groups priced positions by a classification field (sector or industry)
 * and sums their weight. A position with no classification (company not
 * yet enriched with sector/industry data) is grouped under
 * UNCLASSIFIED_LABEL rather than silently dropped - its value is real
 * portfolio value even if Athena can't categorize it yet.
 * @param {{ticker: string, weightPercent: number}[]} positions
 * @param {(ticker: string) => string|null} classify - returns the sector/industry for a ticker, or null
 * @returns {{label: string, weightPercent: number, tickers: string[]}[]} sorted descending by weight
 */
const groupByClassification = (positions, classify) => {
    const groups = new Map();

    (positions || []).forEach((position) => {
        if (!isFiniteNumber(position.weightPercent)) {
            return;
        }

        const label = classify(position.ticker) || UNCLASSIFIED_LABEL;
        const existing = groups.get(label) || { label, weightPercent: 0, tickers: [] };
        existing.weightPercent += position.weightPercent;
        existing.tickers.push(position.ticker);
        groups.set(label, existing);
    });

    return [...groups.values()].sort((a, b) => b.weightPercent - a.weightPercent);
};

/**
 * Concentration metrics over priced, ticker-grouped positions.
 * HHI uses weights as percentage points (0-100), the standard convention
 * (US antitrust practice) so the result ranges 0 (maximally diversified)
 * to 10,000 (single holding) - see HHI.md.
 * @param {{ticker: string, weightPercent: number}[]} positions
 */
const calculateConcentration = (positions) => {
    const priced = (positions || [])
        .filter((p) => isFiniteNumber(p.weightPercent))
        .sort((a, b) => b.weightPercent - a.weightPercent);

    if (priced.length === 0) {
        return { top1WeightPercent: null, top3WeightPercent: null, top5WeightPercent: null, hhi: null };
    }

    const topN = (n) => priced.slice(0, n).reduce((sum, p) => sum + p.weightPercent, 0);
    const hhi = priced.reduce((sum, p) => sum + p.weightPercent ** 2, 0);

    return {
        top1WeightPercent: topN(1),
        top3WeightPercent: topN(3),
        top5WeightPercent: topN(5),
        hhi,
    };
};

module.exports = { UNCLASSIFIED_LABEL, groupByClassification, calculateConcentration };
