/**
 * Anthropic Client
 *
 * Low-level fetch-based HTTP client for the Anthropic Messages API -
 * mirrors backend/providers/twelvedata/twelveDataClient.js: one function
 * that does the HTTP call and normalizes both HTTP-level and in-body
 * failures into a single Error shape, plus a helper to recognize rate
 * limiting. No @anthropic-ai/sdk dependency, matching this repo's existing
 * convention of hand-rolled clients for every external API (Yahoo, Twelve
 * Data).
 */

const fetchWithTimeout = require("../../../utils/fetchWithTimeout");
const env = require("../../../config/env");

const MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

/**
 * @param {{systemPrompt: string, userMessage: string, maxTokens: number, temperature: number}} params
 * @returns {Promise<object>} the parsed Anthropic Messages API response body
 */
const sendMessage = async ({ systemPrompt, userMessage, maxTokens, temperature }) => {
    if (!env.anthropicApiKey) {
        const error = new Error("ANTHROPIC_API_KEY is not configured on the server.");
        error.anthropicStatus = 401;
        throw error;
    }

    let response;
    try {
        response = await fetchWithTimeout(
            MESSAGES_URL,
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-api-key": env.anthropicApiKey,
                    "anthropic-version": ANTHROPIC_VERSION,
                },
                body: JSON.stringify({
                    model: env.anthropicModel,
                    max_tokens: maxTokens,
                    temperature,
                    system: systemPrompt,
                    messages: [{ role: "user", content: userMessage }],
                }),
            },
            env.aiRequestTimeoutMs
        );
    } catch (error) {
        if (error.isTimeout) {
            error.anthropicStatus = 504;
        }
        throw error;
    }

    const body = await response.json().catch(() => null);

    if (!response.ok) {
        const message = body?.error?.message || `Anthropic API request failed with status ${response.status}.`;
        const error = new Error(message);
        error.anthropicStatus = response.status;
        error.anthropicErrorType = body?.error?.type;
        throw error;
    }

    return body;
};

// Distinguishes "temporarily unavailable/overloaded" from a genuine
// request/auth error further up the stack, same reasoning as
// isRateLimitError in twelveDataClient.js.
const isRateLimitError = (error) => error?.anthropicStatus === 429;
const isOverloadedError = (error) => error?.anthropicStatus === 529;
const isTimeoutError = (error) => error?.anthropicStatus === 504 || Boolean(error?.isTimeout);

module.exports = { sendMessage, isRateLimitError, isOverloadedError, isTimeoutError };
