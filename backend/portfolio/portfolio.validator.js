/**
 * Structural validation for a holding write (add/edit) - same {isValid,
 * errors} shape as dcf.validator.js/comps.validator.js. Ticker existence
 * is resolved separately at the controller layer (resolveTickerParam),
 * matching the Watchlist add flow - this validator only owns the numeric
 * and date fields specific to a holding.
 */

const validateHoldingInput = ({ shares, averagePurchasePrice, purchaseDate }) => {
    const errors = [];

    const numericShares = Number(shares);
    if (!Number.isFinite(numericShares) || numericShares <= 0) {
        errors.push("Shares must be a positive number. Short selling is not supported.");
    }

    const numericPrice = Number(averagePurchasePrice);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
        errors.push("Purchase price must be zero or a positive number.");
    }

    const parsedDate = purchaseDate ? new Date(purchaseDate) : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
        errors.push("A valid purchase date is required.");
    } else if (parsedDate.getTime() > Date.now()) {
        errors.push("Purchase date cannot be in the future.");
    }

    return {
        isValid: errors.length === 0,
        errors,
        normalized:
            errors.length === 0
                ? { shares: numericShares, averagePurchasePrice: numericPrice, purchaseDate: parsedDate }
                : null,
    };
};

module.exports = { validateHoldingInput };
