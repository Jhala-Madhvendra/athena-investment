jest.mock("../providers/anthropic/anthropicClient", () => ({
    sendMessage: jest.fn(),
    isRateLimitError: jest.fn(),
    isOverloadedError: jest.fn(),
    isTimeoutError: jest.fn(),
}));

const anthropicClient = require("../providers/anthropic/anthropicClient");
const AnthropicLLMProvider = require("../providers/anthropic/anthropicLlm.provider");
const { LLMProviderError, LLMRateLimitError, LLMTimeoutError } = require("../providers/llmProvider");

const PROMPT = { systemPrompt: "sys", userMessage: "user", maxTokens: 1500, temperature: 0.2 };

beforeEach(() => {
    anthropicClient.isRateLimitError.mockReturnValue(false);
    anthropicClient.isOverloadedError.mockReturnValue(false);
    anthropicClient.isTimeoutError.mockReturnValue(false);
});

afterEach(() => {
    jest.clearAllMocks();
});

describe("AnthropicLLMProvider.generateReport", () => {
    it("returns the text block from a successful response", async () => {
        anthropicClient.sendMessage.mockResolvedValue({ content: [{ type: "text", text: '{"executiveSummary":"..."}' }] });

        const provider = new AnthropicLLMProvider();
        const text = await provider.generateReport(PROMPT);

        expect(text).toBe('{"executiveSummary":"..."}');
        expect(anthropicClient.sendMessage).toHaveBeenCalledWith(PROMPT);
    });

    it("throws LLMProviderError when the response has no text content block", async () => {
        anthropicClient.sendMessage.mockResolvedValue({ content: [] });

        const provider = new AnthropicLLMProvider();
        await expect(provider.generateReport(PROMPT)).rejects.toThrow(LLMProviderError);
    });

    it("maps a rate-limit client error to LLMRateLimitError", async () => {
        anthropicClient.sendMessage.mockRejectedValue(new Error("Too many requests."));
        anthropicClient.isRateLimitError.mockReturnValue(true);

        const provider = new AnthropicLLMProvider();
        await expect(provider.generateReport(PROMPT)).rejects.toThrow(LLMRateLimitError);
    });

    it("maps a timeout client error to LLMTimeoutError", async () => {
        anthropicClient.sendMessage.mockRejectedValue(new Error("timed out"));
        anthropicClient.isTimeoutError.mockReturnValue(true);

        const provider = new AnthropicLLMProvider();
        await expect(provider.generateReport(PROMPT)).rejects.toThrow(LLMTimeoutError);
    });

    it("maps any other client error to a generic LLMProviderError", async () => {
        anthropicClient.sendMessage.mockRejectedValue(new Error("something else broke"));

        const provider = new AnthropicLLMProvider();
        await expect(provider.generateReport(PROMPT)).rejects.toThrow(LLMProviderError);
    });
});
