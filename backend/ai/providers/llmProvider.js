/**
 * LLM Provider (abstract base)
 *
 * Same shape as backend/providers/financialDataProvider.js: a thin
 * interface every concrete LLM integration implements, so ai.service.js
 * never depends on a specific vendor's SDK or API shape. Swapping
 * providers is a one-env-var change (see llmProvider.registry.js), not a
 * rewrite of the AI domain.
 *
 * The three error classes below are vendor-agnostic - every concrete
 * provider (anthropic/, and any future one) is expected to catch its own
 * vendor-specific errors and re-throw one of these, so ai.service.js and
 * ai.controller.js only ever need to handle three well-known cases
 * regardless of which LLM is configured.
 */

class LLMProvider {
    /**
     * The specific model name actually used (e.g. "claude-sonnet-5",
     * "gpt-4o-mini", "gemini-flash-latest") - ai.service.js persists this
     * alongside every generated report without needing to know which env
     * var belongs to which provider. Concrete providers implement this as
     * a getter reading their own model env var.
     */
    get modelName() {
        throw new Error("modelName must be implemented by an LLM provider.");
    }

    /**
     * @param {{systemPrompt: string, userMessage: string, maxTokens: number, temperature: number}} prompt
     * @returns {Promise<string>} the model's raw text response - parsing
     *   into structured JSON and schema validation happen one layer up
     *   (ai.responseParser.js, ai.validator.js). This method only talks to
     *   the vendor API and normalizes vendor-specific errors.
     */
    async generateReport(prompt) {
        throw new Error("generateReport must be implemented by an LLM provider.");
    }
}

class LLMProviderError extends Error {
    constructor(message) {
        super(message || "The AI provider failed to generate a report.");
        this.name = "LLMProviderError";
        this.statusCode = 502;
    }
}

class LLMRateLimitError extends Error {
    constructor(message) {
        super(message || "The AI provider is rate-limiting requests. Please try again shortly.");
        this.name = "LLMRateLimitError";
        this.statusCode = 429;
    }
}

class LLMTimeoutError extends Error {
    constructor(message) {
        super(message || "The AI provider timed out generating a report.");
        this.name = "LLMTimeoutError";
        this.statusCode = 504;
    }
}

module.exports = { LLMProvider, LLMProviderError, LLMRateLimitError, LLMTimeoutError };
