/**
 * Earnings Validator
 *
 * Validates the inputs Earnings Intelligence needs beyond what
 * resolveTickerParam (backend/utils/httpErrors.js) already guarantees for
 * the ticker itself.
 */

/** At least one stored statement is required to show a "latest period" at all - a second is needed for comparison, but that's a degraded-not-broken case (see earnings.periods.js), not a validation failure. */
const validateStatementsAvailable = (statements) => {
    if (!Array.isArray(statements) || statements.length === 0) {
        return {
            isValid: false,
            errors: [
                "No financial statements are available for this ticker. Import financial statements before requesting earnings intelligence.",
            ],
        };
    }

    return { isValid: true, errors: [] };
};

module.exports = { validateStatementsAvailable };
