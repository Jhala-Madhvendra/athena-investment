const companyService = require("../services/company.service");
const industryService = require("./industry.service");
const { formatIndustryResponse, formatPeersResponse, formatMetricsResponse } = require("./industry.formatter");
const { validatePeersLimit } = require("./industry.validator");
const { sendServiceError, resolveTickerParam: resolveTickerParamShared } = require("../utils/httpErrors");

const resolveTickerParam = (query) => resolveTickerParamShared(query, companyService);

/** GET /api/industry/:ticker */
const getIndustry = async (req, res) => {
    const { ticker } = req.params;

    try {
        const resolvedTicker = await resolveTickerParam(ticker);
        const result = await industryService.getIndustryIntelligence(resolvedTicker);

        return res.status(200).json(formatIndustryResponse(result));
    } catch (error) {
        return sendServiceError(res, error, 502);
    }
};

/** GET /api/industry/:ticker/peers */
const getIndustryPeers = async (req, res) => {
    const { ticker } = req.params;
    const { limit } = req.query;

    const limitValidation = validatePeersLimit(limit);
    if (!limitValidation.isValid) {
        return res.status(422).json({ message: "Invalid request.", errors: limitValidation.errors });
    }

    try {
        const resolvedTicker = await resolveTickerParam(ticker);
        const result = await industryService.getPeerSuggestions(resolvedTicker, limitValidation.limit);

        return res.status(200).json(formatPeersResponse(result));
    } catch (error) {
        return sendServiceError(res, error, 502);
    }
};

/** GET /api/industry/:ticker/metrics */
const getIndustryMetrics = async (req, res) => {
    const { ticker } = req.params;

    try {
        const resolvedTicker = await resolveTickerParam(ticker);
        const result = await industryService.getSupportedMetrics(resolvedTicker);

        return res.status(200).json(formatMetricsResponse(result));
    } catch (error) {
        return sendServiceError(res, error, 502);
    }
};

module.exports = { getIndustry, getIndustryPeers, getIndustryMetrics };
