const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);

const validateRatioInput = (statement) => {
    const errors = [];

    if (!isObject(statement)) {
        errors.push("Financial statement must be an object.");
        return { isValid: false, errors };
    }

    if (!isObject(statement.incomeStatement)) {
        errors.push("incomeStatement is required.");
    }

    if (!isObject(statement.balanceSheet)) {
        errors.push("balanceSheet is required.");
    }

    if (!isObject(statement.cashFlow)) {
        errors.push("cashFlow is required.");
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
};

module.exports = validateRatioInput;
