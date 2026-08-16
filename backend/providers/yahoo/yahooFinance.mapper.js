const getValue = (value) => {
    if (value && typeof value === "object") {
        // Yahoo sometimes returns a malformed/empty object (e.g. {} for an
        // ETF's marketCap) instead of the usual {raw, fmt} shape or a plain
        // null - only a genuine {raw} value is usable, anything else isn't.
        return "raw" in value ? value.raw : null;
    }

    return value ?? null;
};

const mapYahooFinanceCompany = (response, requestedTicker) => {
    const quoteSummary = response?.quoteSummary?.result?.[0] || response?.result?.[0];

    if (!quoteSummary) {
        return null;
    }

    const profile = quoteSummary.assetProfile || quoteSummary.summaryProfile || {};
    const price = quoteSummary.price || {};

    return {
        ticker: getValue(price.symbol) || requestedTicker.toUpperCase(),
        name: getValue(price.longName) || getValue(price.shortName),
        exchange: getValue(price.exchangeName) || getValue(price.fullExchangeName),
        sector: getValue(profile.sector),
        industry: getValue(profile.industry),
        country: getValue(profile.country),
        currency: getValue(price.currency),
        website: getValue(profile.website),
        marketCap: getValue(price.marketCap),
        employees: getValue(profile.fullTimeEmployees),
        description: getValue(profile.longBusinessSummary),
        logo: getValue(profile.logo_url) || getValue(quoteSummary.logo_url),
    };
};

/**
 * Yahoo's equity screener returns one row per *listing*, not per company -
 * the same company routinely appears many times (a US primary listing plus
 * a dozen foreign cross-listings/ADRs, each with its own near-zero-volume
 * "phantom" quote in a different currency). Grouping by a normalized company
 * name and keeping only the highest-volume listing per group collapses that
 * noise down to one real, liquid candidate per company - verified against
 * live data: a "Consumer Electronics" screener query returns Apple ~13
 * times (volumes from 56M down to 0) but only ever one genuine primary
 * listing per company (see research/engineering/IndustryCompanyDiscovery.md).
 */
const NAME_SUFFIX_PATTERN =
    /\b(inc|incorporated|corp|corporation|co|company|ltd|limited|plc|group|holdings?|s\.?a\.?|ag|nv|se|llc)\.?\b/gi;

const normalizeCompanyName = (name) =>
    (name || "")
        .toLowerCase()
        .replace(NAME_SUFFIX_PATTERN, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

/**
 * @param {object} response - raw Yahoo `/v1/finance/screener` JSON
 * @returns {Array<{ticker: string, name: string, exchange: string|null, marketCap: number|null}>}
 *   one entry per distinct company, highest-3-month-average-volume listing only
 */
const mapYahooScreenerCandidates = (response) => {
    const quotes = response?.finance?.result?.[0]?.quotes;

    if (!Array.isArray(quotes)) {
        return [];
    }

    const bestByCompany = new Map();

    quotes.forEach((quote) => {
        const name = quote.longName || quote.shortName;
        const ticker = quote.symbol;

        if (!name || !ticker) {
            return; // a handful of screener rows come back with neither field populated - not usable as a candidate
        }

        const volume = typeof quote.averageDailyVolume3Month === "number" ? quote.averageDailyVolume3Month : 0;
        const key = normalizeCompanyName(name) || ticker.toLowerCase();
        const existing = bestByCompany.get(key);

        if (!existing || volume > existing.volume) {
            bestByCompany.set(key, {
                ticker,
                name,
                exchange: quote.fullExchangeName || quote.exchange || null,
                marketCap: typeof quote.marketCap === "number" ? quote.marketCap : null,
                volume,
            });
        }
    });

    return Array.from(bestByCompany.values())
        .sort((first, second) => (second.marketCap ?? 0) - (first.marketCap ?? 0))
        .map(({ ticker, name, exchange, marketCap }) => ({ ticker, name, exchange, marketCap }));
};

module.exports = mapYahooFinanceCompany;
module.exports.mapYahooScreenerCandidates = mapYahooScreenerCandidates;
module.exports.normalizeCompanyName = normalizeCompanyName;
