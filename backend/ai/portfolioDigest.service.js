/**
 * Portfolio Digest Service
 *
 * Same orchestration shape as earnings.aiService.js: build context -> prompt
 * -> call the existing LLM provider registry -> parse (reusing
 * ai.responseParser.js as-is) -> validate -> one retry on failure -> persist.
 * Deliberately NOT gated by aiQuota.service.js's shared AiReportUsage pool -
 * a digest is operator-scheduled, not a button the user clicked, so
 * silently draining a user's manual-report quota from a background job
 * would be a surprising, unwanted side effect. Cost is bounded instead by
 * construction: opt-in only (User.notificationPreferences.digestEnabled),
 * weekly cadence, and this model's own unique {userId, periodKey} index -
 * no user can ever cause more than one digest's worth of LLM spend per week.
 */

const PortfolioDigest = require("./portfolioDigest.model");
const { buildDigestContext } = require("./portfolioDigest.contextBuilder");
const promptBuilder = require("./portfolioDigest.promptBuilder");
const validator = require("./portfolioDigest.validator");
const responseParser = require("./ai.responseParser");
const llmProvider = require("./providers/llmProvider.registry");
const env = require("../config/env");
const logger = require("../utils/logger");

class NoHoldingsError extends Error {
    constructor() {
        super("No portfolio holdings to summarize yet.");
        this.name = "NoHoldingsError";
        this.statusCode = 404;
    }
}

class MalformedLLMResponseError extends Error {
    constructor(message) {
        super(message || "The AI provider did not return a usable portfolio digest.");
        this.name = "MalformedLLMResponseError";
        this.statusCode = 502;
    }
}

const RETRY_INSTRUCTION = (reason) =>
    `\n\nYour previous response could not be used: ${reason}\nRespond again with ONLY a single valid JSON object matching the required shape - no markdown, no commentary, no extra fields.`;

/** ISO 8601 week key, e.g. "2026-W35" - UTC-based so the weekly boundary doesn't shift per-user by timezone. */
const getIsoWeekKey = (date = new Date()) => {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
};

const attemptDigest = async (context, evidenceAllowList, retryReason) => {
    const prompt = promptBuilder.buildPrompt(context, evidenceAllowList);
    if (retryReason) {
        prompt.userMessage += RETRY_INSTRUCTION(retryReason);
    }

    const rawText = await llmProvider.generateReport(prompt);

    let parsed;
    try {
        parsed = responseParser.parseReportResponse(rawText);
    } catch (parseError) {
        return { ok: false, reason: parseError.message };
    }

    const validation = validator.validateDigestSchema(parsed, evidenceAllowList);
    if (!validation.isValid) {
        return { ok: false, reason: validation.errors.join("; ") };
    }

    return { ok: true, sanitized: validation.sanitized };
};

const generateAndPersistDigest = async (userId, periodKey) => {
    const context = await buildDigestContext(userId);

    if (!context.hasHoldings) {
        throw new NoHoldingsError();
    }

    const evidenceAllowList = promptBuilder.buildEvidenceAllowList(context);

    let result = await attemptDigest(context, evidenceAllowList);
    if (!result.ok) {
        logger.warn({ userId, reason: result.reason }, "Portfolio digest failed validation, retrying once");
        result = await attemptDigest(context, evidenceAllowList, result.reason);
    }

    if (!result.ok) {
        throw new MalformedLLMResponseError(`The AI provider did not return a usable digest after a retry: ${result.reason}`);
    }

    return PortfolioDigest.findOneAndUpdate(
        { userId, periodKey },
        {
            userId,
            periodKey,
            provider: env.aiLlmProvider,
            model: llmProvider.modelName,
            narrative: result.sanitized.narrative,
            holdingHighlights: result.sanitized.holdingHighlights,
            evidenceUsed: result.sanitized.evidenceUsed,
            generatedAt: new Date(),
        },
        { returnDocument: "after", upsert: true, runValidators: true }
    );
};

/**
 * @param {string} userId
 * @param {{regenerate?: boolean}} [options]
 * @returns {Promise<import("mongoose").Document>} the persisted PortfolioDigest
 */
const getOrGenerateDigest = async (userId, options = {}) => {
    const { regenerate = false } = options;
    const periodKey = getIsoWeekKey();

    if (!regenerate) {
        const existing = await PortfolioDigest.findOne({ userId, periodKey });
        if (existing) {
            return existing;
        }
    }

    return generateAndPersistDigest(userId, periodKey);
};

/** GET latest persisted digest - never calls the LLM. */
const getPersistedDigest = (userId) => PortfolioDigest.findOne({ userId }).sort({ periodKey: -1 });

module.exports = { getOrGenerateDigest, getPersistedDigest, getIsoWeekKey, NoHoldingsError, MalformedLLMResponseError };
