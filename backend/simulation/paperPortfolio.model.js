const mongoose = require("mongoose");

/**
 * One hypothetical position within a what-if portfolio. `assumedPrice` is
 * optional - when omitted, simulation.service.js's getSyntheticPortfolio
 * defaults it to the live market price at analysis time and flags
 * `assumedPriceDefaulted: true` on the enriched position, rather than
 * fabricating a cost basis the user never stated. See
 * simulation.service.js for why this is the only option consistent with
 * Athena's "never fabricate a number" discipline.
 *
 * No dedup-by-ticker constraint, same precedent as holding.model.js -
 * multiple simulated lots of the same ticker are legitimate;
 * portfolio.calculator.js's groupByTicker (reused as-is by this module)
 * nets them downstream.
 */
const paperHoldingSchema = new mongoose.Schema(
    {
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
            min: 0,
        },
        assumedPrice: {
            type: Number,
            min: 0,
            default: null,
        },
    },
    { _id: false }
);

const paperPortfolioSchema = new mongoose.Schema(
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
            maxlength: 100,
        },
        holdings: {
            type: [paperHoldingSchema],
            default: [],
        },
    },
    { timestamps: true }
);

paperPortfolioSchema.index({ userId: 1 });

module.exports = mongoose.model("PaperPortfolio", paperPortfolioSchema);
