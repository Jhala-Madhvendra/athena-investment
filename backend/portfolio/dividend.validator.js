/**
 * Structural validation for a dividend write (add/edit) - same
 * {isValid, errors, normalized} shape as transaction.validator.js. Ticker
 * existence is resolved separately at the controller layer, matching every
 * other portfolio-domain form.
 */

const validateDividendInput = ({ amountPerShare, shares, payDate, reinvested, reinvestmentPrice }) => {
    const errors = [];

    const numericAmountPerShare = Number(amountPerShare);
    if (!Number.isFinite(numericAmountPerShare) || numericAmountPerShare < 0) {
        errors.push("Amount per share must be zero or a positive number.");
    }

    const numericShares = Number(shares);
    if (!Number.isFinite(numericShares) || numericShares < 0) {
        errors.push("Shares must be zero or a positive number.");
    }

    const parsedDate = payDate ? new Date(payDate) : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
        errors.push("A valid pay date is required.");
    } else if (parsedDate.getTime() > Date.now()) {
        errors.push("Pay date cannot be in the future.");
    }

    const isReinvested = reinvested === true;
    let numericReinvestmentPrice = null;

    if (isReinvested) {
        numericReinvestmentPrice = Number(reinvestmentPrice);
        if (!Number.isFinite(numericReinvestmentPrice) || numericReinvestmentPrice <= 0) {
            errors.push("Reinvestment price must be a positive number when a dividend is marked reinvested.");
        }
    } else if (reinvestmentPrice !== undefined && reinvestmentPrice !== null && reinvestmentPrice !== "") {
        errors.push("Reinvestment price can only be set when a dividend is marked reinvested.");
    }

    if (errors.length > 0) {
        return { isValid: false, errors, normalized: null };
    }

    const totalAmount = numericAmountPerShare * numericShares;
    const sharesAcquired = isReinvested ? totalAmount / numericReinvestmentPrice : null;

    return {
        isValid: true,
        errors,
        normalized: {
            amountPerShare: numericAmountPerShare,
            shares: numericShares,
            totalAmount,
            payDate: parsedDate,
            reinvested: isReinvested,
            reinvestmentPrice: isReinvested ? numericReinvestmentPrice : null,
            sharesAcquired,
        },
    };
};

module.exports = { validateDividendInput };
