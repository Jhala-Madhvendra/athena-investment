const mongoose = require("mongoose");

/**
 * The last set of tracked-metric values a *specific user* was shown for a
 * *specific ticker* - the baseline that "what changed since I last looked"
 * insights are compared against. Deliberately scoped per (userId, ticker),
 * not shared globally per ticker - see WatchlistArchitecture.md for why a
 * shared/global snapshot would silently hide changes from other users.
 */
const watchlistSnapshotSchema = new mongoose.Schema(
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
        metrics: {
            stockPrice: { type: Number, default: null },
            healthScore: { type: Number, default: null },
            peRatio: { type: Number, default: null },
            revenueCAGR: { type: Number, default: null },
            dcfValuationGapPercent: { type: Number, default: null },
        },
        observedAt: {
            type: Date,
            required: true,
            default: Date.now,
        },
    },
    { timestamps: true }
);

watchlistSnapshotSchema.index({ userId: 1, ticker: 1 }, { unique: true });

module.exports = mongoose.model("WatchlistSnapshot", watchlistSnapshotSchema);
