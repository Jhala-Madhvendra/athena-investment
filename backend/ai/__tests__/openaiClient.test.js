const env = require("../../config/env");
const { sendMessage, isRateLimitError, isTimeoutError } = require("../providers/openai/openaiClient");

const originalFetch = global.fetch;
const originalApiKey = env.openaiApiKey;
const originalModel = env.openaiModel;
const originalTimeoutMs = env.aiRequestTimeoutMs;

const jsonResponse = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
});

beforeEach(() => {
    env.openaiApiKey = "test-api-key";
    env.openaiModel = "gpt-4o-mini";
    env.aiRequestTimeoutMs = 5000;
    global.fetch = jest.fn();
});

afterEach(() => {
    global.fetch = originalFetch;
    env.openaiApiKey = originalApiKey;
    env.openaiModel = originalModel;
    env.aiRequestTimeoutMs = originalTimeoutMs;
    jest.clearAllMocks();
});

describe("sendMessage", () => {
    it("posts the Chat Completions request with the expected headers/body and returns the parsed response", async () => {
        const apiResponse = { choices: [{ message: { content: "{}" } }], usage: { total_tokens: 30 } };
        global.fetch.mockResolvedValue(jsonResponse(200, apiResponse));

        const result = await sendMessage({
            systemPrompt: "You are an analyst.",
            userMessage: "Summarize this.",
            maxTokens: 1500,
            temperature: 0.2,
        });

        expect(result).toEqual(apiResponse);
        expect(global.fetch).toHaveBeenCalledTimes(1);

        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toBe("https://api.openai.com/v1/chat/completions");
        expect(options.method).toBe("POST");
        expect(options.headers.authorization).toBe("Bearer test-api-key");

        const body = JSON.parse(options.body);
        expect(body).toEqual({
            model: "gpt-4o-mini",
            max_tokens: 1500,
            temperature: 0.2,
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: "You are an analyst." },
                { role: "user", content: "Summarize this." },
            ],
        });
    });

    it("throws without calling fetch when OPENAI_API_KEY is not configured", async () => {
        env.openaiApiKey = null;

        await expect(sendMessage({ systemPrompt: "s", userMessage: "u", maxTokens: 100, temperature: 0.2 })).rejects.toThrow(
            "OPENAI_API_KEY is not configured"
        );
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it("normalizes an in-body OpenAI error on a non-ok HTTP response", async () => {
        global.fetch.mockResolvedValue(
            jsonResponse(429, { error: { type: "rate_limit_exceeded", message: "Rate limit reached." } })
        );

        await expect(sendMessage({ systemPrompt: "s", userMessage: "u", maxTokens: 100, temperature: 0.2 })).rejects.toMatchObject({
            message: "Rate limit reached.",
            openaiStatus: 429,
            openaiErrorType: "rate_limit_exceeded",
        });
    });

    it("falls back to a generic message when the error body isn't parseable JSON", async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 500,
            json: () => Promise.reject(new Error("not json")),
        });

        await expect(sendMessage({ systemPrompt: "s", userMessage: "u", maxTokens: 100, temperature: 0.2 })).rejects.toMatchObject({
            message: "OpenAI API request failed with status 500.",
            openaiStatus: 500,
        });
    });

    it("tags a fetch timeout (AbortError) with openaiStatus 504", async () => {
        const abortError = new Error("The operation was aborted.");
        abortError.name = "AbortError";
        global.fetch.mockRejectedValue(abortError);

        await expect(sendMessage({ systemPrompt: "s", userMessage: "u", maxTokens: 100, temperature: 0.2 })).rejects.toMatchObject({
            openaiStatus: 504,
            isTimeout: true,
        });
    });
});

describe("error classifiers", () => {
    it("isRateLimitError only matches status 429", () => {
        expect(isRateLimitError({ openaiStatus: 429 })).toBe(true);
        expect(isRateLimitError({ openaiStatus: 500 })).toBe(false);
        expect(isRateLimitError({})).toBe(false);
    });

    it("isTimeoutError matches status 504 or the isTimeout flag", () => {
        expect(isTimeoutError({ openaiStatus: 504 })).toBe(true);
        expect(isTimeoutError({ isTimeout: true })).toBe(true);
        expect(isTimeoutError({ openaiStatus: 500 })).toBe(false);
    });
});
