jest.mock("../providers/gemini/geminiClient", () => ({
    sendMessage: jest.fn(),
    isRateLimitError: jest.fn(),
    isTimeoutError: jest.fn(),
}));

const geminiClient = require("../providers/gemini/geminiClient");
const GeminiLLMProvider = require("../providers/gemini/geminiLlm.provider");
const { LLMProviderError, LLMRateLimitError, LLMTimeoutError } = require("../providers/llmProvider");

const PROMPT = { systemPrompt: "sys", userMessage: "user", maxTokens: 1500, temperature: 0.2 };

beforeEach(() => {
    geminiClient.isRateLimitError.mockReturnValue(false);
    geminiClient.isTimeoutError.mockReturnValue(false);
});

afterEach(() => {
    jest.clearAllMocks();
});

describe("GeminiLLMProvider.generateReport", () => {
    it("returns the text part from a successful response", async () => {
        geminiClient.sendMessage.mockResolvedValue({
            candidates: [{ content: { parts: [{ text: '{"executiveSummary":"..."}' }], role: "model" } }],
        });

        const provider = new GeminiLLMProvider();
        const text = await provider.generateReport(PROMPT);

        expect(text).toBe('{"executiveSummary":"..."}');
        expect(geminiClient.sendMessage).toHaveBeenCalledWith(PROMPT);
    });

    it("throws LLMProviderError when the response has no candidates/text content", async () => {
        geminiClient.sendMessage.mockResolvedValue({ candidates: [] });

        const provider = new GeminiLLMProvider();
        await expect(provider.generateReport(PROMPT)).rejects.toThrow(LLMProviderError);
    });

    it("maps a rate-limit client error to LLMRateLimitError", async () => {
        geminiClient.sendMessage.mockRejectedValue(new Error("Quota exceeded."));
        geminiClient.isRateLimitError.mockReturnValue(true);

        const provider = new GeminiLLMProvider();
        await expect(provider.generateReport(PROMPT)).rejects.toThrow(LLMRateLimitError);
    });

    it("maps a timeout client error to LLMTimeoutError", async () => {
        geminiClient.sendMessage.mockRejectedValue(new Error("timed out"));
        geminiClient.isTimeoutError.mockReturnValue(true);

        const provider = new GeminiLLMProvider();
        await expect(provider.generateReport(PROMPT)).rejects.toThrow(LLMTimeoutError);
    });

    it("maps any other client error to a generic LLMProviderError", async () => {
        geminiClient.sendMessage.mockRejectedValue(new Error("something else broke"));

        const provider = new GeminiLLMProvider();
        await expect(provider.generateReport(PROMPT)).rejects.toThrow(LLMProviderError);
    });
});
