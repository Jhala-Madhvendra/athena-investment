const statementNames = ["incomeStatement", "balanceSheet", "cashFlow"];

const isValidNumber = (value) =>
    value === null || (typeof value === "number" && Number.isFinite(value));

const validateFinancialStatement = (statement) => {
    const errors = [];
    const currentYear = new Date().getUTCFullYear();

    if (!statement.companyId) {
        errors.push("companyId is required.");
    }

    if (!statement.ticker || !/^[A-Z0-9.-]+$/.test(statement.ticker)) {
        errors.push("A valid uppercase ticker is required.");
    }

    if (!Number.isInteger(statement.year) || statement.year < 1900 || statement.year > currentYear + 1) {
        errors.push("A valid fiscal year is required.");
    }

    if (!statement.source || typeof statement.source !== "string") {
        errors.push("source is required.");
    }

    statementNames.forEach((statementName) => {
        const financialStatement = statement[statementName];

        if (!financialStatement || typeof financialStatement !== "object") {
            errors.push(`${statementName} is required.`);
            return;
        }

        const values = Object.values(financialStatement);

        if (!values.some((value) => typeof value === "number" && Number.isFinite(value))) {
            errors.push(`${statementName} contains no reported values.`);
        }

        values.forEach((value) => {
            if (!isValidNumber(value)) {
                errors.push(`${statementName} contains an invalid numeric value.`);
            }
        });
    });

    return {
        isValid: errors.length === 0,
        errors,
    };
};

module.exports = validateFinancialStatement;
