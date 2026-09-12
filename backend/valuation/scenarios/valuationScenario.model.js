const mongoose = require("mongoose");

/**
 * A user-named, saved DCF assumption set for one ticker. `assumptions` is
 * stored as Mixed rather than declared field-by-field, because the full DCF
 * assumption contract already lives in one place - dcf.engine.js (via
 * calculateDCFValuation) - not in valuation.validator.js's
 * validateDCFRequestBody, which only owns the WACC/CAPM subset. Re-declaring
 * the full field list here would create a second, driftable copy of that
 * contract instead of reusing it.
 *
 * `priceAtSave`/`impliedValuePerShareAtSave` are captured once, at save
 * time, from the same dry-run DCF calculation already required to validate
 * the assumptions (see valuationScenario.service.js's saveScenario) - not
 * an extra calculation, and never recomputed retroactively. Both are what
 * make backtesting meaningful later: without them, a backtest could only
 * report "price moved X%," not "the market moved toward or away from what
 * this assumption set implied the company was worth."
 */
const valuationScenarioSchema = new mongoose.Schema(
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
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
        },
        assumptions: {
            type: mongoose.Schema.Types.Mixed,
            required: true,
        },
        priceAtSave: {
            type: Number,
            default: null,
        },
        impliedValuePerShareAtSave: {
            type: Number,
            default: null,
        },
    },
    { timestamps: true }
);

valuationScenarioSchema.index({ userId: 1, ticker: 1, createdAt: -1 });

module.exports = mongoose.model("ValuationScenario", valuationScenarioSchema);
