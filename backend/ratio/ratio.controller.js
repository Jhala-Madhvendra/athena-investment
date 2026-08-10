const ratioService = require("./ratio.service");
const companyService = require("../services/company.service");
const { sendServiceError, resolveTickerParam: resolveTickerParamShared } = require("../utils/httpErrors");

const tickerPattern = /^[A-Za-z0-9.-]+$/;

const isTickerLike = (value) =>
    typeof value === "string" &&
    value.trim().length > 0 &&
    tickerPattern.test(value.trim());

const resolveTickerParam = (query) => resolveTickerParamShared(query, companyService);

const getRatiosByTicker = async (req, res) => {
    const { ticker } = req.params;

    try {
        const resolvedTicker = await resolveTickerParam(ticker);
        const ratios = await ratioService.getRatiosByTicker(resolvedTicker);

        return res.status(200).json(ratios);
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

module.exports = {
    getRatiosByTicker,
};
