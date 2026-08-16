const companyService = require("../services/company.service");
const industryService = require("./industry.service");
const industryDiscovery = require("./industry.discovery");
const {
    formatIndustryResponse,
    formatPeersResponse,
    formatMetricsResponse,
    formatDiscoveryResponse,
    formatImportResponse,
} = require("./industry.formatter");
const { validatePeersLimit, validateDiscoveryImportTickers } = require("./industry.validator");
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

/** GET /api/industry/:ticker/discover - "Find More Companies" candidates from a live external classification search. */
const getIndustryDiscovery = async (req, res) => {
    const { ticker } = req.params;

    try {
        const resolvedTicker = await resolveTickerParam(ticker);
        const result = await industryDiscovery.discoverCandidates(resolvedTicker);

        return res.status(200).json(formatDiscoveryResponse(result));
    } catch (error) {
        return sendServiceError(res, error, 502);
    }
};

/** POST /api/industry/:ticker/discover/import - imports the user's selected candidates and invalidates the benchmark cache. */
const importIndustryDiscovery = async (req, res) => {
    const { ticker } = req.params;
    const { tickers } = req.body || {};

    const validation = validateDiscoveryImportTickers(tickers);
    if (!validation.isValid) {
        return res.status(422).json({ message: "Invalid request.", errors: validation.errors });
    }

    try {
        // The target ticker itself just needs to resolve for the route to make sense - the import is otherwise ticker-list-driven, not target-specific.
        await resolveTickerParam(ticker);
        const results = await industryDiscovery.importSelectedCompanies(validation.tickers);
        industryService.invalidateUniverseCache();

        return res.status(200).json(formatImportResponse(results));
    } catch (error) {
        return sendServiceError(res, error, 502);
    }
};

module.exports = { getIndustry, getIndustryPeers, getIndustryMetrics, getIndustryDiscovery, importIndustryDiscovery };
