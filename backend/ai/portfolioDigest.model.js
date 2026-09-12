const mongoose = require("mongoose");

/**
 * Persists the latest AI-generated portfolio digest per user/week - same
 * "cache until a fresh period" discipline as AiResearchReport/
 * EarningsAiSummary. Not gated by aiQuota.service.js's shared quota pool -
 * see portfolioDigest.service.js for why (opt-in + weekly cadence + this
 * model's own unique index already bound the cost by construction).
 */
const portfolioDigestSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        // ISO week, e.g. "2026-W35" - see portfolioDigest.service.js's getIsoWeekKey.
        periodKey: {
            type: String,
            required: true,
        },
        narrative: {
            type: String,
            required: true,
        },
        holdingHighlights: {
            type: [{ ticker: String, note: String }],
            default: [],
        },
        evidenceUsed: {
            type: [String],
            default: [],
        },
        provider: { type: String, required: true, trim: true },
        model: { type: String, required: true, trim: true },
        generatedAt: { type: Date, required: true, default: Date.now },
    },
    { timestamps: true }
);

portfolioDigestSchema.index({ userId: 1, periodKey: 1 }, { unique: true });

module.exports = mongoose.model("PortfolioDigest", portfolioDigestSchema);
