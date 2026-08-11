const { LLMProvider, LLMProviderError, LLMRateLimitError, LLMTimeoutError } = require("../llmProvider");
const geminiClient = require("./geminiClient");
const env = require("../../../config/env");

class GeminiLLMProvider extends LLMProvider {
    get modelName() {
        return env.geminiModel;
    }

    async generateReport({ systemPrompt, userMessage, maxTokens, temperature }) {
        let response;

        try {
            response = await geminiClient.sendMessage({ systemPrompt, userMessage, maxTokens, temperature });
        } catch (error) {
            if (geminiClient.isRateLimitError(error)) {
                throw new LLMRateLimitError(error.message);
            }
            if (geminiClient.isTimeoutError(error)) {
                throw new LLMTimeoutError(error.message);
            }
            throw new LLMProviderError(error.message);
        }

        const text = response?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            throw new LLMProviderError("Gemini returned a response with no text content.");
        }

        return text;
    }
}

module.exports = GeminiLLMProvider;
