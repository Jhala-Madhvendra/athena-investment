const mongoose = require("mongoose");

/**
 * The last portfolio-position values a specific user's monitoring pass
 * compared against. Unlike alertSnapshot.model.js, this genuinely is
 * personal - current value, return%, and portfolio weight all depend on
 * that user's own shares and cost basis, not just the ticker - so this
 * mirrors WatchlistSnapshot's per-(userId, ticker) scoping exactly, for the
 * same reason (see research/engineering/UserScopedCaching.md).
 */
const portfolioAlertSnapshotSchema = new mongoose.Schema(
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
        currentValue: { type: Number, default: null },
        returnPercent: { type: Number, default: null },
        weightPercent: { type: Number, default: null },
        observedAt: {
            type: Date,
            required: true,
            default: Date.now,
        },
    },
    { timestamps: true }
);

portfolioAlertSnapshotSchema.index({ userId: 1, ticker: 1 }, { unique: true });

module.exports = mongoose.model("PortfolioAlertSnapshot", portfolioAlertSnapshotSchema);
