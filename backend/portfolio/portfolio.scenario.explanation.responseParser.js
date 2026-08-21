/**
 * Portfolio Scenario Explanation Response Parser
 *
 * portfolio.scenario.explanation.promptBuilder.js asks for a single JSON
 * object with one "explanation" string field - NOT plain prose - because
 * two of the three configured LLM providers force JSON output at the
 * transport level regardless of prompt wording (openaiClient.js's
 * response_format: json_object, geminiClient.js's responseMimeType:
 * application/json - both built for Sprint 8's JSON research report and
 * shared unconditionally by every caller of generateReport). Asking for
 * plain prose against a transport-level JSON constraint just makes the
 * model wrap prose in an ad hoc JSON shape it invents on the fly - this
 * module asks for one specific, parseable shape instead and extracts the
 * prose from it, the same strategy ai.responseParser.js already uses for
 * the research report.
 *
 * Mirrors ai.responseParser.js's defensive recovery (code-fence stripping,
 * stray-prose trimming) plus one case that module doesn't need: a model
 * that JSON-encodes its own JSON object a second time (producing a JSON
 * *string* whose content is itself the real object) - observed in
 * practice with the forced-JSON providers above.
 */

const CODE_FENCE_PATTERN = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;

const stripCodeFence = (text) => {
    const trimmed = text.trim();
    const match = trimmed.match(CODE_FENCE_PATTERN);
    return match ? match[1].trim() : trimmed;
};

const extractJsonObjectSubstring = (text) => {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    return text.slice(start, end + 1);
};

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

/** Unwraps a value at most one extra layer of JSON-string-encoding deep, then returns it if it's a plain object. */
const resolveToObject = (value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
    if (typeof value === "string") {
        try {
            const reparsed = JSON.parse(value);
            if (reparsed && typeof reparsed === "object" && !Array.isArray(reparsed)) return reparsed;
        } catch {
            return null;
        }
    }
    return null;
};

/**
 * @param {string} rawText - the LLM provider's raw text response
 * @returns {string} the extracted, trimmed explanation prose
 * @throws {Error} if no {"explanation": "..."} shape could be recovered from the text
 */
const parseExplanationResponse = (rawText) => {
    if (typeof rawText !== "string" || rawText.trim().length === 0) {
        throw new Error("The AI response was empty.");
    }

    const candidate = stripCodeFence(rawText);

    let parsed;
    try {
        parsed = JSON.parse(candidate);
    } catch {
        const fallback = extractJsonObjectSubstring(candidate);
        if (fallback) {
            try {
                parsed = JSON.parse(fallback);
            } catch {
                throw new Error("The AI response was not valid JSON.");
            }
        } else {
            throw new Error("The AI response was not valid JSON.");
        }
    }

    const asObject = resolveToObject(parsed);
    if (!asObject || !isNonEmptyString(asObject.explanation)) {
        throw new Error('The AI response JSON did not contain a non-empty "explanation" string field.');
    }

    return asObject.explanation.trim();
};

module.exports = { parseExplanationResponse };
