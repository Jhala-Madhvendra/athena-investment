/**
 * Dividend Service
 *
 * Owns Dividend CRUD plus the total-income aggregation
 * portfolio.service.js's total-return figure relies on. Deliberately does
 * not touch Holding/Transaction - see dividend.model.js.
 */

const Dividend = require("./dividend.model");
const { validateDividendInput } = require("./dividend.validator");
const portfolioAccountService = require("./portfolioAccount.service");

class DividendNotFoundError extends Error {
    constructor() {
        super("Dividend not found.");
        this.name = "DividendNotFoundError";
        this.statusCode = 404;
    }
}

class DividendValidationError extends Error {
    constructor(errors) {
        super("Dividend validation failed.");
        this.name = "DividendValidationError";
        this.statusCode = 422;
        this.errors = errors;
    }
}

const addDividend = async (userId, { ticker, amountPerShare, shares, payDate, reinvested, reinvestmentPrice, portfolioId }) => {
    const validation = validateDividendInput({ amountPerShare, shares, payDate, reinvested, reinvestmentPrice });
    if (!validation.isValid) {
        throw new DividendValidationError(validation.errors);
    }

    const resolvedPortfolioId = await portfolioAccountService.resolveWritablePortfolioId(userId, portfolioId);

    return Dividend.create({ userId, ticker, portfolioId: resolvedPortfolioId, ...validation.normalized });
};

const updateDividend = async (userId, dividendId, { amountPerShare, shares, payDate, reinvested, reinvestmentPrice }) => {
    const validation = validateDividendInput({ amountPerShare, shares, payDate, reinvested, reinvestmentPrice });
    if (!validation.isValid) {
        throw new DividendValidationError(validation.errors);
    }

    const dividend = await Dividend.findOneAndUpdate({ _id: dividendId, userId }, validation.normalized, { new: true });

    if (!dividend) {
        throw new DividendNotFoundError();
    }

    return dividend;
};

const deleteDividend = async (userId, dividendId) => {
    const dividend = await Dividend.findOneAndDelete({ _id: dividendId, userId });

    if (!dividend) {
        throw new DividendNotFoundError();
    }

    return dividend;
};

const getDividends = async (userId, { ticker, portfolioId } = {}) => {
    await portfolioAccountService.ensureLegacyDataAssigned(userId);

    const filter = { userId };
    if (ticker) filter.ticker = ticker;
    if (portfolioId) filter.portfolioId = portfolioId;

    return Dividend.find(filter).sort({ payDate: -1, createdAt: -1 }).lean();
};

/** Sums totalAmount across the user's dividends - feeds the portfolio summary's dividend-income/total-return figures. */
const getTotalDividendIncome = async (userId, { portfolioId } = {}) => {
    const filter = { userId };
    if (portfolioId) filter.portfolioId = portfolioId;

    const dividends = await Dividend.find(filter).select("totalAmount").lean();
    return dividends.reduce((sum, dividend) => sum + dividend.totalAmount, 0);
};

module.exports = {
    addDividend,
    updateDividend,
    deleteDividend,
    getDividends,
    getTotalDividendIncome,
    DividendNotFoundError,
    DividendValidationError,
};
