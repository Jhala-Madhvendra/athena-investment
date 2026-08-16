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

module.exports = { validatePeersLimit };
