/**
 * Transaction Service
 *
 * Owns Transaction CRUD. Every write (create, edit, delete) re-validates
 * the *entire* affected ticker's chronological timeline via
 * holdingsReconstruction.calculator's findFirstNegativeHolding - not just
 * "is this one SELL covered right now" - because editing or deleting a
 * transaction can invalidate a later one even if the transaction being
 * touched looks fine in isolation (Sprint 15 brief section 15). Scoped by
 * {_id, userId} together, same ownership pattern as portfolio.service.js -
 * a wrong-owner id matches nothing and surfaces as 404, never 403, so a
 * non-owner never learns whether the id exists at all.
 */

const mongoose = require("mongoose");
const Transaction = require("./transaction.model");
const marketService = require("../market/market.service");
const { validateTransactionInput } = require("./transaction.validator");
const reconstructionCalculator = require("./holdingsReconstruction.calculator");
const portfolioAccountService = require("./portfolioAccount.service");

class TransactionNotFoundError extends Error {
    constructor() {
        super("Transaction not found.");
        this.name = "TransactionNotFoundError";
        this.statusCode = 404;
    }
}

class TransactionValidationError extends Error {
    constructor(errors) {
        super("Transaction validation failed.");
        this.name = "TransactionValidationError";
        this.statusCode = 422;
        this.errors = errors;
    }
}

class InsufficientHoldingsError extends Error {
    constructor(violation) {
        const asOfDate = new Date(violation.transaction.transactionDate).toISOString().slice(0, 10);
        super(
            `This change would leave ${violation.ticker} at ${violation.quantity} shares on ${asOfDate}, which is negative. ` +
                "A SELL cannot exceed the quantity held immediately before it, and Athena does not allow negative holdings."
        );
        this.name = "InsufficientHoldingsError";
        this.statusCode = 422;
        this.ticker = violation.ticker;
        this.asOfDate = asOfDate;
    }
}

/** Throws InsufficientHoldingsError if replaying `candidateTimeline` (already sorted/unsorted, any order) ever drives a ticker negative. */
const assertNoNegativeHoldings = (candidateTimeline) => {
    const violation = reconstructionCalculator.findFirstNegativeHolding(candidateTimeline);
    if (violation) {
        throw new InsufficientHoldingsError(violation);
    }
};

const addTransaction = async (userId, { ticker, type, quantity, price, transactionDate, portfolioId }) => {
    const validation = validateTransactionInput({ type, quantity, price, transactionDate });
    if (!validation.isValid) {
        throw new TransactionValidationError(validation.errors);
    }

    const resolvedPortfolioId = await portfolioAccountService.resolveWritablePortfolioId(userId, portfolioId);

    // Siblings are scoped to the SAME account - "can't sell more than you
    // held" is an account-level invariant, so a SELL in one account is never
    // constrained by BUYs sitting in a different account.
    const siblings = await Transaction.find({ userId, ticker, portfolioId: resolvedPortfolioId }).lean();

    // Pre-generate the id so the pre-write replay check and the actual
    // saved document agree on the same tie-break ordering.
    const _id = new mongoose.Types.ObjectId();
    const candidate = { _id, ticker, createdAt: new Date(), ...validation.normalized };
    assertNoNegativeHoldings([...siblings, candidate]);

    return Transaction.create({ _id, userId, ticker, portfolioId: resolvedPortfolioId, ...validation.normalized });
};

const updateTransaction = async (userId, transactionId, { type, quantity, price, transactionDate }) => {
    const validation = validateTransactionInput({ type, quantity, price, transactionDate });
    if (!validation.isValid) {
        throw new TransactionValidationError(validation.errors);
    }

    const existing = await Transaction.findOne({ _id: transactionId, userId }).lean();
    if (!existing) {
        throw new TransactionNotFoundError();
    }

    // Ticker and account are both immutable on edit (same reasoning as
    // Holding) - moving a transaction to a different ticker or account is a
    // bigger operation (re-validating two separate timelines) than "fix the
    // quantity/price/date I mistyped."
    const siblings = await Transaction.find({
        userId,
        ticker: existing.ticker,
        portfolioId: existing.portfolioId,
        _id: { $ne: transactionId },
    }).lean();
    const candidate = { ...existing, ...validation.normalized };
    assertNoNegativeHoldings([...siblings, candidate]);

    const transaction = await Transaction.findOneAndUpdate({ _id: transactionId, userId }, validation.normalized, { new: true });

    if (!transaction) {
        throw new TransactionNotFoundError();
    }

    return transaction;
};

const deleteTransaction = async (userId, transactionId) => {
    const existing = await Transaction.findOne({ _id: transactionId, userId }).lean();
    if (!existing) {
        throw new TransactionNotFoundError();
    }

    const siblings = await Transaction.find({
        userId,
        ticker: existing.ticker,
        portfolioId: existing.portfolioId,
        _id: { $ne: transactionId },
    }).lean();
    assertNoNegativeHoldings(siblings);

    const transaction = await Transaction.findOneAndDelete({ _id: transactionId, userId });

    if (!transaction) {
        throw new TransactionNotFoundError();
    }

    return transaction;
};

const getTransaction = async (userId, transactionId) => {
    const transaction = await Transaction.findOne({ _id: transactionId, userId }).lean();
    if (!transaction) {
        throw new TransactionNotFoundError();
    }
    return transaction;
};

/**
 * One live currency lookup per unique ticker (not per transaction) - same
 * dedup shape as portfolio.service.js's fetchQuotesByTicker. A ledger mixing
 * e.g. US and Indian-listed tickers needs each row labeled with its own
 * trading currency, or the price/total columns are silently mislabeled
 * (a ₹2,315 TCS.BO fill displayed as if it were $2,315).
 */
const fetchCurrenciesByTicker = async (tickers) => {
    const uniqueTickers = [...new Set(tickers)];
    const entries = await Promise.all(
        uniqueTickers.map(async (ticker) => {
            const quote = await marketService.getCurrentMarketData(ticker).catch(() => null);
            return [ticker, quote?.currency ?? null];
        })
    );
    return new Map(entries);
};

const getTransactions = async (userId, { ticker, portfolioId } = {}) => {
    await portfolioAccountService.ensureLegacyDataAssigned(userId);

    const filter = { userId };
    if (ticker) filter.ticker = ticker;
    if (portfolioId) filter.portfolioId = portfolioId;

    const transactions = await Transaction.find(filter).sort({ transactionDate: 1, createdAt: 1 }).lean();

    if (transactions.length === 0) return transactions;

    const currenciesByTicker = await fetchCurrenciesByTicker(transactions.map((t) => t.ticker));
    return transactions.map((t) => ({ ...t, currency: currenciesByTicker.get(t.ticker) ?? null }));
};

module.exports = {
    addTransaction,
    updateTransaction,
    deleteTransaction,
    getTransaction,
    getTransactions,
    TransactionNotFoundError,
    TransactionValidationError,
    InsufficientHoldingsError,
};
