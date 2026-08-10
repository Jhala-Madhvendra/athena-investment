const companyService = require("../../services/company.service");
const compsService = require("./comps.service");
const peerSelector = require("./comps.peerSelector");

const sendServiceError = (res, error, fallbackStatusCode) => {
    const statusCode = error.statusCode || fallbackStatusCode;

    return res.status(statusCode).json({
        message: error.message,
        ...(error.errors ? { errors: error.errors } : {}),
    });
};

const resolveTickerParam = async (query) => {
    const normalizedQuery = typeof query === "string" ? query.trim() : "";

    if (!normalizedQuery) {
        const error = new Error("A valid ticker or company name is required.");
        error.statusCode = 400;
        throw error;
    }

    const ticker = await companyService.resolveTicker(normalizedQuery);

    if (!ticker) {
        const error = new Error("Company name or ticker could not be resolved.");
        error.statusCode = 404;
        throw error;
    }

    return ticker;
};

/** POST /:ticker/comps */
const calculateComps = async (req, res) => {
    const { ticker } = req.params;
    const { peers, statistic } = req.body || {};

    try {
        const resolvedTicker = await resolveTickerParam(ticker);
        const result = await compsService.calculateComparableCompanyAnalysis(resolvedTicker, peers, statistic);

        if (!result.isValid) {
            return res.status(422).json({
                message: "Comparable Company Analysis failed validation.",
                errors: result.errors,
            });
        }

        return res.status(200).json(result);
    } catch (error) {
        return sendServiceError(res, error, 502);
    }
};

/** GET /:ticker/comps/available-peers */
const getAvailablePeers = async (req, res) => {
    const { ticker } = req.params;
    const { q } = req.query;

    try {
        const resolvedTicker = await resolveTickerParam(ticker);
        const result = await peerSelector.getAvailablePeerCandidates(resolvedTicker, typeof q === "string" ? q : undefined);

        return res.status(200).json(result);
    } catch (error) {
        return sendServiceError(res, error, 502);
    }
};

/** GET /:ticker/comps/available-peers/live-search */
const searchLivePeer = async (req, res) => {
    const { ticker } = req.params;
    const { q } = req.query;

    try {
        const resolvedTicker = await resolveTickerParam(ticker);
        const candidate = await peerSelector.findLivePeerCandidate(resolvedTicker, typeof q === "string" ? q : "");

        if (!candidate) {
            return res.status(404).json({ message: "No company could be found for that search." });
        }

        return res.status(200).json({ candidate, limitation: peerSelector.LIMITATION_NOTICE });
    } catch (error) {
        return sendServiceError(res, error, 502);
    }
};

module.exports = { calculateComps, getAvailablePeers, searchLivePeer };
