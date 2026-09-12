/**
 * Earnings AI Service
 *
 * Orchestrates the earnings AI summary end to end, reusing existing
 * infrastructure at every layer instead of rebuilding it (see
 * research/engineering/GroundedEarningsExplanation.md): the already-computed
 * earnings scorecard (earnings.service.js), the shared LLM provider
 * abstraction and generic JSON-recovery parser (backend/ai/), and the shared
 * monthly quota pool (backend/ai/aiQuota.service.js). Same one-retry-on-
 * malformed-response discipline as backend/ai/ai.service.js's attemptReport.
 */

const EarningsAiSummary = require("./earningsAiSummary.model");
const earningsService = require("./earnings.service");
const promptBuilder = require("./earnings.aiPromptBuilder");
const validator = require("./earnings.aiValidator");
const responseParser = require("../ai/ai.responseParser");
const llmProvider = require("../ai/providers/llmProvider.registry");
const aiQuotaService = require("../ai/aiQuota.service");
const env = require("../config/env");
const logger = require("../utils/logger");

class MalformedLLMResponseError extends Error {
    constructor(message) {
        super(message || "The AI provider did not return a usable earnings summary.");
        this.name = "MalformedLLMResponseError";
        this.statusCode = 502;
    }
}

const RETRY_INSTRUCTION = (reason) =>
    `\n\nYour previous response could not be used: ${reason}\nRespond again with ONLY a single valid JSON object matching the required shape - no markdown, no commentary, no extra fields.`;

const normalizeTicker = (ticker) => ticker.trim().toUpperCase();

/** One provider call + parse + validate. Never throws for parse/schema failures - reports them so the caller can retry, same shape as ai.service.js's attemptReport. */
const attemptSummary = async (earningsData, evidenceAllowList, retryReason) => {
    const prompt = promptBuilder.buildPrompt(earningsData, evidenceAllowList);
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

    const validation = validator.validateSummarySchema(parsed, evidenceAllowList);
    if (!validation.isValid) {
        return { ok: false, reason: validation.errors.join("; ") };
    }

    return { ok: true, sanitized: validation.sanitized };
};

const generateAndPersistSummary = async (ticker) => {
    const earningsData = await earningsService.getEarningsIntelligence(ticker);
    const fiscalYearKey = earningsData.period?.latestPeriod ?? "unknown";
    const evidenceAllowList = promptBuilder.buildEvidenceAllowList(earningsData);

    let result = await attemptSummary(earningsData, evidenceAllowList);
    if (!result.ok) {
        logger.warn({ ticker, reason: result.reason }, "Earnings AI summary failed validation, retrying once");
        result = await attemptSummary(earningsData, evidenceAllowList, result.reason);
    }

    if (!result.ok) {
        throw new MalformedLLMResponseError(
            `The AI provider did not return a usable earnings summary for ${ticker} after a retry: ${result.reason}`
        );
    }

    return EarningsAiSummary.findOneAndUpdate(
        { ticker, fiscalYearKey, contextVersion: env.earningsAiPromptVersion },
        {
            ticker,
            fiscalYearKey,
            contextVersion: env.earningsAiPromptVersion,
            provider: env.aiLlmProvider,
            model: llmProvider.modelName,
            narrative: result.sanitized.narrative,
            evidenceUsed: result.sanitized.evidenceUsed,
            generatedAt: new Date(),
        },
        { returnDocument: "after", upsert: true, runValidators: true }
    );
};

/**
 * @param {string} ticker
 * @param {{regenerate?: boolean, userId?: string}} [options]
 * @returns {Promise<import("mongoose").Document>} the persisted EarningsAiSummary
 */
const getOrGenerateSummary = async (ticker, options = {}) => {
    const normalizedTicker = normalizeTicker(ticker);
    const { regenerate = false, userId } = options;

    if (!regenerate) {
        // A stale cache (older fiscalYearKey) simply won't match here, so a
        // newly-imported fiscal year's earnings naturally fall through to a
        // fresh generation rather than serving last year's summary.
        const earningsData = await earningsService.getEarningsIntelligence(normalizedTicker);
        const fiscalYearKey = earningsData.period?.latestPeriod ?? "unknown";
        const existing = await EarningsAiSummary.findOne({
            ticker: normalizedTicker,
            fiscalYearKey,
            contextVersion: env.earningsAiPromptVersion,
        });
        if (existing) {
            return existing;
        }
    }

    if (userId) {
        const quota = await aiQuotaService.consumeIfAvailable(userId);
        if (!quota.allowed) {
            throw new aiQuotaService.QuotaExceededError(quota.limit);
        }
    }

    return generateAndPersistSummary(normalizedTicker);
};

/** GET /:ticker/summary - persisted summary only, never calls the LLM. Returns null if none exists yet for the current fiscal year. */
const getPersistedSummary = async (ticker) => {
    const normalizedTicker = normalizeTicker(ticker);
    const earningsData = await earningsService.getEarningsIntelligence(normalizedTicker);
    const fiscalYearKey = earningsData.period?.latestPeriod ?? "unknown";

    return EarningsAiSummary.findOne({
        ticker: normalizedTicker,
        fiscalYearKey,
        contextVersion: env.earningsAiPromptVersion,
    });
};

module.exports = { getOrGenerateSummary, getPersistedSummary, MalformedLLMResponseError };
