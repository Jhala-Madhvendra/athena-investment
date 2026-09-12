/**
 * AI Quota Service
 *
 * One shared monthly free-generation pool covering every LLM-cost-bearing
 * feature (AI Research Reports today, Earnings AI Summaries alongside it) -
 * both are "an AI report" from the user's and the cost ledger's
 * perspective, so a single counter/message beats two parallel ones. Never
 * touched by a cache hit - only a real, LLM-invoking attempt consumes
 * quota (see ai.service.js/earnings.aiService.js's getOrGenerate* functions).
 */

const AiReportUsage = require("./aiReportUsage.model");
const env = require("../config/env");

class QuotaExceededError extends Error {
    constructor(limit) {
        super(
            `You've reached your free AI report limit for this month (${limit}). It resets at the start of next calendar month.`
        );
        this.name = "QuotaExceededError";
        this.statusCode = 429;
    }
}

/** UTC calendar month, e.g. "2026-08" - deliberately UTC so the reset boundary doesn't shift per-user by timezone. */
const getPeriodKey = () => new Date().toISOString().slice(0, 7);

const getUsage = async (userId) => {
    const periodKey = getPeriodKey();
    const limit = env.aiReportMonthlyQuota;
    const existing = await AiReportUsage.findOne({ userId, periodKey }).select("count").lean();
    const used = existing?.count ?? 0;

    return { used, limit, remaining: Math.max(0, limit - used), periodKey };
};

/**
 * Atomically checks-and-increments. Two steps to avoid an upsert/cap race:
 * (1) idempotently ensure the period's usage doc exists (a concurrent
 * first-request-of-the-month race can throw a duplicate-key error here,
 * which is safe to swallow - the doc exists either way afterward), then
 * (2) a plain conditional increment that only matches (and only
 * increments) when still under the cap.
 * @returns {Promise<{allowed: boolean, used: number, limit: number}>}
 */
const consumeIfAvailable = async (userId) => {
    const periodKey = getPeriodKey();
    const limit = env.aiReportMonthlyQuota;

    try {
        await AiReportUsage.findOneAndUpdate(
            { userId, periodKey },
            { $setOnInsert: { userId, periodKey, count: 0 } },
            { upsert: true }
        );
    } catch (error) {
        if (error.code !== 11000) {
            throw error;
        }
    }

    const updated = await AiReportUsage.findOneAndUpdate(
        { userId, periodKey, count: { $lt: limit } },
        { $inc: { count: 1 } },
        { new: true }
    );

    if (!updated) {
        return { allowed: false, used: limit, limit };
    }

    return { allowed: true, used: updated.count, limit };
};

module.exports = { getPeriodKey, getUsage, consumeIfAvailable, QuotaExceededError };
