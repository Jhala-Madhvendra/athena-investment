/**
 * AI Response Parser
 *
 * ai.promptBuilder.js instructs the model to return only a JSON object,
 * but models occasionally wrap output in a markdown code fence or add
 * stray prose before/after the JSON. This module defensively recovers the
 * JSON payload from those common cases before parsing. It does NOT
 * validate the resulting object's shape - see ai.validator.js for schema
 * validation, a separate concern (this module can hand back a
 * well-formed-but-wrong-shape object; ai.service.js runs both parsing and
 * validation before ever trusting a response).
 */

const CODE_FENCE_PATTERN = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;

const stripCodeFence = (text) => {
    const trimmed = text.trim();
    const match = trimmed.match(CODE_FENCE_PATTERN);
    return match ? match[1].trim() : trimmed;
};

/** Last-resort recovery for stray prose around the JSON object, e.g. "Here is the report:\n{...}\nLet me know if..." */
const extractJsonSubstring = (text) => {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
        return null;
    }
    return text.slice(start, end + 1);
};

/**
 * @param {string} rawText - the LLM provider's raw text response
 * @returns {object} the parsed JSON object (shape not yet validated)
 * @throws {Error} if no valid JSON object could be recovered from the text
 */
const parseReportResponse = (rawText) => {
    if (typeof rawText !== "string" || rawText.trim().length === 0) {
        throw new Error("The AI response was empty.");
    }

    const candidate = stripCodeFence(rawText);

    try {
        return JSON.parse(candidate);
    } catch (firstError) {
        const fallback = extractJsonSubstring(candidate);
        if (fallback) {
            try {
                return JSON.parse(fallback);
            } catch (secondError) {
                // fall through to the shared failure below
            }
        }

        const error = new Error("The AI response was not valid JSON.");
        error.rawText = rawText;
        throw error;
    }
};

module.exports = { parseReportResponse };
