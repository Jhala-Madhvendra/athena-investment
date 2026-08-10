/**
 * Comps Validator
 *
 * Structural validation for a Comparable Company Analysis request - the
 * peer list shape and the selected statistic. Framework-independent, same
 * {isValid, errors} shape as dcf.validator.js/financials.validators.
 *
 * Deliberately separate from "does this peer have usable financial data" -
 * that's a data-availability question resolved once statements/quotes are
 * actually fetched (see comps.service.js), not a structural one.
 */

const TICKER_PATTERN = /^[A-Za-z0-9.-]+$/;
const VALID_STATISTICS = ["mean", "median", "p25", "p75"];
const MIN_PEERS = 2;

const normalizeTicker = (ticker) => (typeof ticker === "string" ? ticker.trim().toUpperCase() : "");

/**
 * Validates + normalizes a raw peers array against the target ticker.
 * Non-fatal cleanup (target-as-peer removal, duplicate removal) is
 * reported in `notes`, not `errors` - the request can still succeed with
 * a smaller, cleaned peer list. Fatal problems (not an array, invalidly
 * formatted ticker, fewer than MIN_PEERS peers remaining) go in `errors`.
 *
 * @param {string} targetTicker
 * @param {unknown} rawPeers
 * @returns {{isValid: boolean, errors: string[], notes: string[], peers: string[]}}
 */
const validatePeers = (targetTicker, rawPeers) => {
    const errors = [];
    const notes = [];
    const normalizedTarget = normalizeTicker(targetTicker);

    if (!Array.isArray(rawPeers) || rawPeers.length === 0) {
        return { isValid: false, errors: ["At least two peer tickers are required."], notes, peers: [] };
    }

    const invalidTickers = rawPeers.filter((ticker) => {
        const normalized = normalizeTicker(ticker);
        return !normalized || !TICKER_PATTERN.test(normalized);
    });

    if (invalidTickers.length > 0) {
        errors.push(`The following peer tickers are not validly formatted: ${JSON.stringify(invalidTickers)}.`);
    }

    const normalized = rawPeers.map(normalizeTicker).filter(Boolean);

    const withoutTarget = normalized.filter((ticker) => ticker !== normalizedTarget);
    if (withoutTarget.length !== normalized.length) {
        notes.push(`${normalizedTarget} was removed from the peer list - a company cannot be its own peer.`);
    }

    const deduped = [...new Set(withoutTarget)];
    if (deduped.length !== withoutTarget.length) {
        notes.push("Duplicate peer tickers were removed.");
    }

    if (errors.length === 0 && deduped.length < MIN_PEERS) {
        errors.push(
            `At least ${MIN_PEERS} distinct peer companies (excluding the target) are required - ${deduped.length} remained after validation.`
        );
    }

    return { isValid: errors.length === 0, errors, notes, peers: deduped };
};

/**
 * @param {unknown} statistic - optional; defaults to "median" when omitted (see ValuationMultiples.md for why)
 * @returns {{isValid: boolean, errors: string[], statistic: string|null}}
 */
const validateStatistic = (statistic) => {
    if (statistic === undefined) {
        return { isValid: true, errors: [], statistic: "median" };
    }

    if (!VALID_STATISTICS.includes(statistic)) {
        return {
            isValid: false,
            errors: [`statistic must be one of ${VALID_STATISTICS.join(", ")} - got ${JSON.stringify(statistic)}.`],
            statistic: null,
        };
    }

    return { isValid: true, errors: [], statistic };
};

module.exports = { validatePeers, validateStatistic, VALID_STATISTICS, MIN_PEERS, TICKER_PATTERN };
