const financialsService = require("./financials.service");
const companyService = require("../services/company.service");

const tickerPattern = /^[A-Za-z0-9.-]+$/;

const isTickerLike = (value) =>
    typeof value === "string" &&
    value.trim().length > 0 &&
    tickerPattern.test(value.trim());

const isValidYear = (year) => {
    const parsedYear = Number(year); 
    const currentYear = new Date().getUTCFullYear();

    return Number.isInteger(parsedYear) && parsedYear >= 1900 && parsedYear <= currentYear + 1;
};

const sendServiceError = (res, error, fallbackStatusCode) => {
    const statusCode = error.statusCode || fallbackStatusCode;

    return res.status(statusCode).json({
        message: error.message,
        ...(error.errors ? { errors: error.errors } : {}),
    });
};

const resolveTickerParam = async (query) => {
    const normalizedQuery = typeof query === "string" ? query.trim() : "";

    if (!normalizedQuery) {
        const error = new Error("A valid ticker or company name is required.");
        error.statusCode = 400;
        throw error;
    }

    const ticker = await companyService.resolveTicker(normalizedQuery);

    if (!ticker) {
        const error = new Error("Company name or ticker could not be resolved.");
        error.statusCode = 404;
        throw error;
    }

    return ticker;
};

const importFinancialStatements = async (req, res) => {
    const { ticker } = req.params;

    try {
        const resolvedTicker = await resolveTickerParam(ticker);
        const financialStatements = await financialsService.importFinancialStatements(resolvedTicker);

        return res.status(200).json({ financialStatements });
    } catch (error) {
        return sendServiceError(res, error, 502);
    }
};

const loadFinancialStatements = async (ticker) => {
    const financialStatements = await financialsService.getFinancialStatementsByTicker(ticker);

    if (financialStatements.length > 0) {
        return financialStatements;
    }

    await financialsService.importFinancialStatements(ticker);

    return financialsService.getFinancialStatementsByTicker(ticker);
};

const getFinancialStatementsByTicker = async (req, res) => {
    const { ticker } = req.params;

    try {
        const resolvedTicker = await resolveTickerParam(ticker);
        const [financialStatements, company] = await Promise.all([
            loadFinancialStatements(resolvedTicker),
            companyService.getCompanyDetails(resolvedTicker),
        ]);

        return res.status(200).json({ financialStatements, currency: company?.currency ?? null });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const getFinancialStatementByYear = async (req, res) => {
    const { ticker, year } = req.params;

    if (!isValidYear(year)) {
        return res.status(400).json({ message: "A valid fiscal year is required." });
    }

    try {
        const resolvedTicker = await resolveTickerParam(ticker);
        const financialStatement = await financialsService.getFinancialStatementByYear(
            resolvedTicker,
            Number(year)
        );

        if (!financialStatement) {
            return res.status(404).json({ message: "Financial statement not found." });
        }

        return res.status(200).json({ financialStatement });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

module.exports = {
    importFinancialStatements,
    getFinancialStatementsByTicker,
    getFinancialStatementByYear,
};
