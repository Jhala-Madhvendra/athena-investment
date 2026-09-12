/**
 * Portfolio Digest Validator
 *
 * Schema validation for the LLM's structured JSON output - same
 * {isValid, errors, sanitized} shape and "never trust the model followed
 * the schema" discipline as ai.validator.js/earnings.aiValidator.js, for
 * the {narrative, holdingHighlights, evidenceUsed} shape this feature uses.
 */

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

const isValidHighlight = (value) =>
    typeof value === "object" && value !== null && !Array.isArray(value) && isNonEmptyString(value.ticker) && isNonEmptyString(value.note);

/**
 * @param {unknown} digest - parsed LLM JSON output
 * @param {string[]} evidenceAllowList - real digest-context field paths, from portfolioDigest.promptBuilder.buildEvidenceAllowList
 * @returns {{isValid: boolean, errors: string[], sanitized: object|null}}
 */
const validateDigestSchema = (digest, evidenceAllowList = []) => {
    const errors = [];

    if (!digest || typeof digest !== "object" || Array.isArray(digest)) {
        return { isValid: false, errors: ["The AI response must be a JSON object."], sanitized: null };
    }

    const unexpectedKeys = Object.keys(digest).filter((key) => !["narrative", "holdingHighlights", "evidenceUsed"].includes(key));
    if (unexpectedKeys.length > 0) {
        errors.push(`Unexpected field(s) in AI response: ${unexpectedKeys.join(", ")}.`);
    }

    if (!isNonEmptyString(digest.narrative)) {
        errors.push('"narrative" must be a non-empty string.');
    }

    if (digest.holdingHighlights !== undefined) {
        if (!Array.isArray(digest.holdingHighlights) || !digest.holdingHighlights.every(isValidHighlight)) {
            errors.push('"holdingHighlights", if present, must be an array of { ticker, note } objects.');
        }
    }

    if (digest.evidenceUsed !== undefined && !Array.isArray(digest.evidenceUsed)) {
        errors.push('"evidenceUsed", if present, must be an array of strings.');
    }

    if (errors.length > 0) {
        return { isValid: false, errors, sanitized: null };
    }

    const allowSet = new Set(evidenceAllowList);
    const evidenceUsed = Array.isArray(digest.evidenceUsed)
        ? digest.evidenceUsed.filter((path) => typeof path === "string" && allowSet.has(path))
        : [];

    return {
        isValid: true,
        errors,
        sanitized: {
            narrative: digest.narrative.trim(),
            holdingHighlights: Array.isArray(digest.holdingHighlights)
                ? digest.holdingHighlights.map((h) => ({ ticker: h.ticker.trim().toUpperCase(), note: h.note.trim() }))
                : [],
            evidenceUsed,
        },
    };
};

module.exports = { validateDigestSchema };
