/**
 * AI Service
 *
 * Orchestrates the AI Equity Research Analyst end to end: build context ->
 * build prompt -> call the configured LLM provider -> parse -> validate ->
 * persist -> return. If the first response fails to parse or fails schema
 * validation, retries exactly once with a stricter re-prompt describing
 * what was wrong - enough for the model to self-correct a formatting slip
 * without burning an unbounded number of paid API calls on a stubborn bad
 * response. Genuine provider errors (rate limit, timeout, auth) are never
 * retried here - they already carry the right statusCode for the client.
 *
 * "Generate Research Report" reuses any report already persisted for the
 * current contextVersion; only an explicit regenerate:true rebuilds
 * context and calls the LLM again - see ai.model.js and
 * research/product/AIResearchAnalystProductDesign.md for why.
 */

const AiResearchReport = require("./ai.model");
const contextBuilder = require("./ai.contextBuilder");
const promptBuilder = require("./ai.promptBuilder");
const responseParser = require("./ai.responseParser");
const validator = require("./ai.validator");
const llmProvider = require("./providers/llmProvider.registry");
const env = require("../config/env");
const logger = require("../utils/logger");

class InsufficientContextError extends Error {
    constructor(ticker) {
        super(
            `No financial, market, or business data is available for ${ticker}. Import the company's financial statements before generating an AI research report.`
        );
        this.name = "InsufficientContextError";
        this.statusCode = 404;
    }
}

class MalformedLLMResponseError extends Error {
    constructor(message) {
        super(message || "The AI provider returned a response Athena could not use.");
        this.name = "MalformedLLMResponseError";
        this.statusCode = 502;
    }
}

const CONTEXT_SECTIONS = ["profile", "ratios", "analysis", "marketData", "dcf", "comps"];
const RETRY_INSTRUCTION = (reason) =>
    `\n\nYour previous response could not be used: ${reason}\nRespond again with ONLY a single valid JSON object matching the required shape - no markdown, no commentary, no extra fields.`;

const normalizeTicker = (ticker) => ticker.trim().toUpperCase();

const hasAnyAvailableSection = (context) => CONTEXT_SECTIONS.some((key) => context[key]?.available);

/** One provider call + parse + validate. Never throws for parse/schema failures - reports them so the caller can retry. */
const attemptReport = async (context, evidenceAllowList, retryReason) => {
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

    const validation = validator.validateReportSchema(parsed, evidenceAllowList);
    if (!validation.isValid) {
        return { ok: false, reason: validation.errors.join("; ") };
    }

    if (validation.warnings.length > 0) {
        logger.warn({ warnings: validation.warnings }, "AI research report passed validation with warnings");
    }

    return { ok: true, sanitized: validation.sanitized };
};

const generateAndPersistReport = async (ticker, options) => {
    const { context, dataFreshness } = await contextBuilder.buildResearchContext(ticker, options);

    if (!hasAnyAvailableSection(context)) {
        throw new InsufficientContextError(ticker);
    }

    const evidenceAllowList = contextBuilder.buildEvidenceAllowList(context);

    let result = await attemptReport(context, evidenceAllowList);
    if (!result.ok) {
        logger.warn({ ticker, reason: result.reason }, "AI research report failed validation, retrying once");
        result = await attemptReport(context, evidenceAllowList, result.reason);
    }

    if (!result.ok) {
        throw new MalformedLLMResponseError(
            `The AI provider did not return a usable report for ${ticker} after a retry: ${result.reason}`
        );
    }

    return AiResearchReport.findOneAndUpdate(
        { ticker, contextVersion: env.aiPromptVersion },
        {
            ticker,
            contextVersion: env.aiPromptVersion,
            provider: env.aiLlmProvider,
            model: llmProvider.modelName,
            report: result.sanitized,
            // Denormalized copy of result.sanitized.sectionEvidence so the
            // frontend can render evidence chips without parsing the full
            // report blob - report itself remains the source of truth.
            sectionEvidence: result.sanitized.sectionEvidence,
            contextSnapshot: context,
            dataFreshness,
            generatedAt: new Date(),
        },
        { returnDocument: "after", upsert: true, runValidators: true }
    );
};

/**
 * @param {string} ticker
 * @param {{regenerate?: boolean, preTaxCostOfDebt?: number}} [options]
 * @returns {Promise<import("mongoose").Document>} the persisted AiResearchReport
 */
const getOrGenerateReport = async (ticker, options = {}) => {
    const normalizedTicker = normalizeTicker(ticker);
    const { regenerate = false, preTaxCostOfDebt } = options;

    if (!regenerate) {
        const existing = await AiResearchReport.findOne({ ticker: normalizedTicker, contextVersion: env.aiPromptVersion });
        if (existing) {
            return existing;
        }
    }

    return generateAndPersistReport(normalizedTicker, { preTaxCostOfDebt });
};

/** GET /:ticker/research-report - persisted report only, never calls the LLM. Returns null if none exists yet. */
const getPersistedReport = async (ticker) => {
    const normalizedTicker = normalizeTicker(ticker);
    return AiResearchReport.findOne({ ticker: normalizedTicker, contextVersion: env.aiPromptVersion });
};

module.exports = {
    getOrGenerateReport,
    getPersistedReport,
    InsufficientContextError,
    MalformedLLMResponseError,
};
