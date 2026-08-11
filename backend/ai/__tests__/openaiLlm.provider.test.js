jest.mock("../providers/openai/openaiClient", () => ({
    sendMessage: jest.fn(),
    isRateLimitError: jest.fn(),
    isTimeoutError: jest.fn(),
}));

const openaiClient = require("../providers/openai/openaiClient");
const OpenAILLMProvider = require("../providers/openai/openaiLlm.provider");
const { LLMProviderError, LLMRateLimitError, LLMTimeoutError } = require("../providers/llmProvider");

const PROMPT = { systemPrompt: "sys", userMessage: "user", maxTokens: 1500, temperature: 0.2 };

beforeEach(() => {
    openaiClient.isRateLimitError.mockReturnValue(false);
    openaiClient.isTimeoutError.mockReturnValue(false);
});

afterEach(() => {
    jest.clearAllMocks();
});

describe("OpenAILLMProvider.generateReport", () => {
    it("returns the message content from a successful response", async () => {
        openaiClient.sendMessage.mockResolvedValue({ choices: [{ message: { content: '{"executiveSummary":"..."}' } }] });

        const provider = new OpenAILLMProvider();
        const text = await provider.generateReport(PROMPT);

        expect(text).toBe('{"executiveSummary":"..."}');
        expect(openaiClient.sendMessage).toHaveBeenCalledWith(PROMPT);
    });

    it("throws LLMProviderError when the response has no message content", async () => {
        openaiClient.sendMessage.mockResolvedValue({ choices: [] });

        const provider = new OpenAILLMProvider();
        await expect(provider.generateReport(PROMPT)).rejects.toThrow(LLMProviderError);
    });

    it("maps a rate-limit client error to LLMRateLimitError", async () => {
        openaiClient.sendMessage.mockRejectedValue(new Error("Rate limit reached."));
        openaiClient.isRateLimitError.mockReturnValue(true);

        const provider = new OpenAILLMProvider();
        await expect(provider.generateReport(PROMPT)).rejects.toThrow(LLMRateLimitError);
    });

    it("maps a timeout client error to LLMTimeoutError", async () => {
        openaiClient.sendMessage.mockRejectedValue(new Error("timed out"));
        openaiClient.isTimeoutError.mockReturnValue(true);

        const provider = new OpenAILLMProvider();
        await expect(provider.generateReport(PROMPT)).rejects.toThrow(LLMTimeoutError);
    });

    it("maps any other client error to a generic LLMProviderError", async () => {
        openaiClient.sendMessage.mockRejectedValue(new Error("something else broke"));

        const provider = new OpenAILLMProvider();
        await expect(provider.generateReport(PROMPT)).rejects.toThrow(LLMProviderError);
    });
});
