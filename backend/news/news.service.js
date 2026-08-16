/**
 * News Service
 *
 * Orchestrates the deterministic news pipeline: provider -> normalize ->
 * classify -> deduplicate -> persist -> serve. Mirrors market.service.js's
 * shape (Company lookup, Mongo-backed cache with a freshness gate, never
 * hitting the provider on every request) rather than inventing a new
 * pattern - see research/engineering/NewsCaching.md.
 */

const NewsArticle = require("./news.model");
const Company = require("../models/company.model");
const newsProvider = require("./providers/newsProvider.registry");
const normalizer = require("./news.normalizer");
const classifier = require("./news.classifier");
const deduplicator = require("./news.deduplicator");
const env = require("../config/env");
const logger = require("../utils/logger");

class CompanyNotFoundError extends Error {
    constructor(ticker) {
        super(`Company ${ticker} was not found. Resolve or import the company before requesting news.`);
        this.name = "CompanyNotFoundError";
        this.statusCode = 404;
    }
}

const normalizeTicker = (ticker) => ticker.trim().toUpperCase();

const findCompany = async (ticker) => {
    const company = await Company.findOne({ ticker }).select("name ticker").lean();
    if (!company) {
        throw new CompanyNotFoundError(ticker);
    }
    return company;
};

const EXISTING_ARTICLE_FIELDS = "provider providerArticleId canonicalUrl title publishedAt";

/**
 * A merge's $set payload: re-syncs category/classificationConfidence to
 * what the current classifier would produce for this article right now,
 * not just at whenever the row was first inserted. Classification is a
 * pure, deterministic function of title/description (news.classifier.js),
 * so this is always safe to overwrite - it can only make a stored article's
 * category more current (e.g. after a keyword-list improvement), never
 * introduce nondeterministic "flapping" between refreshes of the same story.
 */
const mergeUpdate = (ticker, article) => ({
    $addToSet: { tickers: ticker },
    $set: { category: article.category, classificationConfidence: article.classificationConfidence },
});

/**
 * Persists one batch of normalized+classified articles for `ticker`,
 * deduplicating against articles already stored for it (see
 * news.deduplicator.js). A duplicate hit adds `ticker` to the existing
 * document's `tickers` array and re-syncs its category (see mergeUpdate)
 * instead of inserting a new row.
 */
const persistArticles = async (ticker, classifiedArticles) => {
    if (classifiedArticles.length === 0) {
        return { inserted: 0, merged: 0 };
    }

    const existingForTicker = await NewsArticle.find({ tickers: ticker }).select(EXISTING_ARTICLE_FIELDS).lean();

    let inserted = 0;
    let merged = 0;
    const seenInThisBatch = [];

    for (const article of classifiedArticles) {
        const candidatePool = [...existingForTicker, ...seenInThisBatch];
        const duplicate = deduplicator.findDuplicate(article, candidatePool);

        if (duplicate) {
            if (duplicate._id) {
                await NewsArticle.updateOne({ _id: duplicate._id }, mergeUpdate(ticker, article));
                merged += 1;
            }
            // A duplicate within this same not-yet-persisted batch has no
            // _id to merge into yet - it's simply skipped (the first
            // occurrence already carries this ticker and, since both came
            // from the same classification pass, already has the same category).
            continue;
        }

        try {
            const doc = await NewsArticle.create({ ...article, tickers: [ticker] });
            seenInThisBatch.push({
                _id: doc._id,
                provider: doc.provider,
                providerArticleId: doc.providerArticleId,
                canonicalUrl: doc.canonicalUrl,
                title: doc.title,
                publishedAt: doc.publishedAt,
            });
            inserted += 1;
        } catch (error) {
            // canonicalUrl's unique index can race with a concurrent
            // refresh for another ticker - treat that as a merge rather
            // than failing the whole batch.
            if (error.code === 11000) {
                await NewsArticle.updateOne({ canonicalUrl: article.canonicalUrl }, mergeUpdate(ticker, article));
                merged += 1;
            } else {
                throw error;
            }
        }
    }

    return { inserted, merged };
};

const refreshFromProvider = async (ticker, companyName) => {
    const rawArticles = await newsProvider.getNewsForTicker(ticker, companyName);
    const normalized = normalizer.normalizeArticles(rawArticles, {
        providerName: newsProvider.providerName,
        ticker,
        companyName,
    });

    const classified = normalized.map((article) => {
        const { category, confidence } = classifier.classifyArticle(article);
        return { ...article, category, classificationConfidence: confidence };
    });

    return persistArticles(ticker, classified);
};

const getFreshestRetrievedAt = async (ticker) => {
    const latest = await NewsArticle.findOne({ tickers: ticker }).sort({ retrievedAt: -1 }).select("retrievedAt").lean();
    return latest?.retrievedAt || null;
};

const isStale = (freshestRetrievedAt) =>
    !freshestRetrievedAt || Date.now() - new Date(freshestRetrievedAt).getTime() > env.newsCacheTtlMs;

const DEFAULT_ARTICLE_LIMIT = 20;

/**
 * GET /api/news/:ticker - serves cached articles, refreshing from the
 * provider first only if nothing is stored yet or the cache has passed its
 * TTL. A refresh failure degrades to "serve whatever is cached" (possibly
 * empty) rather than failing the request - see
 * research/engineering/ExternalAPIReliability.md.
 *
 * @param {string} ticker
 * @param {{limit?: number, category?: string, from?: string, to?: string}} [filters]
 */
const getNews = async (ticker, filters = {}) => {
    const normalizedTicker = normalizeTicker(ticker);
    const company = await findCompany(normalizedTicker);

    const freshestRetrievedAt = await getFreshestRetrievedAt(normalizedTicker);
    let lastRefreshedAt = freshestRetrievedAt;

    if (isStale(freshestRetrievedAt)) {
        try {
            await refreshFromProvider(normalizedTicker, company.name);
            lastRefreshedAt = new Date().toISOString();
        } catch (error) {
            logger.warn({ err: error, ticker: normalizedTicker }, "News refresh failed; serving cached articles if any");
        }
    }

    const query = { tickers: normalizedTicker };
    if (filters.category) {
        query.category = filters.category;
    }
    if (filters.from || filters.to) {
        query.publishedAt = {};
        if (filters.from) query.publishedAt.$gte = new Date(filters.from);
        if (filters.to) query.publishedAt.$lte = new Date(filters.to);
    }

    const articles = await NewsArticle.find(query)
        .sort({ publishedAt: -1 })
        .limit(filters.limit || DEFAULT_ARTICLE_LIMIT)
        .select("-tickers -__v -relatedTickers")
        .lean();

    return { ticker: normalizedTicker, articles, lastRefreshedAt, provider: newsProvider.providerName };
};

/** POST /api/news/:ticker/refresh - always calls the provider now, ignoring the TTL. Rate-limited at the route level. */
const refreshNews = async (ticker) => {
    const normalizedTicker = normalizeTicker(ticker);
    const company = await findCompany(normalizedTicker);

    const result = await refreshFromProvider(normalizedTicker, company.name);

    return { ticker: normalizedTicker, ...result, lastRefreshedAt: new Date().toISOString(), provider: newsProvider.providerName };
};

/** GET /api/news/:ticker/categories - counts per category for this ticker's stored articles. */
const getCategorySummary = async (ticker) => {
    const normalizedTicker = normalizeTicker(ticker);
    await findCompany(normalizedTicker);

    const counts = await NewsArticle.aggregate([
        { $match: { tickers: normalizedTicker } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
    ]);

    return {
        ticker: normalizedTicker,
        categories: counts.map((entry) => ({ category: entry._id, count: entry.count })),
        total: counts.reduce((sum, entry) => sum + entry.count, 0),
    };
};

/** Latest stored article for a ticker, DB-only - never triggers a provider call. Used by Watchlist rows. Never throws. */
const getLatestStoredArticle = async (ticker) => {
    const normalizedTicker = normalizeTicker(ticker);
    try {
        return await NewsArticle.findOne({ tickers: normalizedTicker })
            .sort({ publishedAt: -1 })
            .select("title category publishedAt url source")
            .lean();
    } catch (error) {
        logger.warn({ err: error, ticker: normalizedTicker }, "Could not load latest stored news article");
        return null;
    }
};

/** Most recent N stored articles for a ticker, DB-only - used by the AI Context Builder. Never throws. */
const getRecentArticlesForContext = async (ticker, limit) => {
    const normalizedTicker = normalizeTicker(ticker);
    try {
        return await NewsArticle.find({ tickers: normalizedTicker })
            .sort({ publishedAt: -1 })
            .limit(limit)
            .select("title description source publishedAt category url")
            .lean();
    } catch (error) {
        logger.warn({ err: error, ticker: normalizedTicker }, "Could not load recent news for AI context");
        return [];
    }
};

/**
 * Stored articles for `ticker` published since `sinceDate`, restricted to
 * `categories` - DB-only, never triggers a provider call. Used by the Alert
 * Engine's News rules (backend/alerts/alert.engine.js) to find important
 * events without duplicating this codebase's only classification/dedup
 * pipeline - articles are already deduplicated at write time (see
 * news.deduplicator.js), so no additional merging is needed here. Never
 * throws - a lookup failure yields no news alerts for this ticker, not a
 * failed monitoring pass.
 */
const getImportantArticlesSince = async (ticker, sinceDate, categories) => {
    const normalizedTicker = normalizeTicker(ticker);
    try {
        return await NewsArticle.find({
            tickers: normalizedTicker,
            category: { $in: categories },
            publishedAt: { $gte: sinceDate },
        })
            .sort({ publishedAt: -1 })
            .select("title description category publishedAt url source")
            .lean();
    } catch (error) {
        logger.warn({ err: error, ticker: normalizedTicker }, "Could not load important news for alert monitoring");
        return [];
    }
};

module.exports = {
    getNews,
    refreshNews,
    getCategorySummary,
    getLatestStoredArticle,
    getRecentArticlesForContext,
    getImportantArticlesSince,
    CompanyNotFoundError,
    DEFAULT_ARTICLE_LIMIT,
};
