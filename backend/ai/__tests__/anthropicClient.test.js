const env = require("../../config/env");
const { sendMessage, isRateLimitError, isOverloadedError, isTimeoutError } = require("../providers/anthropic/anthropicClient");

const originalFetch = global.fetch;
const originalApiKey = env.anthropicApiKey;
const originalModel = env.anthropicModel;
const originalTimeoutMs = env.aiRequestTimeoutMs;

const jsonResponse = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
});

beforeEach(() => {
    env.anthropicApiKey = "test-api-key";
    env.anthropicModel = "claude-sonnet-5";
    env.aiRequestTimeoutMs = 5000;
    global.fetch = jest.fn();
});

afterEach(() => {
    global.fetch = originalFetch;
    env.anthropicApiKey = originalApiKey;
    env.anthropicModel = originalModel;
    env.aiRequestTimeoutMs = originalTimeoutMs;
    jest.clearAllMocks();
});

describe("sendMessage", () => {
    it("posts the Messages API request with the expected headers/body and returns the parsed response", async () => {
        const apiResponse = { content: [{ type: "text", text: "{}" }], usage: { input_tokens: 10, output_tokens: 20 } };
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
        expect(url).toBe("https://api.anthropic.com/v1/messages");
        expect(options.method).toBe("POST");
        expect(options.headers["x-api-key"]).toBe("test-api-key");
        expect(options.headers["anthropic-version"]).toBe("2023-06-01");

        const body = JSON.parse(options.body);
        expect(body).toEqual({
            model: "claude-sonnet-5",
            max_tokens: 1500,
            temperature: 0.2,
            system: "You are an analyst.",
            messages: [{ role: "user", content: "Summarize this." }],
        });
    });

    it("throws without calling fetch when ANTHROPIC_API_KEY is not configured", async () => {
        env.anthropicApiKey = null;

        await expect(sendMessage({ systemPrompt: "s", userMessage: "u", maxTokens: 100, temperature: 0.2 })).rejects.toThrow(
            "ANTHROPIC_API_KEY is not configured"
        );
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it("normalizes an in-body Anthropic error on a non-ok HTTP response", async () => {
        global.fetch.mockResolvedValue(
            jsonResponse(429, { type: "error", error: { type: "rate_limit_error", message: "Too many requests." } })
        );

        await expect(sendMessage({ systemPrompt: "s", userMessage: "u", maxTokens: 100, temperature: 0.2 })).rejects.toMatchObject({
            message: "Too many requests.",
            anthropicStatus: 429,
            anthropicErrorType: "rate_limit_error",
        });
    });

    it("falls back to a generic message when the error body isn't parseable JSON", async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 500,
            json: () => Promise.reject(new Error("not json")),
        });

        await expect(sendMessage({ systemPrompt: "s", userMessage: "u", maxTokens: 100, temperature: 0.2 })).rejects.toMatchObject({
            message: "Anthropic API request failed with status 500.",
            anthropicStatus: 500,
        });
    });

    it("tags a fetch timeout (AbortError) with anthropicStatus 504", async () => {
        const abortError = new Error("The operation was aborted.");
        abortError.name = "AbortError";
        global.fetch.mockRejectedValue(abortError);

        await expect(sendMessage({ systemPrompt: "s", userMessage: "u", maxTokens: 100, temperature: 0.2 })).rejects.toMatchObject({
            anthropicStatus: 504,
            isTimeout: true,
        });
    });
});

describe("error classifiers", () => {
    it("isRateLimitError only matches status 429", () => {
        expect(isRateLimitError({ anthropicStatus: 429 })).toBe(true);
        expect(isRateLimitError({ anthropicStatus: 500 })).toBe(false);
        expect(isRateLimitError({})).toBe(false);
    });

    it("isOverloadedError only matches status 529", () => {
        expect(isOverloadedError({ anthropicStatus: 529 })).toBe(true);
        expect(isOverloadedError({ anthropicStatus: 500 })).toBe(false);
    });

    it("isTimeoutError matches status 504 or the isTimeout flag", () => {
        expect(isTimeoutError({ anthropicStatus: 504 })).toBe(true);
        expect(isTimeoutError({ isTimeout: true })).toBe(true);
        expect(isTimeoutError({ anthropicStatus: 500 })).toBe(false);
    });
});
