/**
 * Portfolio Calculator
 *
 * Pure functions only - no I/O, no Mongoose, no fetching. Same shape as
 * dcf.formulas.js/comps.formulas.js: given numbers, return numbers, so the
 * math is unit-testable without mocking a database or a market provider.
 * See PortfolioReturn.md / ConcentrationRisk.md.
 *
 * CURRENCY NORMALIZATION
 * -----------------------
 * `costBasis`/`currentValue`/`gainLoss`/`returnPercent` stay in each
 * holding's OWN native currency - correct and unchanged for per-row
 * display (a USD holding's numbers are USD, an INR holding's numbers are
 * INR, and a single ticker's own return % is a same-currency ratio either
 * way, so it's never affected by conversion).
 *
 * `costBasisUSD`/`currentValueUSD` are the SAME figures converted to USD
 * using an already-resolved exchange rate (fetched by the caller, e.g.
 * portfolio.service.js via market/providers/fxRate.provider.js - this
 * module stays pure and never fetches a rate itself). These USD fields
 * exist specifically because summing native-currency numbers ACROSS
 * holdings in different currencies is meaningless (₹9,260 is not $9,260) -
 * every cross-holding aggregate (portfolio totals, weightPercent,
 * concentration) in this module is built from the USD fields, never the
 * native ones. See PortfolioBasics.md's currency limitation and
 * PortfolioCurrencyNormalization.md.
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

/** null (not a silently-wrong number) when the amount or the exchange rate is unknown - "can't convert" is a different fact from "converts to zero." */
const convertToUSD = (amount, fxRateToUSD) =>
    typeof amount === "number" && Number.isFinite(amount) && typeof fxRateToUSD === "number" && Number.isFinite(fxRateToUSD)
        ? amount * fxRateToUSD
        : null;

/**
 * Total return folding in dividend income alongside price-based unrealized
 * gain/loss - additive to summarizePortfolio's existing totalGainLoss/
 * totalReturnPercent (left untouched, still price-only) rather than a
 * breaking replacement. null-safe the same way calculateReturnPercent is:
 * an unknown price-based gain makes the combined figure unknown too, since
 * "dividends only" would understate a portfolio with unpriced holdings.
 */
const calculateTotalReturn = (unrealizedGainLossUSD, dividendIncomeUSD, totalCostBasisUSD) => {
    if (unrealizedGainLossUSD === null) {
        return { totalDividendIncome: dividendIncomeUSD, totalReturnIncludingDividends: null, totalReturnIncludingDividendsPercent: null };
    }

    const totalReturnIncludingDividends = unrealizedGainLossUSD + dividendIncomeUSD;
    const totalReturnIncludingDividendsPercent =
        typeof totalCostBasisUSD === "number" && totalCostBasisUSD > 0
            ? (totalReturnIncludingDividends / totalCostBasisUSD) * 100
            : null;

    return { totalDividendIncome: dividendIncomeUSD, totalReturnIncludingDividends, totalReturnIncludingDividendsPercent };
};

/**
 * Enriches one raw holding lot with its computed figures. A missing price
 * or a missing FX rate each degrade only what they affect - never throws,
 * never fabricates a value for the piece that's actually unknown.
 * @param {number|null} fxRateToUSD - USD value of one unit of the holding's currency (1 for USD); null if unavailable
 */
const enrichHolding = (holding, currentPrice, fxRateToUSD = 1) => {
    const costBasis = calculateCostBasis(holding.shares, holding.averagePurchasePrice);
    const currentValue = calculateCurrentValue(holding.shares, currentPrice);

    return {
        ...holding,
        currentPrice: typeof currentPrice === "number" && Number.isFinite(currentPrice) ? currentPrice : null,
        costBasis,
        currentValue,
        costBasisUSD: convertToUSD(costBasis, fxRateToUSD),
        currentValueUSD: convertToUSD(currentValue, fxRateToUSD),
        gainLoss: calculateGainLoss(currentValue, costBasis),
        returnPercent: calculateReturnPercent(currentValue, costBasis),
        priceUnavailable: currentValue === null,
        fxRateUnavailable: fxRateToUSD === null,
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
            costBasisUSD: 0,
            currentValueUSD: 0,
            priceUnavailable: false,
            usdValueUnavailable: false,
        };

        existing.shares += holding.shares;
        existing.costBasis += holding.costBasis;
        existing.priceUnavailable = existing.priceUnavailable || holding.priceUnavailable;
        existing.currentValue = existing.priceUnavailable || holding.currentValue === null
            ? null
            : (existing.currentValue ?? 0) + holding.currentValue;

        // A lot's USD value is unusable if either its price OR its currency's exchange rate is unknown - either gap makes the USD figure unknown, not just the native one.
        existing.usdValueUnavailable = existing.usdValueUnavailable || holding.priceUnavailable || holding.fxRateUnavailable;
        existing.costBasisUSD = existing.usdValueUnavailable ? null : (existing.costBasisUSD ?? 0) + holding.costBasisUSD;
        existing.currentValueUSD = existing.usdValueUnavailable || holding.currentValueUSD === null
            ? null
            : (existing.currentValueUSD ?? 0) + holding.currentValueUSD;

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
 * PortfolioReturn.md for why that distinction matters.
 *
 * Every $-denominated total/weight here (totalCostBasis, totalCurrentValue,
 * weightPercent, concentration) is built from the USD-normalized fields,
 * NOT the native-currency ones - summing ₹9,260 and $4,013 as if both were
 * dollars would silently misstate every one of these. returnPercent-based
 * rankings (bestPerformingHolding/worstPerformingHolding) need no such
 * conversion - a percentage is already currency-invariant, so those
 * compare directly across currencies with zero FX involved.
 *
 * A holding only counts toward these totals if its USD value is known
 * (`currentValueUSD !== null`), which fails for two DIFFERENT reasons
 * reported separately, never conflated: an unknown current price
 * (`unpricedHoldings`) vs. a known price but an unavailable exchange rate
 * (`fxUnavailableHoldings`). See PortfolioCurrencyNormalization.md.
 */
const summarizePortfolio = (enrichedHoldings) => {
    const priced = enrichedHoldings.filter((h) => h.currentValueUSD !== null);
    const unpriced = enrichedHoldings.filter((h) => h.currentValue === null);
    const fxUnavailable = enrichedHoldings.filter((h) => h.currentValue !== null && h.currentValueUSD === null);

    const totalCostBasis = priced.reduce((sum, h) => sum + h.costBasisUSD, 0);
    const totalCurrentValue = priced.reduce((sum, h) => sum + h.currentValueUSD, 0);
    const totalGainLoss = priced.length > 0 ? totalCurrentValue - totalCostBasis : null;
    const totalReturnPercent = priced.length > 0 ? calculateReturnPercent(totalCurrentValue, totalCostBasis) : null;

    const positions = groupByTicker(enrichedHoldings).map((position) => ({
        ticker: position.ticker,
        currentValueUSD: position.currentValueUSD,
        returnPercent: position.returnPercent,
        weightPercent:
            position.currentValueUSD !== null && totalCurrentValue > 0
                ? (position.currentValueUSD / totalCurrentValue) * 100
                : null,
    }));

    const pricedPositionsByValue = positions
        .filter((p) => p.currentValueUSD !== null)
        .sort((a, b) => b.currentValueUSD - a.currentValueUSD);
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
        numberOfCompanies: groupByTicker(enrichedHoldings).length,
        unpricedHoldings: unpriced.map((h) => ({ ticker: h.ticker, costBasis: h.costBasis })),
        fxUnavailableHoldings: fxUnavailable.map((h) => ({ ticker: h.ticker, currency: h.currency ?? null, currentValue: h.currentValue })),
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
    calculateTotalReturn,
    enrichHolding,
    groupByTicker,
    summarizePortfolio,
};
