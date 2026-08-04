const companyService = require("../services/company.service");

const tickerPattern = /^[A-Za-z0-9.-]+$/;

const isValidTicker = (ticker) =>
    typeof ticker === "string" &&
    ticker.trim().length > 0 &&
    tickerPattern.test(ticker.trim());

const searchCompanies = async (req, res, next) => {
    try {
        const query = typeof req.query.q === "string" ? req.query.q : "";
        const companies = await companyService.searchCompanies(query);

        return res.status(200).json({ companies });
    } catch (error) {
        return next(error);
    }
};

const getCompanyByTicker = async (req, res, next) => {
    try {
        const { ticker } = req.params;

        if (!isValidTicker(ticker)) {
            return res.status(400).json({ message: "A valid ticker is required." });
        }

        const company = await companyService.getCompanyDetails(ticker);

        if (!company) {
            return res.status(404).json({ message: "Company not found." });
        }

        return res.status(200).json({ company });
    } catch (error) {
        return next(error);
    }
};

const importCompany = async (req, res, next) => {
    try {
        const { ticker } = req.params;

        if (!isValidTicker(ticker)) {
            return res.status(400).json({ message: "A valid ticker is required." });
        }

        const company = await companyService.importCompany(ticker);

        if (!company) {
            return res.status(404).json({ message: "Company not found in Yahoo Finance." });
        }

        return res.status(200).json({ company });
    } catch (error) {
        return next(error);
    }
};

const resolveCompanyTicker = async (req, res, next) => {
    try {
        const query = typeof req.query.q === "string" ? req.query.q : "";

        if (!query.trim()) {
            return res.status(400).json({ message: "A company name or ticker is required." });
        }

        const ticker = await companyService.resolveTicker(query);

        if (!ticker) {
            return res.status(404).json({ message: "Company name or ticker could not be resolved." });
        }

        return res.status(200).json({ ticker });
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    searchCompanies,
    getCompanyByTicker,
    importCompany,
    resolveCompanyTicker,
};
