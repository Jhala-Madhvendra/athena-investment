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

module.exports = mongoose.model("Holding", holdingSchema);
