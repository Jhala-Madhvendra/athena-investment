/**
 * Portfolio Analytics Validator
 *
 * Structural validation for GET /api/portfolio/analytics's query params.
 * Same {isValid, errors} shape as portfolio.validator.js/industry.validator.js.
 * Ticker resolution for an explicit `benchmark` override happens at the
 * service layer (via companyService.resolveTicker, same as every other
 * ticker-accepting endpoint) - this only checks it's a plausible ticker
 * shape before spending a resolution round trip on it.
 */

const { SUPPORTED_PERIODS } = require("../market/market.service");

const TICKER_PATTERN = /^[A-Za-z0-9.-]+$/;
const DEFAULT_WINDOW = "1y";

/**
 * @param {unknown} rawWindow - the raw `window` query param (string | undefined)
 * @param {unknown} rawBenchmark - the raw `benchmark` query param (string | undefined)
 * @returns {{isValid: boolean, errors: string[], window: string, benchmark: string|null}}
 */
const validateAnalyticsQuery = ({ window: rawWindow, benchmark: rawBenchmark }) => {
    const errors = [];

    const window = rawWindow === undefined ? DEFAULT_WINDOW : String(rawWindow).toLowerCase();
    if (!SUPPORTED_PERIODS.includes(window)) {
        errors.push(`window must be one of ${SUPPORTED_PERIODS.join(", ")} - got ${JSON.stringify(rawWindow)}.`);
    }

    let benchmark = null;
    if (rawBenchmark !== undefined && rawBenchmark !== "") {
        const trimmed = String(rawBenchmark).trim().toUpperCase();
        if (!TICKER_PATTERN.test(trimmed)) {
            errors.push(`benchmark must be a valid ticker symbol - got ${JSON.stringify(rawBenchmark)}.`);
        } else {
            benchmark = trimmed;
        }
    }

    return { isValid: errors.length === 0, errors, window, benchmark };
};

module.exports = { validateAnalyticsQuery, DEFAULT_WINDOW };
