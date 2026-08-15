const mongoose = require("mongoose");
const { CATEGORIES } = require("./news.classifier");
const env = require("../config/env");

/**
 * NewsArticle
 *
 * One document per distinct story (see news.deduplicator.js) - not one per
 * (article, ticker) pairing. `tickers` holds every company this article has
 * been matched to so a syndicated story surfacing under a second ticker's
 * search merges into the existing row ($addToSet) instead of duplicating
 * it. See research/engineering/NewsNormalization.md for why this departs
 * from the single-`ticker` shape used in-memory by news.normalizer.js.
 *
 * Retention: a Mongo TTL index on `retrievedAt` auto-expires articles after
 * env.newsRetentionDays (default 90) - no separate archival job, see
 * research/engineering/NewsCaching.md.
 */
const newsArticleSchema = new mongoose.Schema(
    {
        tickers: {
            type: [String],
            required: true,
            validate: {
                validator: (value) => Array.isArray(value) && value.length > 0,
                message: "tickers must contain at least one ticker.",
            },
        },
        title: { type: String, required: true, trim: true },
        description: { type: String, default: null },
        url: { type: String, required: true, trim: true },
        canonicalUrl: { type: String, required: true, trim: true },
        source: { type: String, default: null, trim: true },
        author: { type: String, default: null, trim: true },
        imageUrl: { type: String, default: null },
        publishedAt: { type: Date, required: true },
        retrievedAt: {
            type: Date,
            required: true,
            default: Date.now,
            index: { expires: `${env.newsRetentionDays}d` },
        },
        category: { type: String, required: true, enum: CATEGORIES, default: "Other" },
        classificationConfidence: { type: String, enum: ["high", "low"], required: true },
        provider: { type: String, required: true, trim: true },
        providerArticleId: { type: String, default: null, trim: true },
        relatedTickers: { type: [String], default: [] },
    },
    { timestamps: true }
);

newsArticleSchema.index({ tickers: 1, publishedAt: -1 });
newsArticleSchema.index({ tickers: 1, category: 1 });
newsArticleSchema.index({ canonicalUrl: 1 }, { unique: true });

module.exports = mongoose.model("NewsArticle", newsArticleSchema);
