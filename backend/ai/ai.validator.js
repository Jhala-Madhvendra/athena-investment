/**
 * AI Validator
 *
 * Structural validation, framework-independent, same {isValid, errors}
 * shape used across the codebase (see valuation/dcf/dcf.validator.js,
 * ratio/ratio.validator.js, valuation/comps/comps.validator.js).
 *
 * Two responsibilities:
 *  - validateReportRequest: the inbound POST body (regenerate flag, an
 *    optional user-supplied DCF cost-of-debt override).
 *  - validateReportSchema: the LLM's structured JSON output. This is the
 *    layer that stops malformed/off-schema/hallucinated-field output from
 *    ever reaching the client - the sprint's non-negotiable "do not return
 *    malformed data" requirement. The LLM is never trusted to have followed
 *    the schema on its own, no matter what the system prompt asked for.
 */

const REQUIRED_STRING_SECTIONS = [
    "executiveSummary",
    "companyOverview",
    "businessPerformance",
    "financialHealth",
    "marketPerformance",
    "valuation",
    "conclusion",
];
const REQUIRED_ARRAY_SECTIONS = ["strengths", "risks", "considerations"];
const OPTIONAL_ARRAY_SECTIONS = ["dataGaps"];
const ALL_TOP_LEVEL_KEYS = new Set([
    ...REQUIRED_STRING_SECTIONS,
    ...REQUIRED_ARRAY_SECTIONS,
    ...OPTIONAL_ARRAY_SECTIONS,
    "sectionEvidence",
]);

// Soft, defense-in-depth check only (logged as a warning, never blocking) -
// the system prompt already forbids recommendations; this catches obvious
// drift without hard-failing on legitimate phrases like "avoid overpaying".
// See research/engineering/AIResponseValidation.md for why this is
// intentionally a warning, not a rejection.
const RECOMMENDATION_PATTERN =
    /\b(strong buy|strong sell|price target|outperform|underperform|overweight|underweight|buy rating|sell rating|hold rating|\bbuy\b|\bsell\b)\b/i;

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const isArrayOfNonEmptyStrings = (value) => Array.isArray(value) && value.every(isNonEmptyString);

/**
 * @param {object} body - req.body for POST /:ticker/research-report
 * @returns {{isValid: boolean, errors: string[], regenerate: boolean, preTaxCostOfDebt: number|undefined}}
 */
const validateReportRequest = (body = {}) => {
    const errors = [];
    const payload = body && typeof body === "object" ? body : {};

    let regenerate = false;
    if (payload.regenerate !== undefined) {
        if (typeof payload.regenerate !== "boolean") {
            errors.push("regenerate must be a boolean.");
        } else {
            regenerate = payload.regenerate;
        }
    }

    let preTaxCostOfDebt;
    if (payload.preTaxCostOfDebt !== undefined && payload.preTaxCostOfDebt !== null) {
        const value = payload.preTaxCostOfDebt;
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value >= 1) {
            errors.push(
                "preTaxCostOfDebt must be a finite number between 0 (inclusive) and 1 (exclusive), e.g. 0.045 for 4.5%."
            );
        } else {
            preTaxCostOfDebt = value;
        }
    }

    return { isValid: errors.length === 0, errors, regenerate, preTaxCostOfDebt };
};

/**
 * Cross-checks sectionEvidence values against a caller-supplied allow-list
 * of real context field paths (see ai.contextBuilder.js's
 * buildEvidenceAllowList). Unknown paths are silently dropped rather than
 * failing validation - a hallucinated evidence citation shouldn't sink an
 * otherwise-valid report, it should just not be shown.
 */
const sanitizeSectionEvidence = (sectionEvidence, evidenceAllowList) => {
    if (!sectionEvidence || typeof sectionEvidence !== "object" || Array.isArray(sectionEvidence)) {
        return {};
    }

    const allowSet = new Set(evidenceAllowList || []);
    const sanitized = {};

    Object.entries(sectionEvidence).forEach(([section, paths]) => {
        if (!Array.isArray(paths)) return;
        const kept = paths.filter((path) => typeof path === "string" && allowSet.has(path));
        if (kept.length > 0) {
            sanitized[section] = kept;
        }
    });

    return sanitized;
};

/**
 * @param {unknown} report - parsed LLM JSON output
 * @param {string[]} [evidenceAllowList] - real context field paths, from ai.contextBuilder.buildEvidenceAllowList
 * @returns {{isValid: boolean, errors: string[], warnings: string[], sanitized: object|null}}
 */
const validateReportSchema = (report, evidenceAllowList = []) => {
    const errors = [];
    const warnings = [];

    if (!report || typeof report !== "object" || Array.isArray(report)) {
        return { isValid: false, errors: ["The AI response must be a JSON object."], warnings, sanitized: null };
    }

    const unexpectedKeys = Object.keys(report).filter((key) => !ALL_TOP_LEVEL_KEYS.has(key));
    if (unexpectedKeys.length > 0) {
        errors.push(`Unexpected field(s) in AI response: ${unexpectedKeys.join(", ")}.`);
    }

    REQUIRED_STRING_SECTIONS.forEach((key) => {
        if (!isNonEmptyString(report[key])) {
            errors.push(`"${key}" must be a non-empty string.`);
        }
    });

    REQUIRED_ARRAY_SECTIONS.forEach((key) => {
        if (!isArrayOfNonEmptyStrings(report[key]) || report[key].length === 0) {
            errors.push(`"${key}" must be a non-empty array of non-empty strings.`);
        }
    });

    if (report.dataGaps !== undefined && !isArrayOfNonEmptyStrings(report.dataGaps)) {
        errors.push('"dataGaps", if present, must be an array of non-empty strings.');
    }

    if (errors.length > 0) {
        return { isValid: false, errors, warnings, sanitized: null };
    }

    ["conclusion", "valuation"].forEach((key) => {
        if (RECOMMENDATION_PATTERN.test(report[key])) {
            warnings.push(`"${key}" may contain investment-recommendation language and should be reviewed: "${report[key]}"`);
        }
    });

    const sanitized = {};
    REQUIRED_STRING_SECTIONS.forEach((key) => {
        sanitized[key] = report[key].trim();
    });
    REQUIRED_ARRAY_SECTIONS.forEach((key) => {
        sanitized[key] = report[key].map((s) => s.trim());
    });
    sanitized.dataGaps = Array.isArray(report.dataGaps) ? report.dataGaps.map((s) => s.trim()) : [];
    sanitized.sectionEvidence = sanitizeSectionEvidence(report.sectionEvidence, evidenceAllowList);

    return { isValid: true, errors, warnings, sanitized };
};

module.exports = {
    validateReportRequest,
    validateReportSchema,
    REQUIRED_STRING_SECTIONS,
    REQUIRED_ARRAY_SECTIONS,
};
