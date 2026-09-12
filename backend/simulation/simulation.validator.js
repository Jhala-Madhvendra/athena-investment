/**
 * Structural validation for paper-portfolio CRUD. Ticker existence is not
 * checked here (same deferral as portfolio.validator.js's
 * validateHoldingInput) - an unresolvable ticker simply produces an
 * unpriced/excluded position downstream, it never blocks saving the
 * hypothetical portfolio itself.
 *
 * Scenario run/compare validation is NOT reimplemented here - a synthetic
 * portfolio's scenario rule shape is byte-identical to a real portfolio's,
 * so this module re-exports portfolio.scenario.validator.js's functions
 * directly.
 */

const mongoose = require("mongoose");
const { validateScenarioRequest, validateCompareRequest } = require("../portfolio/portfolio.scenario.validator");

const MAX_NAME_LENGTH = 100;
const MAX_HOLDINGS = 100;
const TICKER_PATTERN = /^[A-Za-z0-9.-]+$/;

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

const isValidPortfolioId = (id) => mongoose.Types.ObjectId.isValid(id);

const validateHoldingEntry = (rawHolding, index) => {
    const errors = [];
    const label = `holdings[${index}]`;

    if (typeof rawHolding !== "object" || rawHolding === null) {
        return { holding: null, errors: [`${label} must be an object.`] };
    }

    const ticker = typeof rawHolding.ticker === "string" ? rawHolding.ticker.trim().toUpperCase() : "";
    if (!ticker || !TICKER_PATTERN.test(ticker)) {
        errors.push(`${label}.ticker must be a valid ticker symbol.`);
    }

    const shares = Number(rawHolding.shares);
    if (!isFiniteNumber(shares) || shares <= 0) {
        errors.push(`${label}.shares must be a positive number.`);
    }

    let assumedPrice = null;
    if (rawHolding.assumedPrice !== undefined && rawHolding.assumedPrice !== null) {
        const parsed = Number(rawHolding.assumedPrice);
        if (!isFiniteNumber(parsed) || parsed < 0) {
            errors.push(`${label}.assumedPrice, if provided, must be zero or a positive number.`);
        } else {
            assumedPrice = parsed;
        }
    }

    if (errors.length > 0) {
        return { holding: null, errors };
    }

    return { holding: { ticker, shares, assumedPrice }, errors: [] };
};

/**
 * @param {{name?: unknown, holdings?: unknown}} body
 * @returns {{isValid: boolean, errors: string[], normalized: {name: string, holdings: object[]}}}
 */
const validatePortfolioRequest = (body) => {
    const errors = [];
    const raw = typeof body === "object" && body !== null ? body : {};

    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!name) {
        errors.push("name is required and must be a non-empty string.");
    } else if (name.length > MAX_NAME_LENGTH) {
        errors.push(`name must be at most ${MAX_NAME_LENGTH} characters.`);
    }

    const rawHoldings = raw.holdings === undefined ? [] : raw.holdings;
    if (!Array.isArray(rawHoldings)) {
        errors.push("holdings must be an array.");
    } else if (rawHoldings.length > MAX_HOLDINGS) {
        errors.push(`holdings must contain at most ${MAX_HOLDINGS} entries.`);
    }

    const holdings = [];
    if (Array.isArray(rawHoldings)) {
        rawHoldings.slice(0, MAX_HOLDINGS).forEach((rawHolding, index) => {
            const { holding, errors: holdingErrors } = validateHoldingEntry(rawHolding, index);
            errors.push(...holdingErrors);
            if (holding) holdings.push(holding);
        });
    }

    return { isValid: errors.length === 0, errors, normalized: { name, holdings } };
};

module.exports = {
    validateCreatePortfolioRequest: validatePortfolioRequest,
    validateUpdatePortfolioRequest: validatePortfolioRequest,
    isValidPortfolioId,
    validateScenarioRequest,
    validateCompareRequest,
    MAX_NAME_LENGTH,
    MAX_HOLDINGS,
};
