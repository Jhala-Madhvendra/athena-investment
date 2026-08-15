/**
 * News Normalizer
 *
 * Maps each provider's raw article shape into Athena's internal news
 * schema. This is the only place that knows what Yahoo's search feed,
 * Marketaux's news API, or the mock provider's fixtures each look like -
 * everything downstream (classifier, deduplicator, news.service.js,
 * the API response, the AI context) depends only on the normalized shape.
 */

const toIsoDate = (value) => {
    if (typeof value === "number") {
        // Yahoo's providerPublishTime is unix seconds.
        return new Date(value * 1000).toISOString();
    }
    if (typeof value === "string" && value) {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }
    return null;
};

/** Strips tracking params and normalizes host/path so syndicated links to the same story compare equal. */
const canonicalizeUrl = (rawUrl) => {
    try {
        const url = new URL(rawUrl);
        [...url.searchParams.keys()]
            .filter((key) => key.toLowerCase().startsWith("utm_") || ["ref", "src"].includes(key.toLowerCase()))
            .forEach((key) => url.searchParams.delete(key));
        url.hash = "";
        const path = url.pathname.replace(/\/+$/, "");
        const query = url.searchParams.toString();
        return `${url.protocol}//${url.host.toLowerCase()}${path}${query ? `?${query}` : ""}`;
    } catch {
        return rawUrl;
    }
};

const mapYahooArticle = (raw) => ({
    title: raw.title || null,
    // Yahoo's search-based news feed doesn't return a summary/description field.
    description: null,
    url: raw.link || null,
    source: raw.publisher || null,
    author: null,
    imageUrl: raw.thumbnail?.resolutions?.[0]?.url || null,
    publishedAt: toIsoDate(raw.providerPublishTime),
    providerArticleId: raw.uuid || null,
    relatedTickers: Array.isArray(raw.relatedTickers) ? raw.relatedTickers : [],
});

const mapMarketauxArticle = (raw) => ({
    title: raw.title || null,
    description: raw.description || raw.snippet || null,
    url: raw.url || null,
    source: raw.source || null,
    author: null,
    imageUrl: raw.image_url || null,
    publishedAt: toIsoDate(raw.published_at),
    providerArticleId: raw.uuid || null,
    relatedTickers: Array.isArray(raw.entities) ? raw.entities.map((entity) => entity.symbol).filter(Boolean) : [],
});

const mapMockArticle = (raw) => ({
    title: raw.title || null,
    description: raw.description || null,
    url: raw.url || null,
    source: raw.source || null,
    author: null,
    imageUrl: null,
    publishedAt: toIsoDate(raw.publishedAt),
    providerArticleId: raw.id || null,
    relatedTickers: [],
});

const MAPPERS = { yahoo: mapYahooArticle, marketaux: mapMarketauxArticle, mock: mapMockArticle };

/**
 * @param {object} rawArticle - one provider-specific news item
 * @param {{providerName: string, ticker: string, companyName?: string|null}} context
 * @returns {object|null} the normalized article, or null if it's missing a
 *   load-bearing field (title, url, or publishedAt) - never fabricated.
 */
const normalizeArticle = (rawArticle, { providerName, ticker, companyName }) => {
    const mapper = MAPPERS[providerName];
    if (!mapper) {
        throw new Error(`No normalizer registered for news provider "${providerName}".`);
    }

    const mapped = mapper(rawArticle);

    if (!mapped.title || !mapped.url || !mapped.publishedAt) {
        return null;
    }

    return {
        ...mapped,
        canonicalUrl: canonicalizeUrl(mapped.url),
        retrievedAt: new Date().toISOString(),
        ticker,
        companyName: companyName || null,
        provider: providerName,
    };
};

const normalizeArticles = (rawArticles, context) =>
    (rawArticles || []).map((raw) => normalizeArticle(raw, context)).filter(Boolean);

module.exports = { normalizeArticle, normalizeArticles, canonicalizeUrl };
