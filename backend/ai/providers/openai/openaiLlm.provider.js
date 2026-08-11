const { LLMProvider, LLMProviderError, LLMRateLimitError, LLMTimeoutError } = require("../llmProvider");
const openaiClient = require("./openaiClient");
const env = require("../../../config/env");

class OpenAILLMProvider extends LLMProvider {
    get modelName() {
        return env.openaiModel;
    }

    async generateReport({ systemPrompt, userMessage, maxTokens, temperature }) {
        let response;

        try {
            response = await openaiClient.sendMessage({ systemPrompt, userMessage, maxTokens, temperature });
        } catch (error) {
            if (openaiClient.isRateLimitError(error)) {
                throw new LLMRateLimitError(error.message);
            }
            if (openaiClient.isTimeoutError(error)) {
                throw new LLMTimeoutError(error.message);
            }
            throw new LLMProviderError(error.message);
        }

        const text = response?.choices?.[0]?.message?.content;

        if (!text) {
            throw new LLMProviderError("OpenAI returned a response with no message content.");
        }

        return text;
    }
}

module.exports = OpenAILLMProvider;
