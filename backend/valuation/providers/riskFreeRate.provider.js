/**
 * Risk-Free Rate Provider
 *
 * Live risk-free rate proxy: the 10-Year US Treasury yield (Yahoo symbol
 * ^TNX). Uses the raw market data provider directly rather than
 * market.service.js's getCurrentMarketData, because that function requires
 * the symbol to already exist as a Company document - ^TNX is a treasury
 * yield index, not a company, so it has no Company record and would 404.
 *
 * Cached in-memory with a much longer TTL than market.service.js's
 * per-ticker quote cache: this is one shared macro value (not
 * per-company), and treasury yields don't need second-level freshness for
 * a "reasonable starting input" - it's presented as a labeled, editable
 * default, never used silently in a DCF calculation.
 */

const marketDataProvider = require("../../market/providers/marketData.provider.registry");

const TEN_YEAR_TREASURY_SYMBOL = "^TNX";
const CACHE_TTL_MS = 30 * 60 * 1000;

let cache = null;

/**
 * @returns {Promise<number|null>} risk-free rate as a decimal (e.g. 0.043 for 4.3%), or null if unavailable
 */
const getRiskFreeRate = async () => {
    if (cache && cache.expiresAt > Date.now()) {
        return cache.rate;
    }

    try {
        const quote = await marketDataProvider.getQuote(TEN_YEAR_TREASURY_SYMBOL);
        const yieldPercent = quote?.price?.current;

        if (typeof yieldPercent !== "number") {
            return null;
        }

        const rate = yieldPercent / 100;
        cache = { rate, expiresAt: Date.now() + CACHE_TTL_MS };
        return rate;
    } catch (error) {
        return null;
    }
};

/** Test-only: clears the in-memory cache so tests don't leak state across runs. */
const _resetCache = () => {
    cache = null;
};

module.exports = { getRiskFreeRate, TEN_YEAR_TREASURY_SYMBOL, _resetCache };
