const mongoose = require("mongoose");

/**
 * A named scenario definition a user wants re-checked against their LIVE
 * portfolio on a schedule ("Scenario Watch") - see
 * research/product/AdvancedScenarioProductDesign.md Section 11, which
 * anticipated this exact feature. `rules`/`benchmark`/`window` are the
 * identical shape portfolio.scenario.validator.js's validateScenarioRequest
 * already normalizes for the stateless /run endpoint - scenarioWatchJob.js
 * re-runs this saved definition through the EXACT SAME portfolio.scenario.
 * service.js's runScenario() used there, so the calculation itself is
 * never duplicated.
 */
const savedScenarioSchema = new mongoose.Schema(
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
        },
        rules: {
            type: [
                {
                    targetType: { type: String, required: true },
                    target: { type: String, default: null },
                    shockPercent: { type: Number, required: true },
                },
            ],
            required: true,
        },
        benchmark: { type: String, default: null },
        window: { type: String, default: "1y" },
        // "Alert me if my live portfolio would now lose at least this much
        // under this scenario" - always negative, see savedScenario.validator's
        // validateAlertThreshold.
        alertThresholdPercent: {
            type: Number,
            required: true,
        },
        lastCheckedAt: { type: Date, default: null },
        lastPercentageChange: { type: Number, default: null },
    },
    { timestamps: true }
);

savedScenarioSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("SavedScenario", savedScenarioSchema);
