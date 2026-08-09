/**
 * DCF Validator
 *
 * Structural + financial-sanity validation for DCF engine input. Runs
 * BEFORE dcf.engine.js touches the data. Framework-independent - takes and
 * returns plain objects, same {isValid, errors} shape the rest of the
 * codebase already uses (see financials.validators, ratio.validator).
 *
 * This is the single place that enforces the non-negotiable finance rule:
 * WACC must be strictly greater than the terminal growth rate.
 */

const { isFiniteNumber } = require("./dcf.formulas");

const MIN_FORECAST_YEARS = 1;
const MAX_FORECAST_YEARS = 15;

/**
 * A "yearly assumption" may be given as a single number (applied to every
 * forecast year) or an array with exactly one entry per forecast year.
 * Returns a list of error strings (empty if valid).
 */
const validateYearlyAssumption = (label, value, forecastYears) => {
    if (isFiniteNumber(value)) {
        return [];
    }

    if (Array.isArray(value)) {
        if (value.length !== forecastYears) {
            return [
                `${label} must either be a single number or an array with exactly one entry per forecast year (expected ${forecastYears}, got ${value.length}).`,
            ];
        }

        const invalidIndex = value.findIndex((entry) => !isFiniteNumber(entry));
        if (invalidIndex !== -1) {
            return [`${label}[${invalidIndex}] must be a finite number.`];
        }

        return [];
    }

    return [`${label} is required and must be a number or an array of numbers.`];
};

const validateHistoricalFinancials = (historicalFinancials, errors) => {
    if (!historicalFinancials || typeof historicalFinancials !== "object") {
        errors.push("historicalFinancials is required.");
        return;
    }

    const { latestRevenue, latestNWC } = historicalFinancials;

    if (!isFiniteNumber(latestRevenue) || latestRevenue <= 0) {
        errors.push("historicalFinancials.latestRevenue must be a positive number - the forecast has no base to grow from.");
    }

    if (!isFiniteNumber(latestNWC)) {
        errors.push(
            "historicalFinancials.latestNWC must be a finite number (Current Assets - Current Liabilities for the latest year) - required to compute the first forecast year's change in net working capital."
        );
    }
};

const validateAssumptions = (assumptions, errors) => {
    if (!assumptions || typeof assumptions !== "object") {
        errors.push("assumptions is required.");
        return null;
    }

    const { forecastYears } = assumptions;

    if (!Number.isInteger(forecastYears) || forecastYears < MIN_FORECAST_YEARS || forecastYears > MAX_FORECAST_YEARS) {
        errors.push(
            `assumptions.forecastYears must be a whole number between ${MIN_FORECAST_YEARS} and ${MAX_FORECAST_YEARS}.`
        );
        return null;
    }

    [
        ["revenueGrowth", assumptions.revenueGrowth],
        ["ebitMargin", assumptions.ebitMargin],
        ["depreciationPercentRevenue", assumptions.depreciationPercentRevenue],
        ["capexPercentRevenue", assumptions.capexPercentRevenue],
        ["workingCapitalPercentRevenue", assumptions.workingCapitalPercentRevenue],
    ].forEach(([label, value]) => {
        errors.push(...validateYearlyAssumption(label, value, forecastYears));
    });

    if (!isFiniteNumber(assumptions.taxRate) || assumptions.taxRate < 0 || assumptions.taxRate >= 1) {
        errors.push("assumptions.taxRate must be a number between 0 (inclusive) and 1 (exclusive), e.g. 0.21 for 21%.");
    }

    if (!isFiniteNumber(assumptions.wacc) || assumptions.wacc <= 0) {
        errors.push("assumptions.wacc must be a positive number. A zero or negative discount rate is not economically valid.");
    }

    if (!isFiniteNumber(assumptions.terminalGrowthRate)) {
        errors.push("assumptions.terminalGrowthRate must be a finite number.");
    }

    if (
        isFiniteNumber(assumptions.wacc) &&
        isFiniteNumber(assumptions.terminalGrowthRate) &&
        assumptions.wacc <= assumptions.terminalGrowthRate
    ) {
        errors.push(
            `Terminal growth rate (${assumptions.terminalGrowthRate}) must be strictly less than WACC (${assumptions.wacc}). ` +
                "A perpetuity that grows at or faster than its discount rate has no finite present value - no real company can out-grow its cost of capital forever."
        );
    }

    return forecastYears;
};

const validateCapitalStructure = (capitalStructure, errors) => {
    if (!capitalStructure || typeof capitalStructure !== "object") {
        errors.push("capitalStructure is required.");
        return;
    }

    const { debt, cash, dilutedShares } = capitalStructure;

    if (!isFiniteNumber(debt) || debt < 0) {
        errors.push("capitalStructure.debt must be a non-negative number.");
    }

    if (!isFiniteNumber(cash) || cash < 0) {
        errors.push("capitalStructure.cash must be a non-negative number.");
    }

    if (!isFiniteNumber(dilutedShares) || dilutedShares <= 0) {
        errors.push(
            "capitalStructure.dilutedShares must be a positive number. Athena does not substitute an arbitrary share count " +
                "when this is missing - intrinsic value per share cannot be calculated without it."
        );
    }
};

/**
 * @param {object} input - {historicalFinancials, assumptions, capitalStructure}
 * @returns {{isValid: boolean, errors: string[]}}
 */
const validateDCFInput = (input) => {
    const errors = [];

    if (!input || typeof input !== "object") {
        return { isValid: false, errors: ["DCF input is required."] };
    }

    validateHistoricalFinancials(input.historicalFinancials, errors);
    validateAssumptions(input.assumptions, errors);
    validateCapitalStructure(input.capitalStructure, errors);

    return { isValid: errors.length === 0, errors };
};

module.exports = validateDCFInput;
module.exports.validateYearlyAssumption = validateYearlyAssumption;
module.exports.MIN_FORECAST_YEARS = MIN_FORECAST_YEARS;
module.exports.MAX_FORECAST_YEARS = MAX_FORECAST_YEARS;
