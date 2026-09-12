const aiService = require("./ai.service");
const aiQuotaService = require("./aiQuota.service");
const companyService = require("../services/company.service");
const { validateReportRequest } = require("./ai.validator");
const { sendServiceError, resolveTickerParam: resolveTickerParamShared } = require("../utils/httpErrors");

const resolveTickerParam = (query) => resolveTickerParamShared(query, companyService);

/** POST /:ticker/research-report - generates (or reuses) the AI equity research report. */
const generateResearchReport = async (req, res) => {
    const { ticker } = req.params;

    const requestValidation = validateReportRequest(req.body);
    if (!requestValidation.isValid) {
        return res.status(400).json({ message: "Invalid request.", errors: requestValidation.errors });
    }

    try {
        const resolvedTicker = await resolveTickerParam(ticker);
        const report = await aiService.getOrGenerateReport(resolvedTicker, {
            regenerate: requestValidation.regenerate,
            preTaxCostOfDebt: requestValidation.preTaxCostOfDebt,
            userId: req.userId,
        });

        return res.status(200).json(report);
    } catch (error) {
        return sendServiceError(res, error, 502);
    }
};

/** GET /usage - the caller's own current-month AI-generation usage, shared across every LLM-cost-bearing feature. */
const getUsage = async (req, res) => {
    try {
        const usage = await aiQuotaService.getUsage(req.userId);
        return res.status(200).json(usage);
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

/** GET /:ticker/research-report - returns the persisted report only, never calls the LLM. */
const getResearchReport = async (req, res) => {
    const { ticker } = req.params;

    try {
        const resolvedTicker = await resolveTickerParam(ticker);
        const report = await aiService.getPersistedReport(resolvedTicker);

        if (!report) {
            return res.status(404).json({ message: `No AI research report has been generated for ${resolvedTicker} yet.` });
        }

        return res.status(200).json(report);
    } catch (error) {
        return sendServiceError(res, error, 502);
    }
};

module.exports = { generateResearchReport, getResearchReport, getUsage };
