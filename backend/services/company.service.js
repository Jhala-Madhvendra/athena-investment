const Company = require("../models/company.model");
const financialDataProvider = require("../providers/financialDataProvider.registry");

const tickerPattern = /^[A-Za-z0-9.-]+$/;
const tickerLookupPattern = /^([A-Za-z0-9]{1,5}|[A-Za-z0-9]{1,10}\.[A-Za-z]{1,5})$/;
const normalizeTicker = (ticker) => ticker.trim().toUpperCase();

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isTickerLike = (query) => typeof query === "string" && tickerLookupPattern.test(query.trim());

const searchCompanies = async (query) => {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
        return [];
    }

    const searchExpression = new RegExp(escapeRegex(normalizedQuery), "i");

    return Company.find({
        $or: [{ name: searchExpression }, { ticker: searchExpression }],
    })
        .select("name ticker exchange")
        .sort({ name: 1 })
        .limit(10)
        .lean();
};

const findCompanyByTicker = async (ticker) => {
    const normalizedTicker = normalizeTicker(ticker);

    return Company.findOne({ ticker: normalizedTicker });
};

const findCompanyByName = async (name) => {
    const normalizedName = name.trim();
    const searchExpression = new RegExp(`^${escapeRegex(normalizedName)}$`, "i");

    return Company.findOne({ name: searchExpression });
};

const isCompanyNotFoundError = (error) => {
    const message = error?.message?.toLowerCase?.() || "";

    return (
        message.includes("could not find") ||
        message.includes("returned no company profile") ||
        message.includes("no company profile") ||
        message.includes("status 404")
    );
};

const saveCompanyProfile = async (companyProfile) =>
    Company.findOneAndUpdate(
        { ticker: companyProfile.ticker },
        companyProfile,
        { returnDocument: "after", upsert: true, runValidators: true }
    );

const importCompany = async (query) => {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
        return null;
    }

    if (isTickerLike(normalizedQuery)) {
        const normalizedTicker = normalizeTicker(normalizedQuery);

        try {
            const companyProfile = await financialDataProvider.getCompanyProfile(normalizedTicker);
            return saveCompanyProfile(companyProfile);
        } catch (error) {
            if (!isCompanyNotFoundError(error)) {
                throw error;
            }
        }
    }

    const resolvedTicker = await financialDataProvider.searchTickerByName(normalizedQuery);

    if (!resolvedTicker) {
        return null;
    }

    const companyProfile = await financialDataProvider.getCompanyProfile(resolvedTicker);
    return saveCompanyProfile(companyProfile);
};

const resolveTicker = async (query) => {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
        return null;
    }

    if (isTickerLike(normalizedQuery)) {
        const normalizedTicker = normalizeTicker(normalizedQuery);
        const existingCompany = await findCompanyByTicker(normalizedTicker);

        if (existingCompany) {
            return existingCompany.ticker;
        }

        try {
            const companyProfile = await financialDataProvider.getCompanyProfile(normalizedTicker);
            const company = await saveCompanyProfile(companyProfile);
            return company.ticker;
        } catch (error) {
            if (!isCompanyNotFoundError(error)) {
                throw error;
            }
        }
    }

    const existingCompany = await findCompanyByName(normalizedQuery);

    if (existingCompany) {
        return existingCompany.ticker;
    }

    const resolvedTicker = await financialDataProvider.searchTickerByName(normalizedQuery);

    if (!resolvedTicker) {
        return null;
    }

    const companyProfile = await financialDataProvider.getCompanyProfile(resolvedTicker);
    const company = await saveCompanyProfile(companyProfile);

    return company.ticker;
};

const getCompanyDetails = async (query) => {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
        return null;
    }

    if (isTickerLike(normalizedQuery)) {
        return findCompanyByTicker(normalizedQuery);
    }

    return findCompanyByName(normalizedQuery);
};

module.exports = {
    searchCompanies,
    getCompanyDetails,
    importCompany,
    resolveTicker,
};
