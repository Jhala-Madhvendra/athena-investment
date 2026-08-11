const { LLMProvider, LLMProviderError, LLMRateLimitError, LLMTimeoutError } = require("../llmProvider");
const anthropicClient = require("./anthropicClient");
const env = require("../../../config/env");

class AnthropicLLMProvider extends LLMProvider {
    // Exposes which model actually generated a report, so ai.service.js can
    // persist it without needing to know every provider's env var name.
    get modelName() {
        return env.anthropicModel;
    }

    async generateReport({ systemPrompt, userMessage, maxTokens, temperature }) {
        let response;

        try {
            response = await anthropicClient.sendMessage({ systemPrompt, userMessage, maxTokens, temperature });
        } catch (error) {
            if (anthropicClient.isRateLimitError(error)) {
                throw new LLMRateLimitError(error.message);
            }
            if (anthropicClient.isTimeoutError(error)) {
                throw new LLMTimeoutError(error.message);
            }
            throw new LLMProviderError(error.message);
        }

        const text = response?.content?.find((block) => block.type === "text")?.text;

        if (!text) {
            throw new LLMProviderError("Anthropic returned a response with no text content.");
        }

        return text;
    }
}

module.exports = AnthropicLLMProvider;
