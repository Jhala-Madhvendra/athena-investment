/**
 * FX Rate Provider
 *
 * Live currency-conversion rates to USD, sourced from Yahoo Finance's FX
 * pair quotes (e.g. `USDINR=X`) via the raw market data provider directly -
 * same reason riskFreeRate.provider.js bypasses market.service: a currency
 * pair isn't a Company, so market.service.getCurrentMarketData (which
 * requires an existing Company document) would 404 on it.
 *
 * Cached in-memory per currency, same TTL rationale as riskFreeRate.provider.js:
 * FX rates are a shared macro value (not per-user, not per-holding), and
 * don't need second-level freshness for portfolio valuation - a rate is
 * presented as "live, cached for up to 30 minutes," never silently stale
 * for longer than that.
 */

const marketDataProvider = require("./marketData.provider.registry");

const BASE_CURRENCY = "USD";
const CACHE_TTL_MS = 30 * 60 * 1000;

const cache = new Map();

/**
 * @param {string|null|undefined} currency - a 3-letter ISO currency code (e.g. "INR"), or USD/falsy
 * @returns {Promise<number|null>} USD value of one unit of `currency` (e.g. ~0.0105 for INR), 1 for USD/falsy, or null if unavailable
 */
const getRateToUSD = async (currency) => {
    if (!currency || currency === BASE_CURRENCY) {
        return 1;
    }

    const cached = cache.get(currency);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.rate;
    }

    try {
        // USD<currency>=X quotes how many units of `currency` equal 1 USD (e.g. USDINR=X ~= 87) - invert to get USD per unit of `currency`.
        const quote = await marketDataProvider.getQuote(`${BASE_CURRENCY}${currency}=X`);
        const unitsOfCurrencyPerUSD = quote?.price?.current;

        if (typeof unitsOfCurrencyPerUSD !== "number" || !Number.isFinite(unitsOfCurrencyPerUSD) || unitsOfCurrencyPerUSD <= 0) {
            return null;
        }

        const rate = 1 / unitsOfCurrencyPerUSD;
        cache.set(currency, { rate, expiresAt: Date.now() + CACHE_TTL_MS });
        return rate;
    } catch {
        return null;
    }
};

/**
 * Attaches `marketCapUSD` to each item using its own currency's live FX
 * rate - shared by every cross-company market-cap comparison in Athena
 * (Industry peer discovery, AI auto-peer selection for Comps) so the
 * currency-normalization logic isn't duplicated per caller. Items sharing
 * a currency reuse one fetched rate (deduped), same pattern as
 * portfolio.service.js's fetchFxRatesByCurrency - comparing raw market
 * caps across currencies (e.g. an INR figure against a USD one) silently
 * misranks "closest market cap" peers exactly the way it silently
 * misweighted portfolio holdings; see PortfolioCurrencyNormalization.md.
 * @param {{marketCap: number|null, currency: string|null}[]} items
 * @returns {Promise<object[]>} same items (same order), each with an added `marketCapUSD` field (null if unconvertible)
 */
const attachMarketCapUSD = async (items) => {
    const uniqueCurrencies = [...new Set(items.map((item) => item.currency))];
    const rateEntries = await Promise.all(uniqueCurrencies.map(async (currency) => [currency, await getRateToUSD(currency)]));
    const ratesByCurrency = new Map(rateEntries);

    return items.map((item) => {
        const rate = ratesByCurrency.get(item.currency);
        const marketCapUSD =
            typeof item.marketCap === "number" &&
            Number.isFinite(item.marketCap) &&
            typeof rate === "number" &&
            Number.isFinite(rate)
                ? item.marketCap * rate
                : null;
        return { ...item, marketCapUSD };
    });
};

/** Test-only: clears the in-memory cache so tests don't leak state across runs. */
const _resetCache = () => {
    cache.clear();
};

module.exports = { getRateToUSD, attachMarketCapUSD, BASE_CURRENCY, _resetCache };
