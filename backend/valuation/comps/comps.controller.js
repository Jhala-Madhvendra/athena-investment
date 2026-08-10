const companyService = require("../../services/company.service");
const compsService = require("./comps.service");
const peerSelector = require("./comps.peerSelector");
const { sendServiceError, resolveTickerParam: resolveTickerParamShared } = require("../../utils/httpErrors");

const resolveTickerParam = (query) => resolveTickerParamShared(query, companyService);

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
