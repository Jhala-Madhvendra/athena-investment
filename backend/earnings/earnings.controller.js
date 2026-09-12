const earningsService = require("./earnings.service");
const earningsAiService = require("./earnings.aiService");
const companyService = require("../services/company.service");
const { sendServiceError, resolveTickerParam: resolveTickerParamShared } = require("../utils/httpErrors");

const resolveTickerParam = (query) => resolveTickerParamShared(query, companyService);

/** GET /:ticker - deterministic Earnings Intelligence for the ticker's latest reported financial period. */
const getEarnings = async (req, res) => {
    const { ticker } = req.params;

    try {
        const resolvedTicker = await resolveTickerParam(ticker);
        const earnings = await earningsService.getEarningsIntelligence(resolvedTicker);

        return res.status(200).json(earnings);
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

/** GET /:ticker/summary - the persisted AI earnings summary only, never calls the LLM. */
const getSummary = async (req, res) => {
    const { ticker } = req.params;

    try {
        const resolvedTicker = await resolveTickerParam(ticker);
        const summary = await earningsAiService.getPersistedSummary(resolvedTicker);

        return res.status(200).json(summary);
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

/** POST /:ticker/summary - generates (or reuses) the AI earnings summary. Quota-gated - see backend/ai/aiQuota.service.js. */
const generateSummary = async (req, res) => {
    const { ticker } = req.params;
    const regenerate = req.body?.regenerate === true;

    try {
        const resolvedTicker = await resolveTickerParam(ticker);
        const summary = await earningsAiService.getOrGenerateSummary(resolvedTicker, {
            regenerate,
            userId: req.userId,
        });

        return res.status(200).json(summary);
    } catch (error) {
        return sendServiceError(res, error, 502);
    }
};

module.exports = { getEarnings, getSummary, generateSummary };
