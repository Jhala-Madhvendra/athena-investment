/**
 * Gemini Client
 *
 * Low-level fetch-based HTTP client for Google's Gemini `generateContent`
 * API - mirrors anthropicClient.js/openaiClient.js: one function that does
 * the HTTP call and normalizes both HTTP-level and in-body failures into a
 * single Error shape. No `@google/generative-ai` SDK dependency, matching
 * this repo's convention of hand-rolled clients for every external API.
 */

const fetchWithTimeout = require("../../../utils/fetchWithTimeout");
const env = require("../../../config/env");

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * @param {{systemPrompt: string, userMessage: string, maxTokens: number, temperature: number}} params
 * @returns {Promise<object>} the parsed Gemini generateContent API response body
 */
const sendMessage = async ({ systemPrompt, userMessage, maxTokens, temperature }) => {
    if (!env.geminiApiKey) {
        const error = new Error("GEMINI_API_KEY is not configured on the server.");
        error.geminiStatus = 401;
        throw error;
    }

    const url = `${BASE_URL}/${env.geminiModel}:generateContent`;

    let response;
    try {
        response = await fetchWithTimeout(
            url,
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-goog-api-key": env.geminiApiKey,
                },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: userMessage }] }],
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    // Native JSON response mode, same reliability rationale
                    // as openaiClient.js's response_format: json_object.
                    generationConfig: {
                        temperature,
                        maxOutputTokens: maxTokens,
                        responseMimeType: "application/json",
                    },
                }),
            },
            env.aiRequestTimeoutMs
        );
    } catch (error) {
        if (error.isTimeout) {
            error.geminiStatus = 504;
        }
        throw error;
    }

    const body = await response.json().catch(() => null);

    if (!response.ok) {
        const message = body?.error?.message || `Gemini API request failed with status ${response.status}.`;
        const error = new Error(message);
        error.geminiStatus = response.status;
        error.geminiErrorType = body?.error?.status;
        throw error;
    }

    return body;
};

const isRateLimitError = (error) => error?.geminiStatus === 429;
const isTimeoutError = (error) => error?.geminiStatus === 504 || Boolean(error?.isTimeout);

module.exports = { sendMessage, isRateLimitError, isTimeoutError };
