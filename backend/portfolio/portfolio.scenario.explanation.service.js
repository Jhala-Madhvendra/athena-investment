/**
 * Portfolio Scenario Explanation Service
 *
 * Orchestrates POST /api/portfolio/scenarios/explain: validate the caller's
 * already-computed scenario result -> build a prompt from it -> call the
 * configured LLM provider -> mechanically verify the response didn't
 * invent a number -> return prose. Retries exactly once on a verification
 * failure with a stricter re-prompt, same shape as ai.service.js's
 * attemptReport/retry loop - enough for the model to self-correct without
 * an unbounded retry loop.
 *
 * Nothing here is persisted (no Scenario collection exists - see
 * portfolio.scenario.service.js) and nothing here can influence a
 * scenario's numbers: this module only ever runs AFTER a scenario result
 * already exists, on a copy of that result, and its only output is a
 * prose string plus a timestamp.
 */

const promptBuilder = require("./portfolio.scenario.explanation.promptBuilder");
const responseParser = require("./portfolio.scenario.explanation.responseParser");
const responseValidator = require("./portfolio.scenario.explanation.responseValidator");
const llmProvider = require("../ai/providers/llmProvider.registry");
const logger = require("../utils/logger");

class MalformedLLMResponseError extends Error {
    constructor(message) {
        super(message || "The AI provider did not return a usable scenario explanation.");
        this.name = "MalformedLLMResponseError";
        this.statusCode = 502;
    }
}

const RETRY_INSTRUCTION = (reason) =>
    `\n\nYour previous response could not be used: ${reason}\nRespond again with ONLY a single JSON object of the exact shape {"explanation": string} - the explanation itself must be plain prose (no nested JSON, no markdown) and use ONLY numbers that appear in the scenario result above.`;

/** One provider call + parse + mechanical verification. Never throws for a parse/verification failure - reports it so the caller can retry. */
const attemptExplanation = async (normalized, retryReason) => {
    const prompt = promptBuilder.buildPrompt(normalized);
    if (retryReason) {
        prompt.userMessage += RETRY_INSTRUCTION(retryReason);
    }

    const rawText = await llmProvider.generateReport(prompt);

    let explanationText;
    try {
        explanationText = responseParser.parseExplanationResponse(rawText);
    } catch (parseError) {
        return { ok: false, reason: parseError.message };
    }

    const validation = responseValidator.validateExplanationText(explanationText, normalized);
    if (!validation.isValid) {
        return { ok: false, reason: validation.errors.join("; ") };
    }

    return { ok: true, explanation: explanationText };
};

/**
 * @param {object} normalized - from portfolio.scenario.explanation.validator.validateExplanationRequest
 * @returns {Promise<{explanation: string, generatedAt: string}>}
 */
const explainScenario = async (normalized) => {
    let result = await attemptExplanation(normalized);

    if (!result.ok) {
        logger.warn({ reason: result.reason }, "Scenario explanation failed verification, retrying once");
        result = await attemptExplanation(normalized, result.reason);
    }

    if (!result.ok) {
        throw new MalformedLLMResponseError(
            `The AI provider did not return a verifiable scenario explanation after a retry: ${result.reason}`
        );
    }

    return { explanation: result.explanation, generatedAt: new Date().toISOString() };
};

module.exports = { explainScenario, MalformedLLMResponseError };
