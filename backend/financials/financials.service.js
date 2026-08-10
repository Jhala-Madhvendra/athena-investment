const Company = require("../models/company.model");
const FinancialStatement = require("./financials.model");
const financialStatementsProvider = require("./providers/financialStatementsProvider.registry");
const validateFinancialStatement = require("./validators/financialStatements.validator");

class CompanyNotFoundError extends Error {
    constructor(ticker) {
        super(`Company ${ticker} was not found. Import the company before importing financial statements.`);
        this.name = "CompanyNotFoundError";
        this.statusCode = 404;
    }
}

class FinancialStatementsValidationError extends Error {
    constructor(errors) {
        super("Financial statement validation failed.");
        this.name = "FinancialStatementsValidationError";
        this.statusCode = 422;
        this.errors = errors;
    }
}

const normalizeTicker = (ticker) => ticker.trim().toUpperCase();

const findCompanyByTicker = async (ticker) => {
    const company = await Company.findOne({ ticker });

    if (!company) {
        throw new CompanyNotFoundError(ticker);
    }

    return company;
};

const importFinancialStatements = async (ticker) => {
    const normalizedTicker = normalizeTicker(ticker);
    const company = await findCompanyByTicker(normalizedTicker);
    const normalizedStatements = await financialStatementsProvider.getAnnualFinancialStatements(
        normalizedTicker
    );

    if (!normalizedStatements.length) {
        throw new FinancialStatementsValidationError([
            "No annual financial statements were returned by the financial data provider.",
        ]);
    }

    const statementsToStore = normalizedStatements.map((statement) => ({
        ...statement,
        companyId: company._id,
    }));

    const validationErrors = statementsToStore.flatMap((statement) => {
        const validation = validateFinancialStatement(statement);

        return validation.isValid ? [] : [`${statement.year}: ${validation.errors.join(" ")}`];
    });

    if (validationErrors.length) {
        throw new FinancialStatementsValidationError(validationErrors);
    }

    return Promise.all(
        statementsToStore.map((statement) =>
            FinancialStatement.findOneAndUpdate(
                { ticker: statement.ticker, year: statement.year },
                statement,
                { returnDocument: "after", upsert: true, runValidators: true }
            )
        )
    );
};

const getFinancialStatementsByTicker = async (ticker) => {
    const normalizedTicker = normalizeTicker(ticker);

    await findCompanyByTicker(normalizedTicker);

    return FinancialStatement.find({ ticker: normalizedTicker }).sort({ year: -1 });
};

const getFinancialStatementByYear = async (ticker, year) => {
    const normalizedTicker = normalizeTicker(ticker);

    await findCompanyByTicker(normalizedTicker);

    return FinancialStatement.findOne({ ticker: normalizedTicker, year });
};

module.exports = {
    importFinancialStatements,
    getFinancialStatementsByTicker,
    getFinancialStatementByYear,
    CompanyNotFoundError,
    FinancialStatementsValidationError,
};
