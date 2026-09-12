/**
 * Validates the two new persistence-layer request bodies added on top of
 * the existing, unmodified DCF request validation:
 *   - POST /:ticker/dcf/saved         (validateSaveRequest)
 *   - POST /:ticker/dcf/saved/compare (validateCompareRequest)
 *
 * Assumption validation itself is never re-implemented here - both delegate
 * to valuation.validator.js's validateDCFRequestBody, the same function the
 * existing (unmodified) POST /:ticker/dcf endpoint already uses.
 */

const mongoose = require("mongoose");
const { validateDCFRequestBody } = require("../valuation.validator");

const MAX_NAME_LENGTH = 100;
const MAX_COMPARE_SETS = 5;
const MIN_COMPARE_SETS = 2;

const isValidScenarioId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * @param {object} body - {name, ...assumptions} - everything except `name` is passed through as-is to calculateDCFValuation
 * @returns {{isValid: boolean, errors: string[], normalized: {name: string, assumptions: object}}}
 */
const validateSaveRequest = (body) => {
    const errors = [];
    const raw = typeof body === "object" && body !== null ? body : {};

    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!name) {
        errors.push("name is required and must be a non-empty string.");
    } else if (name.length > MAX_NAME_LENGTH) {
        errors.push(`name must be at most ${MAX_NAME_LENGTH} characters.`);
    }

    const { name: _omit, ...assumptions } = raw;
    const assumptionsValidation = validateDCFRequestBody(assumptions);
    errors.push(...assumptionsValidation.errors);

    return { isValid: errors.length === 0, errors, normalized: { name, assumptions } };
};

/**
 * @param {object} body - {savedIds?: string[], adHoc?: {name: string, assumptions: object}[]}
 * @returns {{isValid: boolean, errors: string[], normalized: {savedIds: string[], adHoc: {name: string, assumptions: object}[]}}}
 */
const validateCompareRequest = (body) => {
    const errors = [];
    const raw = typeof body === "object" && body !== null ? body : {};

    const rawSavedIds = Array.isArray(raw.savedIds) ? raw.savedIds : [];
    const savedIds = [];
    rawSavedIds.forEach((id, index) => {
        if (typeof id !== "string" || !isValidScenarioId(id)) {
            errors.push(`savedIds[${index}] must be a valid saved scenario id.`);
        } else {
            savedIds.push(id);
        }
    });

    const rawAdHoc = Array.isArray(raw.adHoc) ? raw.adHoc : [];
    const adHoc = [];
    rawAdHoc.forEach((entry, index) => {
        const label = `adHoc[${index}]`;
        const name = typeof entry?.name === "string" ? entry.name.trim() : "";
        if (!name) {
            errors.push(`${label}.name is required and must be a non-empty string.`);
        } else if (name.length > MAX_NAME_LENGTH) {
            errors.push(`${label}.name must be at most ${MAX_NAME_LENGTH} characters.`);
        }

        const { name: _omit, ...assumptions } = typeof entry === "object" && entry !== null ? entry : {};
        const assumptionsValidation = validateDCFRequestBody(assumptions);
        errors.push(...assumptionsValidation.errors.map((message) => `${label}.${message}`));

        if (name && assumptionsValidation.isValid) {
            adHoc.push({ name, assumptions });
        }
    });

    const totalEntries = rawSavedIds.length + rawAdHoc.length;
    if (totalEntries < MIN_COMPARE_SETS) {
        errors.push(`At least ${MIN_COMPARE_SETS} saved and/or ad-hoc assumption sets are required to compare.`);
    } else if (totalEntries > MAX_COMPARE_SETS) {
        errors.push(`At most ${MAX_COMPARE_SETS} assumption sets may be compared at once.`);
    }

    return { isValid: errors.length === 0, errors, normalized: { savedIds, adHoc } };
};

module.exports = {
    validateSaveRequest,
    validateCompareRequest,
    isValidScenarioId,
    MAX_NAME_LENGTH,
    MAX_COMPARE_SETS,
    MIN_COMPARE_SETS,
};
