/**
 * OpenAI Client
 *
 * Low-level fetch-based HTTP client for the OpenAI Chat Completions API -
 * mirrors backend/ai/providers/anthropic/anthropicClient.js exactly: one
 * function that does the HTTP call and normalizes both HTTP-level and
 * in-body failures into a single Error shape. No `openai` SDK dependency,
 * matching this repo's convention of hand-rolled clients for every
 * external API.
 */

const fetchWithTimeout = require("../../../utils/fetchWithTimeout");
const env = require("../../../config/env");

const CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";

/**
 * @param {{systemPrompt: string, userMessage: string, maxTokens: number, temperature: number}} params
 * @returns {Promise<object>} the parsed OpenAI Chat Completions API response body
 */
const sendMessage = async ({ systemPrompt, userMessage, maxTokens, temperature }) => {
    if (!env.openaiApiKey) {
        const error = new Error("OPENAI_API_KEY is not configured on the server.");
        error.openaiStatus = 401;
        throw error;
    }

    let response;
    try {
        response = await fetchWithTimeout(
            CHAT_COMPLETIONS_URL,
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    authorization: `Bearer ${env.openaiApiKey}`,
                },
                body: JSON.stringify({
                    model: env.openaiModel,
                    max_tokens: maxTokens,
                    temperature,
                    // Native JSON-object mode - OpenAI-specific reliability
                    // improvement over the plain-prompt-instruction approach
                    // anthropicClient.js uses (Anthropic's Messages API has
                    // no equivalent in the version this client targets).
                    response_format: { type: "json_object" },
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userMessage },
                    ],
                }),
            },
            env.aiRequestTimeoutMs
        );
    } catch (error) {
        if (error.isTimeout) {
            error.openaiStatus = 504;
        }
        throw error;
    }

    const body = await response.json().catch(() => null);

    if (!response.ok) {
        const message = body?.error?.message || `OpenAI API request failed with status ${response.status}.`;
        const error = new Error(message);
        error.openaiStatus = response.status;
        error.openaiErrorType = body?.error?.type;
        throw error;
    }

    return body;
};

const isRateLimitError = (error) => error?.openaiStatus === 429;
const isTimeoutError = (error) => error?.openaiStatus === 504 || Boolean(error?.isTimeout);

module.exports = { sendMessage, isRateLimitError, isTimeoutError };
