/**
 * Earnings AI Validator
 *
 * Schema validation for the LLM's structured JSON output, same
 * {isValid, errors, sanitized} shape and same "never trust the model
 * followed the schema" discipline as backend/ai/ai.validator.js's
 * validateReportSchema - just for the narrower {narrative, evidenceUsed}
 * shape this feature uses.
 */

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

/**
 * @param {unknown} summary - parsed LLM JSON output
 * @param {string[]} evidenceAllowList - real earnings-payload field paths, from earnings.aiPromptBuilder.buildEvidenceAllowList
 * @returns {{isValid: boolean, errors: string[], sanitized: object|null}}
 */
const validateSummarySchema = (summary, evidenceAllowList = []) => {
    const errors = [];

    if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
        return { isValid: false, errors: ["The AI response must be a JSON object."], sanitized: null };
    }

    const unexpectedKeys = Object.keys(summary).filter((key) => key !== "narrative" && key !== "evidenceUsed");
    if (unexpectedKeys.length > 0) {
        errors.push(`Unexpected field(s) in AI response: ${unexpectedKeys.join(", ")}.`);
    }

    if (!isNonEmptyString(summary.narrative)) {
        errors.push('"narrative" must be a non-empty string.');
    }

    if (summary.evidenceUsed !== undefined && !Array.isArray(summary.evidenceUsed)) {
        errors.push('"evidenceUsed", if present, must be an array of strings.');
    }

    if (errors.length > 0) {
        return { isValid: false, errors, sanitized: null };
    }

    // Hallucinated citations are dropped, not fatal - same reasoning as
    // ai.validator.js's sanitizeSectionEvidence: an invented citation
    // shouldn't sink an otherwise-valid summary, it should just not be shown.
    const allowSet = new Set(evidenceAllowList);
    const evidenceUsed = Array.isArray(summary.evidenceUsed)
        ? summary.evidenceUsed.filter((path) => typeof path === "string" && allowSet.has(path))
        : [];

    return {
        isValid: true,
        errors,
        sanitized: { narrative: summary.narrative.trim(), evidenceUsed },
    };
};

module.exports = { validateSummarySchema };
