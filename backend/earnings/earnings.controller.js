const earningsService = require("./earnings.service");
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

module.exports = { getEarnings };
