/**
 * Portfolio Calculator
 *
 * Pure functions only - no I/O, no Mongoose, no fetching. Same shape as
 * dcf.formulas.js/comps.formulas.js: given numbers, return numbers, so the
 * math is unit-testable without mocking a database or a market provider.
 * See PortfolioReturn.md / ConcentrationRisk.md.
 */

const calculateCostBasis = (shares, purchasePrice) => shares * purchasePrice;

/** null (not 0) when the current price is unknown - an unpriced holding has an *unknown* value, not a worthless one. */
const calculateCurrentValue = (shares, currentPrice) =>
    typeof currentPrice === "number" && Number.isFinite(currentPrice) ? shares * currentPrice : null;

const calculateGainLoss = (currentValue, costBasis) => (currentValue === null ? null : currentValue - costBasis);

/** null on a zero cost basis (e.g. gifted shares) - the return is undefined, not Infinity. See PortfolioBasics.md. */
const calculateReturnPercent = (currentValue, costBasis) => {
    if (currentValue === null) return null;
    if (costBasis === 0) return null;
    return ((currentValue - costBasis) / costBasis) * 100;
};

/** Enriches one raw holding lot with its computed figures. A missing price degrades the lot, never throws. */
const enrichHolding = (holding, currentPrice) => {
    const costBasis = calculateCostBasis(holding.shares, holding.averagePurchasePrice);
    const currentValue = calculateCurrentValue(holding.shares, currentPrice);

    return {
        ...holding,
        currentPrice: typeof currentPrice === "number" && Number.isFinite(currentPrice) ? currentPrice : null,
        costBasis,
        currentValue,
        gainLoss: calculateGainLoss(currentValue, costBasis),
        returnPercent: calculateReturnPercent(currentValue, costBasis),
        priceUnavailable: currentValue === null,
    };
};

/**
 * Nets multiple lots of the same ticker into one position - two AAPL
 * purchases are one investment for weighting/concentration purposes, not
 * two. Any lot with an unknown price makes the whole position's value
 * unknown (can't average a known and an unknown into a number).
 */
const groupByTicker = (enrichedHoldings) => {
    const positions = new Map();

    for (const holding of enrichedHoldings) {
        const existing = positions.get(holding.ticker) || {
            ticker: holding.ticker,
            shares: 0,
            costBasis: 0,
            currentValue: 0,
            priceUnavailable: false,
        };

        existing.shares += holding.shares;
        existing.costBasis += holding.costBasis;
        existing.priceUnavailable = existing.priceUnavailable || holding.priceUnavailable;
        existing.currentValue = existing.priceUnavailable || holding.currentValue === null
            ? null
            : (existing.currentValue ?? 0) + holding.currentValue;

        positions.set(holding.ticker, existing);
    }

    return [...positions.values()].map((position) => ({
        ...position,
        gainLoss: calculateGainLoss(position.currentValue, position.costBasis),
        returnPercent: calculateReturnPercent(position.currentValue, position.costBasis),
    }));
};

/**
 * Portfolio-level totals and intelligence. Return % is computed from
 * summed totals (value-weighted), never averaged per-holding - see
 * PortfolioReturn.md for why that distinction matters. Totals only
 * include holdings with a known current price, so an unpriced holding
 * never silently drags the portfolio toward a fabricated loss; it's
 * reported separately in `unpricedHoldings` instead.
 */
const summarizePortfolio = (enrichedHoldings) => {
    const priced = enrichedHoldings.filter((h) => h.currentValue !== null);
    const unpriced = enrichedHoldings.filter((h) => h.currentValue === null);

    const totalCostBasis = priced.reduce((sum, h) => sum + h.costBasis, 0);
    const totalCurrentValue = priced.reduce((sum, h) => sum + h.currentValue, 0);
    const totalGainLoss = priced.length > 0 ? totalCurrentValue - totalCostBasis : null;
    const totalReturnPercent = priced.length > 0 ? calculateReturnPercent(totalCurrentValue, totalCostBasis) : null;

    const positions = groupByTicker(enrichedHoldings).map((position) => ({
        ticker: position.ticker,
        currentValue: position.currentValue,
        returnPercent: position.returnPercent,
        weightPercent:
            position.currentValue !== null && totalCurrentValue > 0
                ? (position.currentValue / totalCurrentValue) * 100
                : null,
    }));

    const pricedPositionsByValue = positions.filter((p) => p.currentValue !== null).sort((a, b) => b.currentValue - a.currentValue);
    const pricedPositionsByReturn = positions
        .filter((p) => p.returnPercent !== null)
        .sort((a, b) => b.returnPercent - a.returnPercent);

    const largestHolding = pricedPositionsByValue[0] || null;
    const bestPerformingHolding = pricedPositionsByReturn[0] || null;
    const worstPerformingHolding = pricedPositionsByReturn[pricedPositionsByReturn.length - 1] || null;

    const top3WeightPercent =
        pricedPositionsByValue.length > 0
            ? pricedPositionsByValue.slice(0, 3).reduce((sum, p) => sum + (p.weightPercent || 0), 0)
            : null;

    return {
        totalCostBasis,
        totalCurrentValue,
        totalGainLoss,
        totalReturnPercent,
        numberOfHoldings: enrichedHoldings.length,
        numberOfCompanies: positions.length,
        unpricedHoldings: unpriced.map((h) => ({ ticker: h.ticker, costBasis: h.costBasis })),
        largestHolding: largestHolding ? { ticker: largestHolding.ticker, weightPercent: largestHolding.weightPercent } : null,
        bestPerformingHolding: bestPerformingHolding
            ? { ticker: bestPerformingHolding.ticker, returnPercent: bestPerformingHolding.returnPercent }
            : null,
        worstPerformingHolding: worstPerformingHolding
            ? { ticker: worstPerformingHolding.ticker, returnPercent: worstPerformingHolding.returnPercent }
            : null,
        concentration: {
            topHoldingWeightPercent: largestHolding ? largestHolding.weightPercent : null,
            top3WeightPercent,
        },
    };
};

module.exports = {
    calculateCostBasis,
    calculateCurrentValue,
    calculateGainLoss,
    calculateReturnPercent,
    enrichHolding,
    groupByTicker,
    summarizePortfolio,
};
