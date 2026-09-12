const mongoose = require("mongoose");

/**
 * One ledger entry (BUY or SELL). Unlike Holding (a mutable current-state
 * lot), a Transaction is an immutable-in-spirit historical event - editing
 * one changes every reconstructed holding after its transactionDate, which
 * is why transaction.service.js re-validates the whole ticker's timeline on
 * every write rather than only checking the single row being touched.
 *
 * Scoped by userId, matching Holding - Athena has no separate Portfolio
 * collection (see PortfolioDataModel.md), so "a portfolio" is still just
 * "one user's own rows." The Transaction ledger is net-new and additive: it
 * does not replace, sync with, or get derived from Holding. A user's current
 * Holding rows and their Transaction history are two independent inputs
 * unless/until they choose to keep both up to date themselves - see
 * PortfolioCalculationAssumptions.md's "Transaction-aware reconstruction"
 * section.
 */
const transactionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        // Optional - same lazily-backfilled pattern as holding.model.js's
        // portfolioId. See portfolioAccount.service.js.
        portfolioId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PortfolioAccount",
            default: null,
        },
        ticker: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
            match: /^[A-Z0-9.-]+$/,
        },
        // Only BUY/SELL today. New types (DIVIDEND, DEPOSIT, SPLIT, ...) are
        // an additive enum change, not a schema redesign - see
        // transaction.validator.js's TRANSACTION_TYPES.
        type: {
            type: String,
            required: true,
            enum: ["BUY", "SELL"],
        },
        // Direction lives in `type`, not sign - quantity is always positive
        // (enforced in transaction.validator.js; schema-level min:0 is a
        // light guard, not the source of truth for ">0").
        quantity: {
            type: Number,
            required: true,
            min: 0,
        },
        // Historical execution price - never replaced with today's market price.
        price: {
            type: Number,
            required: true,
            min: 0,
        },
        transactionDate: {
            type: Date,
            required: true,
        },
    },
    { timestamps: true }
);

// Every reconstruction query fetches one user's full history for one ticker
// (or all tickers) and sorts chronologically - this compound index serves
// both shapes directly.
transactionSchema.index({ userId: 1, ticker: 1, transactionDate: 1 });
transactionSchema.index({ userId: 1, portfolioId: 1 });

module.exports = mongoose.model("Transaction", transactionSchema);
