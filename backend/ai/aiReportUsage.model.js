const mongoose = require("mongoose");

/**
 * One user's AI-generation usage counter for one calendar month. Shared
 * across every LLM-cost-bearing feature (AI Research Reports, Earnings AI
 * Summaries) - see aiQuota.service.js. A fresh document is created lazily
 * the first time a user consumes any quota in a given month; there is no
 * pre-provisioning.
 */
const aiReportUsageSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        // "YYYY-MM", UTC calendar month - see aiQuota.service.js's getPeriodKey.
        periodKey: {
            type: String,
            required: true,
        },
        count: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

aiReportUsageSchema.index({ userId: 1, periodKey: 1 }, { unique: true });

module.exports = mongoose.model("AiReportUsage", aiReportUsageSchema);
