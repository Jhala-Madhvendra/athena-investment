const mongoose = require("mongoose");
const env = require("../config/env");

/** The six alert categories Sprint 11 supports - see research/product/IntelligentAlertsProductDesign.md. */
const ALERT_TYPES = ["MARKET", "FINANCIAL", "BUSINESS", "VALUATION", "NEWS", "PORTFOLIO"];

/** No CRITICAL tier - see alert.severity.js for the criteria that assign these. */
const ALERT_SEVERITIES = ["INFO", "MEDIUM", "HIGH"];

/**
 * One meaningful, rule-triggered change for one user's tracked ticker.
 * Always user-scoped (read/dismiss state is inherently personal, and only
 * users actually tracking a ticker should see alerts about it) even though
 * the underlying fact may be computed once and shared - see
 * alertSnapshot.model.js for the ticker-level snapshot that feeds this.
 *
 * `rule` + `periodKey` (together with userId/ticker/type) form the
 * deduplication identity enforced by the unique index below - see
 * alert.deduplicator.js for how periodKey is derived per rule family.
 *
 * Retention: a Mongo TTL index on `createdAt` auto-expires alerts after
 * env.alertRetentionDays (default 90, matching the News precedent) - a
 * three-month-old "margin declined" alert has no decision value once newer
 * financials/prices have superseded it. No separate archival job, same
 * reasoning as research/engineering/NewsCaching.md.
 */
const alertSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        ticker: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
            match: /^[A-Z0-9.-]+$/,
        },
        type: {
            type: String,
            required: true,
            enum: ALERT_TYPES,
        },
        // Stable rule identifier, e.g. "PRICE_DROP_5D" - see alert.rules.js.
        rule: {
            type: String,
            required: true,
            trim: true,
        },
        // Dedup component: what window/period this specific trigger belongs
        // to (a day, a fiscal-year pair, an article id...). See
        // alert.deduplicator.js.
        periodKey: {
            type: String,
            required: true,
            trim: true,
        },
        severity: {
            type: String,
            required: true,
            enum: ALERT_SEVERITIES,
        },
        // What happened - short, e.g. "Operating margin declined".
        title: {
            type: String,
            required: true,
            trim: true,
        },
        // What happened, with the numbers - e.g. "32.1% -> 28.7%".
        message: {
            type: String,
            required: true,
            trim: true,
        },
        // Why it matters - deterministic, rule-authored explanation (never
        // AI-generated - see alert.engine.js).
        whyItMatters: {
            type: String,
            required: true,
            trim: true,
        },
        // Machine-readable identifiers for the AlertDetail view / tests.
        metric: { type: String, default: null },
        previousValue: { type: Number, default: null },
        currentValue: { type: Number, default: null },
        percentChange: { type: Number, default: null },
        threshold: { type: Number, default: null },
        // Where the evidence came from, e.g. "FY2026 financial statements",
        // "Yahoo Finance market data", or a news article's source name.
        source: {
            type: String,
            required: true,
            trim: true,
        },
        // Human-readable period the evidence covers, e.g.
        // "FY2025 -> FY2026" or "5 trading sessions ending 2026-08-13" -
        // kept distinct from triggeredAt/createdAt so a financial-statement
        // change is never presented as a real-time event.
        evidencePeriod: { type: String, default: null },
        // When the underlying observation was made (latest trading date,
        // the date Athena imported the financial statement, or the news
        // article's publishedAt) - distinct from createdAt, which is when
        // this Alert document itself was generated.
        triggeredAt: {
            type: Date,
            required: true,
            default: Date.now,
        },
        // Rule-specific extra evidence (e.g. { newsArticleId, url }).
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        isRead: { type: Boolean, default: false },
        isDismissed: { type: Boolean, default: false },
    },
    { timestamps: true }
);

alertSchema.index({ userId: 1, ticker: 1, type: 1, rule: 1, periodKey: 1 }, { unique: true });
alertSchema.index({ userId: 1, isDismissed: 1, isRead: 1, createdAt: -1 });
alertSchema.index({ userId: 1, ticker: 1, createdAt: -1 });
alertSchema.index({ createdAt: 1 }, { expireAfterSeconds: env.alertRetentionDays * 24 * 60 * 60 });

module.exports = mongoose.model("Alert", alertSchema);
module.exports.ALERT_TYPES = ALERT_TYPES;
module.exports.ALERT_SEVERITIES = ALERT_SEVERITIES;
