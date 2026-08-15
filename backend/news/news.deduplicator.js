/**
 * News Deduplicator
 *
 * Three tiers, cheapest/most-reliable first, deliberately NOT semantic
 * similarity (see Sprint 10 brief's "do not over-engineer semantic
 * similarity" instruction and research/engineering/NewsDeduplication.md):
 *
 *  1. Same provider + providerArticleId (Yahoo/Marketaux both supply a uuid).
 *  2. Same canonicalUrl (catches the common case with no provider ID, or a
 *     second provider re-publishing the exact same link).
 *  3. Same-day title similarity (token-set overlap) - catches wire-service
 *     reprints (e.g. the same Reuters/AP story) that land on different
 *     publisher URLs with no shared provider ID.
 *
 * Pure functions only - no DB I/O here. news.service.js is responsible for
 * fetching the bounded candidate set (existing articles for the same
 * ticker) that gets passed in.
 */

const STOPWORDS = new Set(["a", "an", "the", "to", "of", "in", "on", "for", "and", "with", "at", "by", "is", "as"]);

const tokenize = (title) =>
    (title || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((token) => token && !STOPWORDS.has(token));

/** Jaccard token overlap - cheap and deterministic, not a semantic/embedding comparison. */
const titleSimilarity = (titleA, titleB) => {
    const tokensA = new Set(tokenize(titleA));
    const tokensB = new Set(tokenize(titleB));

    if (tokensA.size === 0 || tokensB.size === 0) {
        return 0;
    }

    const intersectionSize = [...tokensA].filter((token) => tokensB.has(token)).length;
    const unionSize = new Set([...tokensA, ...tokensB]).size;

    return intersectionSize / unionSize;
};

const TITLE_SIMILARITY_THRESHOLD = 0.85;

// publishedAt arrives as an ISO string on an in-memory candidate (from
// news.normalizer.js) but as a native Date on anything read back from
// Mongo (schema type Date, unaffected by .lean()) - normalize both to a
// plain YYYY-MM-DD key before comparing instead of assuming either shape.
const toDateKey = (value) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

const isSameDay = (a, b) => {
    const dayA = toDateKey(a);
    const dayB = toDateKey(b);
    return Boolean(dayA) && Boolean(dayB) && dayA === dayB;
};

/**
 * @param {object} candidate - a normalized+classified article not yet persisted
 * @param {object[]} existingArticles - bounded candidate set (e.g. already-stored
 *   articles for the same ticker), each with at least
 *   {provider, providerArticleId, canonicalUrl, title, publishedAt}
 * @returns {object|null} the matching existing article, or null if `candidate` is new
 */
const findDuplicate = (candidate, existingArticles) => {
    if (candidate.providerArticleId) {
        const byProviderId = existingArticles.find(
            (existing) =>
                existing.provider === candidate.provider && existing.providerArticleId === candidate.providerArticleId
        );
        if (byProviderId) return byProviderId;
    }

    const byUrl = existingArticles.find((existing) => existing.canonicalUrl === candidate.canonicalUrl);
    if (byUrl) return byUrl;

    return (
        existingArticles.find(
            (existing) =>
                isSameDay(candidate.publishedAt, existing.publishedAt) &&
                titleSimilarity(candidate.title, existing.title) >= TITLE_SIMILARITY_THRESHOLD
        ) || null
    );
};

module.exports = { titleSimilarity, findDuplicate, TITLE_SIMILARITY_THRESHOLD };
