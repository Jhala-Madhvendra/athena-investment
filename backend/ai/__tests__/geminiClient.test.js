const env = require("../../config/env");
const { sendMessage, isRateLimitError, isTimeoutError } = require("../providers/gemini/geminiClient");

const originalFetch = global.fetch;
const originalApiKey = env.geminiApiKey;
const originalModel = env.geminiModel;
const originalTimeoutMs = env.aiRequestTimeoutMs;

const jsonResponse = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
});

beforeEach(() => {
    env.geminiApiKey = "test-api-key";
    env.geminiModel = "gemini-2.0-flash";
    env.aiRequestTimeoutMs = 5000;
    global.fetch = jest.fn();
});

afterEach(() => {
    global.fetch = originalFetch;
    env.geminiApiKey = originalApiKey;
    env.geminiModel = originalModel;
    env.aiRequestTimeoutMs = originalTimeoutMs;
    jest.clearAllMocks();
});

describe("sendMessage", () => {
    it("posts the generateContent request with the expected URL/headers/body and returns the parsed response", async () => {
        const apiResponse = { candidates: [{ content: { parts: [{ text: "{}" }], role: "model" } }] };
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
        expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent");
        expect(options.method).toBe("POST");
        expect(options.headers["x-goog-api-key"]).toBe("test-api-key");

        const body = JSON.parse(options.body);
        expect(body).toEqual({
            contents: [{ role: "user", parts: [{ text: "Summarize this." }] }],
            systemInstruction: { parts: [{ text: "You are an analyst." }] },
            generationConfig: { temperature: 0.2, maxOutputTokens: 1500, responseMimeType: "application/json" },
        });
    });

    it("throws without calling fetch when GEMINI_API_KEY is not configured", async () => {
        env.geminiApiKey = null;

        await expect(sendMessage({ systemPrompt: "s", userMessage: "u", maxTokens: 100, temperature: 0.2 })).rejects.toThrow(
            "GEMINI_API_KEY is not configured"
        );
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it("normalizes an in-body Gemini error on a non-ok HTTP response", async () => {
        global.fetch.mockResolvedValue(
            jsonResponse(429, { error: { code: 429, message: "Quota exceeded.", status: "RESOURCE_EXHAUSTED" } })
        );

        await expect(sendMessage({ systemPrompt: "s", userMessage: "u", maxTokens: 100, temperature: 0.2 })).rejects.toMatchObject({
            message: "Quota exceeded.",
            geminiStatus: 429,
            geminiErrorType: "RESOURCE_EXHAUSTED",
        });
    });

    it("falls back to a generic message when the error body isn't parseable JSON", async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 500,
            json: () => Promise.reject(new Error("not json")),
        });

        await expect(sendMessage({ systemPrompt: "s", userMessage: "u", maxTokens: 100, temperature: 0.2 })).rejects.toMatchObject({
            message: "Gemini API request failed with status 500.",
            geminiStatus: 500,
        });
    });

    it("tags a fetch timeout (AbortError) with geminiStatus 504", async () => {
        const abortError = new Error("The operation was aborted.");
        abortError.name = "AbortError";
        global.fetch.mockRejectedValue(abortError);

        await expect(sendMessage({ systemPrompt: "s", userMessage: "u", maxTokens: 100, temperature: 0.2 })).rejects.toMatchObject({
            geminiStatus: 504,
            isTimeout: true,
        });
    });
});

describe("error classifiers", () => {
    it("isRateLimitError only matches status 429", () => {
        expect(isRateLimitError({ geminiStatus: 429 })).toBe(true);
        expect(isRateLimitError({ geminiStatus: 500 })).toBe(false);
        expect(isRateLimitError({})).toBe(false);
    });

    it("isTimeoutError matches status 504 or the isTimeout flag", () => {
        expect(isTimeoutError({ geminiStatus: 504 })).toBe(true);
        expect(isTimeoutError({ isTimeout: true })).toBe(true);
        expect(isTimeoutError({ geminiStatus: 500 })).toBe(false);
    });
});
