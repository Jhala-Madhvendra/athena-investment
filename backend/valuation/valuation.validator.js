/**
 * Validates the HTTP request body for POST /:ticker/dcf.
 *
 * This only covers the WACC/CAPM inputs (risk-free rate, beta, equity risk
 * premium, pre-tax cost of debt) - the fields dcf.engine.js's own
 * dcf.validator.js knows nothing about, since the engine takes a single
 * pre-computed `wacc` number. Everything else in the request body
 * (forecast assumptions, terminal growth rate, tax rate) is validated
 * where it's actually used: inside dcf.engine's calculateDCF, once WACC
 * has been computed and the full engine input is assembled.
 */

const { isFiniteNumber } = require("./dcf/dcf.formulas");

const REQUIRED_WACC_FIELDS = ["riskFreeRate", "beta", "equityRiskPremium", "preTaxCostOfDebt"];

const validateDCFRequestBody = (body) => {
    if (!body || typeof body !== "object") {
        return { isValid: false, errors: ["A request body with DCF assumptions is required."] };
    }

    const errors = REQUIRED_WACC_FIELDS.filter((field) => !isFiniteNumber(body[field])).map(
        (field) =>
            `${field} is required and must be a number. Athena does not default this value - it must be an explicit, labeled assumption you provide.`
    );

    return { isValid: errors.length === 0, errors };
};

/**
 * Validates the optional `waccValues` / `terminalGrowthValues` range
 * overrides on POST /:ticker/dcf/sensitivity. Both are optional - when
 * omitted, valuation.service.js generates a default range centered on the
 * base case. When provided, each must be a non-empty array of finite
 * numbers so a malformed override fails clearly instead of silently
 * producing an empty or NaN-filled matrix.
 */
const validateSensitivityRangeOverrides = (body) => {
    const errors = [];

    ["waccValues", "terminalGrowthValues"].forEach((field) => {
        const value = body?.[field];

        if (value === undefined) {
            return;
        }

        if (!Array.isArray(value) || value.length === 0 || !value.every(isFiniteNumber)) {
            errors.push(`${field}, if provided, must be a non-empty array of numbers.`);
        }
    });

    return { isValid: errors.length === 0, errors };
};

module.exports = { validateDCFRequestBody, validateSensitivityRangeOverrides };
