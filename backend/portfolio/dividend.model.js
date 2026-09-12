const mongoose = require("mongoose");

/**
 * One recorded dividend payment. User-entered (no provider integration -
 * see FutureDataModel.md's Dividend classification), and deliberately kept
 * isolated from Holding/Transaction: a dividend never adjusts share counts
 * on its own, even when `reinvested` - `sharesAcquired` is informational
 * (feeds the portfolio summary's total-return figure), not a ledger entry.
 * A user who wants reinvested shares reflected in their holdings still
 * records a BUY transaction/Holding lot for them, same as any other
 * purchase.
 */
const dividendSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
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
        amountPerShare: {
            type: Number,
            required: true,
            min: 0,
        },
        shares: {
            type: Number,
            required: true,
            min: 0,
        },
        // amountPerShare * shares, computed once at write time - shares held
        // can change after the fact, so this preserves the historical total.
        totalAmount: {
            type: Number,
            required: true,
            min: 0,
        },
        payDate: {
            type: Date,
            required: true,
        },
        reinvested: {
            type: Boolean,
            default: false,
        },
        reinvestmentPrice: {
            type: Number,
            default: null,
            min: 0,
        },
        sharesAcquired: {
            type: Number,
            default: null,
        },
    },
    { timestamps: true }
);

dividendSchema.index({ userId: 1, portfolioId: 1, ticker: 1, payDate: 1 });

module.exports = mongoose.model("Dividend", dividendSchema);
