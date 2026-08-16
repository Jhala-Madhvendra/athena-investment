/**
 * Industry Validator
 *
 * Structural request validation for Industry Intelligence endpoints.
 * Ticker resolution itself is handled by the shared
 * utils/httpErrors.resolveTickerParam (same as every other domain) - this
 * module only validates the optional `limit` query param on
 * GET /:ticker/peers. Framework-independent, same {isValid, errors} shape
 * as comps.validator.js/dcf.validator.js.
 */

const { SUGGESTED_PEERS_LIMIT } = require("./industry.peerDiscovery");
const { DISCOVERY_LIMIT } = require("./industry.discovery");

const TICKER_PATTERN = /^[A-Za-z0-9.-]+$/;

/**
 * @param {unknown} rawLimit - the raw `limit` query param (string | undefined)
 * @returns {{isValid: boolean, errors: string[], limit: number}}
 */
const validatePeersLimit = (rawLimit) => {
    if (rawLimit === undefined) {
        return { isValid: true, errors: [], limit: SUGGESTED_PEERS_LIMIT };
    }

    const parsed = Number(rawLimit);

    if (!Number.isInteger(parsed) || parsed < 1 || parsed > SUGGESTED_PEERS_LIMIT) {
        return {
            isValid: false,
            errors: [`limit must be an integer between 1 and ${SUGGESTED_PEERS_LIMIT} - got ${JSON.stringify(rawLimit)}.`],
            limit: SUGGESTED_PEERS_LIMIT,
        };
    }

    return { isValid: true, errors: [], limit: parsed };
};

/**
 * Validates the `tickers` array for POST /:ticker/discover/import - the
 * user's selection from the "Find More Companies" checkbox list.
 * @param {unknown} rawTickers
 * @returns {{isValid: boolean, errors: string[], tickers: string[]}}
 */
const validateDiscoveryImportTickers = (rawTickers) => {
    if (!Array.isArray(rawTickers) || rawTickers.length === 0) {
        return { isValid: false, errors: ["At least one ticker is required."], tickers: [] };
    }

    if (rawTickers.length > DISCOVERY_LIMIT) {
        return {
            isValid: false,
            errors: [`No more than ${DISCOVERY_LIMIT} tickers may be imported at once - got ${rawTickers.length}.`],
            tickers: [],
        };
    }

    const invalidTickers = rawTickers.filter(
        (ticker) => typeof ticker !== "string" || !TICKER_PATTERN.test(ticker.trim())
    );

    if (invalidTickers.length > 0) {
        return {
            isValid: false,
            errors: [`The following tickers are not validly formatted: ${JSON.stringify(invalidTickers)}.`],
            tickers: [],
        };
    }

    const deduped = [...new Set(rawTickers.map((ticker) => ticker.trim().toUpperCase()))];

    return { isValid: true, errors: [], tickers: deduped };
};

module.exports = { validatePeersLimit, validateDiscoveryImportTickers };
