const AnthropicLLMProvider = require("./anthropic/anthropicLlm.provider");
const OpenAILLMProvider = require("./openai/openaiLlm.provider");
const GeminiLLMProvider = require("./gemini/geminiLlm.provider");

const createLlmProvider = () => {
    const providerName = (process.env.AI_LLM_PROVIDER || "anthropic").toLowerCase();

    switch (providerName) {
        case "anthropic":
            return new AnthropicLLMProvider();
        case "openai":
            return new OpenAILLMProvider();
        case "gemini":
            return new GeminiLLMProvider();
        default:
            throw new Error(`Unsupported LLM provider: ${providerName}`);
    }
};

module.exports = createLlmProvider();
