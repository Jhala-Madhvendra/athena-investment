const financialsService = require("../financials/financials.service");
const ratioCalculator = require("./ratio.calculator");
const validateRatioInput = require("./ratio.validator");

class FinancialStatementsNotFoundError extends Error {
    constructor(ticker) {
        super(`Financial statements for ${ticker} were not found in storage.`);
        this.name = "FinancialStatementsNotFoundError";
        this.statusCode = 404;
    }
}

class RatioValidationError extends Error {
    constructor(errors) {
        super("Ratio validation failed.");
        this.name = "RatioValidationError";
        this.statusCode = 422;
        this.errors = errors;
    }
}

const getRatiosByTicker = async (ticker) => {
    const statements = await financialsService.getFinancialStatementsByTicker(ticker);

    if (!statements || statements.length === 0) {
        throw new FinancialStatementsNotFoundError(ticker);
    }

    const latestStatement = statements[0];
    const validation = validateRatioInput(latestStatement);

    if (!validation.isValid) {
        throw new RatioValidationError(validation.errors);
    }

    const ratioPayload = ratioCalculator.calculateRatios(latestStatement);

    return {
        ticker: latestStatement.ticker,
        year: latestStatement.year,
        ratios: ratioPayload,
    };
};

module.exports = {
    getRatiosByTicker,
};
