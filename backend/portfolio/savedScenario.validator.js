/**
 * Saved Scenario Validator
 *
 * Reuses portfolio.scenario.validator.js's validateScenarioRequest directly
 * for the {name, rules, benchmark, window} portion - zero duplicated rule-
 * shape validation. Only owns what's new here: alertThresholdPercent.
 */

const { validateScenarioRequest } = require("./portfolio.scenario.validator");

const MIN_THRESHOLD_PERCENT = -100;

const validateSavedScenarioRequest = (body) => {
    const errors = [];
    const raw = typeof body === "object" && body !== null ? body : {};

    const scenarioValidation = validateScenarioRequest(raw);
    errors.push(...scenarioValidation.errors);

    const rawThreshold = raw.alertThresholdPercent;
    const threshold = typeof rawThreshold === "number" ? rawThreshold : Number(rawThreshold);
    let alertThresholdPercent = null;

    if (!Number.isFinite(threshold)) {
        errors.push("alertThresholdPercent must be a number.");
    } else if (threshold >= 0) {
        errors.push("alertThresholdPercent must be negative - a watch only makes sense for a downside threshold, e.g. -15.");
    } else if (threshold < MIN_THRESHOLD_PERCENT) {
        errors.push(`alertThresholdPercent must be at least ${MIN_THRESHOLD_PERCENT}.`);
    } else {
        alertThresholdPercent = threshold;
    }

    return {
        isValid: errors.length === 0,
        errors,
        normalized: errors.length === 0 ? { ...scenarioValidation.normalized, alertThresholdPercent } : null,
    };
};

module.exports = { validateSavedScenarioRequest };
