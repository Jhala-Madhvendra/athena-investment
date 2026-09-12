const mongoose = require("mongoose");

/**
 * A named bucket of Holdings/Transactions/Dividends (e.g. "Taxable",
 * "Retirement") - see the "Scope decision" section of the bookkeeping-depth
 * plan for why this stays a thin grouping label rather than a full
 * per-account analytics surface. Every user gets exactly one `isDefault`
 * account, created lazily on first read (see
 * portfolioAccount.service.js's ensureLegacyDataAssigned) rather than at
 * signup, so identity creation stays unchanged.
 */
const portfolioAccountSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 60,
        },
        isDefault: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

portfolioAccountSchema.index({ userId: 1, createdAt: 1 });

module.exports = mongoose.model("PortfolioAccount", portfolioAccountSchema);
