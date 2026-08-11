/**
 * AiResearchReport Model
 *
 * Persists the latest AI-generated research report per ticker - a
 * deliberate departure from the DCF/Comps precedent of never persisting
 * derived analysis (see research/product/DCFProductDesign.md). LLM calls
 * are slow and cost money, unlike local math, so "Generate Research
 * Report" reuses the stored report until the user explicitly clicks
 * Regenerate (see research/product/AIResearchAnalystProductDesign.md).
 *
 * `contextVersion` (env.aiPromptVersion) doubles as a cache key: bumping
 * it after a context/prompt/schema change makes every existing stored
 * report look "not found" for the new version, forcing exactly one fresh
 * regeneration per ticker instead of silently serving a report shaped by
 * an old schema.
 */

const mongoose = require("mongoose");

const aiResearchReportSchema = new mongoose.Schema(
    {
        ticker: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
            match: /^[A-Z0-9.-]+$/,
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
        report: {
            type: mongoose.Schema.Types.Mixed,
            required: true,
        },
        // Kept alongside the report so the frontend can render "Based on:
        // ROE, Revenue CAGR" chips without a separate citation engine.
        sectionEvidence: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        // The exact context sent to the LLM, retained for auditability -
        // "why did the AI say this" is always answerable from stored data.
        contextSnapshot: {
            type: mongoose.Schema.Types.Mixed,
            required: true,
        },
        dataFreshness: {
            marketDataAsOf: { type: Date, default: null },
            financialDataPeriod: {
                startYear: { type: Number, default: null },
                endYear: { type: Number, default: null },
            },
            dcfCalculatedAt: { type: Date, default: null },
        },
        generatedAt: {
            type: Date,
            required: true,
            default: Date.now,
        },
    },
    { timestamps: true }
);

aiResearchReportSchema.index({ ticker: 1, contextVersion: 1 }, { unique: true });

module.exports = mongoose.model("AiResearchReport", aiResearchReportSchema);
