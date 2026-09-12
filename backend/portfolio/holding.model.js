const mongoose = require("mongoose");

/**
 * One purchase lot. Deliberately not deduplicated by ticker - buying the
 * same company in multiple lots (dollar-cost averaging) is normal investor
 * behavior, unlike Watchlist where the same ticker twice is a bug, not a
 * feature. See PortfolioDataModel.md.
 */
const holdingSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        // Optional - see portfolioAccount.service.js's ensureLegacyDataAssigned
        // for why this is never required at the schema level (pre-sprint rows
        // are backfilled lazily rather than required to already have one).
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
        shares: {
            type: Number,
            required: true,
        },
        averagePurchasePrice: {
            type: Number,
            required: true,
            min: 0,
        },
        purchaseDate: {
            type: Date,
            required: true,
        },
    },
    { timestamps: true }
);

holdingSchema.index({ userId: 1 });
holdingSchema.index({ userId: 1, portfolioId: 1 });

module.exports = mongoose.model("Holding", holdingSchema);
