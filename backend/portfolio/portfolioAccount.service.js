/**
 * Portfolio Account Service
 *
 * Owns the named-account grouping layer described in the bookkeeping-depth
 * plan's "Scope decision" section: Holding/Transaction/Dividend each carry
 * an OPTIONAL portfolioId. Every user implicitly has one `isDefault`
 * account ("My Portfolio"), created lazily rather than at signup.
 * ensureLegacyDataAssigned backfills any Holding/Transaction/Dividend rows
 * that predate this sprint (or were written before a user ever created a
 * second account) onto that default account, so a portfolioId-scoped read
 * never silently drops pre-existing data.
 */

const Holding = require("./holding.model");
const Transaction = require("./transaction.model");
const Dividend = require("./dividend.model");
const PortfolioAccount = require("./portfolioAccount.model");
const { validateAccountName } = require("./portfolioAccount.validator");

const DEFAULT_ACCOUNT_NAME = "My Portfolio";

class PortfolioAccountNotFoundError extends Error {
    constructor() {
        super("Portfolio account not found.");
        this.name = "PortfolioAccountNotFoundError";
        this.statusCode = 404;
    }
}

class PortfolioAccountValidationError extends Error {
    constructor(errors) {
        super("Portfolio account validation failed.");
        this.name = "PortfolioAccountValidationError";
        this.statusCode = 422;
        this.errors = errors;
    }
}

/** Finds the user's default account, creating one if this is their first-ever access. Never creates a second default. */
const getOrCreateDefaultAccount = async (userId) => {
    const existing = await PortfolioAccount.findOne({ userId, isDefault: true });
    if (existing) {
        return existing;
    }

    return PortfolioAccount.create({ userId, name: DEFAULT_ACCOUNT_NAME, isDefault: true });
};

/**
 * Idempotent lazy migration - a cheap no-op once every legacy row has been
 * assigned. Called at the top of every read/write path that's
 * portfolioId-aware, so pre-sprint data is never orphaned from view.
 */
const ensureLegacyDataAssigned = async (userId) => {
    const hasUnassigned = await Promise.all([
        Holding.exists({ userId, portfolioId: null }),
        Transaction.exists({ userId, portfolioId: null }),
        Dividend.exists({ userId, portfolioId: null }),
    ]);

    if (!hasUnassigned.some(Boolean)) {
        return;
    }

    const defaultAccount = await getOrCreateDefaultAccount(userId);

    await Promise.all([
        Holding.updateMany({ userId, portfolioId: null }, { portfolioId: defaultAccount._id }),
        Transaction.updateMany({ userId, portfolioId: null }, { portfolioId: defaultAccount._id }),
        Dividend.updateMany({ userId, portfolioId: null }, { portfolioId: defaultAccount._id }),
    ]);
};

/**
 * Resolves the portfolioId a write should be stamped with: verifies
 * ownership of an explicitly-given id, or falls back to the user's default
 * account when omitted - a write always needs one concrete home, even
 * though reads are free to aggregate across every account (see
 * portfolio.service.js/transaction.service.js/dividend.service.js).
 */
const resolveWritablePortfolioId = async (userId, portfolioId) => {
    if (!portfolioId) {
        const defaultAccount = await getOrCreateDefaultAccount(userId);
        return defaultAccount._id;
    }

    const account = await PortfolioAccount.findOne({ _id: portfolioId, userId });
    if (!account) {
        throw new PortfolioAccountNotFoundError();
    }

    return account._id;
};

/**
 * Guarantees the response is never empty: a brand-new user (no legacy data
 * to backfill either) would otherwise get `[]` back, which leaves the
 * frontend's account switcher with no id to report and the Portfolio page
 * waiting on a portfolioId that never arrives.
 */
const listAccounts = async (userId) => {
    await ensureLegacyDataAssigned(userId);
    const accounts = await PortfolioAccount.find({ userId }).sort({ createdAt: 1 }).lean();
    if (accounts.length > 0) {
        return accounts;
    }

    await getOrCreateDefaultAccount(userId);
    return PortfolioAccount.find({ userId }).sort({ createdAt: 1 }).lean();
};

const createAccount = async (userId, { name }) => {
    const validation = validateAccountName({ name });
    if (!validation.isValid) {
        throw new PortfolioAccountValidationError(validation.errors);
    }

    return PortfolioAccount.create({ userId, ...validation.normalized });
};

const renameAccount = async (userId, id, { name }) => {
    const validation = validateAccountName({ name });
    if (!validation.isValid) {
        throw new PortfolioAccountValidationError(validation.errors);
    }

    const account = await PortfolioAccount.findOneAndUpdate({ _id: id, userId }, validation.normalized, { new: true });

    if (!account) {
        throw new PortfolioAccountNotFoundError();
    }

    return account;
};

const deleteAccount = async (userId, id) => {
    const account = await PortfolioAccount.findOne({ _id: id, userId });
    if (!account) {
        throw new PortfolioAccountNotFoundError();
    }

    if (account.isDefault) {
        throw new PortfolioAccountValidationError(["The default account cannot be deleted."]);
    }

    const accountCount = await PortfolioAccount.countDocuments({ userId });
    if (accountCount <= 1) {
        throw new PortfolioAccountValidationError(["Cannot delete your only portfolio account."]);
    }

    const [holdingCount, transactionCount, dividendCount] = await Promise.all([
        Holding.countDocuments({ userId, portfolioId: id }),
        Transaction.countDocuments({ userId, portfolioId: id }),
        Dividend.countDocuments({ userId, portfolioId: id }),
    ]);

    if (holdingCount + transactionCount + dividendCount > 0) {
        throw new PortfolioAccountValidationError([
            "This account still has holdings, transactions, or dividends recorded against it. Move or delete them first.",
        ]);
    }

    await PortfolioAccount.deleteOne({ _id: id, userId });
    return account;
};

module.exports = {
    getOrCreateDefaultAccount,
    ensureLegacyDataAssigned,
    resolveWritablePortfolioId,
    listAccounts,
    createAccount,
    renameAccount,
    deleteAccount,
    PortfolioAccountNotFoundError,
    PortfolioAccountValidationError,
};
