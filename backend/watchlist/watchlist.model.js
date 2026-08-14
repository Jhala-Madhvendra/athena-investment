const mongoose = require("mongoose");

const watchlistCompanySchema = new mongoose.Schema(
    {
        ticker: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
            match: /^[A-Z0-9.-]+$/,
        },
        addedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { _id: false }
);

const watchlistSchema = new mongoose.Schema(
    {
        // One watchlist per user (see WatchlistArchitecture.md for why this
        // sprint doesn't build multi-list support even though the field
        // names below leave room for it later).
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },
        name: {
            type: String,
            trim: true,
            default: "My Watchlist",
        },
        companies: {
            type: [watchlistCompanySchema],
            default: [],
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Watchlist", watchlistSchema);
