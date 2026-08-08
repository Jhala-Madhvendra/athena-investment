const mongoose = require("mongoose");

const marketHistorySchema = new mongoose.Schema(
    {
        companyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
            index: true,
        },
        ticker: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
            match: /^[A-Z0-9.-]+$/,
        },
        date: {
            type: String,
            required: true,
            match: /^\d{4}-\d{2}-\d{2}$/,
        },
        open: Number,
        high: Number,
        low: Number,
        close: {
            type: Number,
            required: true,
        },
        adjClose: Number,
        volume: Number,
        source: {
            type: String,
            required: true,
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

marketHistorySchema.index({ ticker: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("MarketHistory", marketHistorySchema);
