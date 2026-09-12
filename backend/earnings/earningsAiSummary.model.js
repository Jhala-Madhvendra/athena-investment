const mongoose = require("mongoose");

/**
 * Persists the latest AI-generated earnings narrative per ticker/fiscal
 * period - same "cache until an explicit Regenerate" discipline as
 * ai.model.js's AiResearchReport (see GroundedEarningsExplanation.md).
 *
 * `fiscalYearKey` (the latest period label from getEarningsIntelligence,
 * e.g. "FY2025") doubles as part of the cache key: once a newer fiscal
 * year's financials are imported, the next Generate/Regenerate click
 * naturally misses this cache and produces a fresh summary rather than
 * serving a stale one - the closest honest analogue to "earnings-drop"
 * this app can offer without a scheduler/push pipeline (see the
 * bookkeeping/monetization sprint plan's Context section for why true
 * push-the-moment-it-happens is out of scope).
 *
 * `contextVersion` (env.earningsAiPromptVersion) is kept separate from AI
 * Research Report's own contextVersion so the two features' caches never
 * invalidate each other.
 */
const earningsAiSummarySchema = new mongoose.Schema(
    {
        ticker: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
            match: /^[A-Z0-9.-]+$/,
        },
        fiscalYearKey: {
            type: String,
            required: true,
        },
        contextVersion: {
            type: String,
            required: true,
        },
        provider: {
            type: String,
            required: true,
            trim: true,
        },
        model: {
            type: String,
            required: true,
            trim: true,
        },
        narrative: {
            type: String,
            required: true,
        },
        evidenceUsed: {
            type: [String],
            default: [],
        },
        generatedAt: {
            type: Date,
            required: true,
            default: Date.now,
        },
    },
    { timestamps: true }
);

earningsAiSummarySchema.index({ ticker: 1, fiscalYearKey: 1, contextVersion: 1 }, { unique: true });

module.exports = mongoose.model("EarningsAiSummary", earningsAiSummarySchema);
