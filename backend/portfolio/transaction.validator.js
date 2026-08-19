/**
 * Structural validation for a transaction write (create/edit) - same
 * {isValid, errors, normalized} shape as portfolio.validator.js. Ticker
 * existence is resolved separately at the controller layer
 * (resolveTickerParam), matching the Holding add flow. Ownership and the
 * "can't sell more than you held at that point in time" rule both require
 * reading the rest of the user's ledger, so they live in transaction.service.js,
 * not here - this module only owns the fields that can be checked in isolation.
 */

const TRANSACTION_TYPES = ["BUY", "SELL"];

const validateTransactionInput = ({ type, quantity, price, transactionDate }) => {
    const errors = [];

    const normalizedType = typeof type === "string" ? type.trim().toUpperCase() : type;
    if (!TRANSACTION_TYPES.includes(normalizedType)) {
        errors.push(`Transaction type must be one of: ${TRANSACTION_TYPES.join(", ")}.`);
    }

    const numericQuantity = Number(quantity);
    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
        errors.push("Quantity must be a positive number.");
    }

    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
        errors.push("Price must be zero or a positive number.");
    }

    const parsedDate = transactionDate ? new Date(transactionDate) : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
        errors.push("A valid transaction date is required.");
    } else if (parsedDate.getTime() > Date.now()) {
        errors.push("Transaction date cannot be in the future.");
    }

    return {
        isValid: errors.length === 0,
        errors,
        normalized:
            errors.length === 0
                ? { type: normalizedType, quantity: numericQuantity, price: numericPrice, transactionDate: parsedDate }
                : null,
    };
};

module.exports = { TRANSACTION_TYPES, validateTransactionInput };
