const marketService = require("./market.service");
const companyService = require("../services/company.service");
const { validatePeriod } = require("./validators/market.validator");
const { sendServiceError, resolveTickerParam: resolveTickerParamShared } = require("../utils/httpErrors");

const resolveTickerParam = (query) => resolveTickerParamShared(query, companyService);

const getCurrentMarketData = async (req, res) => {
    const { ticker } = req.params;

    try {
        const resolvedTicker = await resolveTickerParam(ticker);
        const marketData = await marketService.getCurrentMarketData(resolvedTicker);

        return res.status(200).json(marketData);
    } catch (error) {
        return sendServiceError(res, error, 502);
    }
};

const getHistoricalPrices = async (req, res) => {
    const { ticker } = req.params;
    const periodValidation = validatePeriod(req.query.period);

    if (!periodValidation.isValid) {
        return res.status(400).json({ message: periodValidation.error });
    }

    try {
        const resolvedTicker = await resolveTickerParam(ticker);
        const data = await marketService.getHistoricalPrices(resolvedTicker, periodValidation.period);

        return res.status(200).json({ ticker: resolvedTicker, period: periodValidation.period, data });
    } catch (error) {
        return sendServiceError(res, error, 502);
    }
};

const getPerformance = async (req, res) => {
    const { ticker } = req.params;
    const requestedPeriod = req.query.period;

    if (requestedPeriod !== undefined) {
        const periodValidation = validatePeriod(requestedPeriod);
        if (!periodValidation.isValid) {
            return res.status(400).json({ message: periodValidation.error });
        }
    }

    try {
        const resolvedTicker = await resolveTickerParam(ticker);
        const normalizedPeriod = requestedPeriod !== undefined ? requestedPeriod.toLowerCase() : undefined;
        const performance = await marketService.getPerformance(resolvedTicker, normalizedPeriod);

        return res.status(200).json({ ticker: resolvedTicker, performance });
    } catch (error) {
        return sendServiceError(res, error, 502);
    }
};

module.exports = {
    getCurrentMarketData,
    getHistoricalPrices,
    getPerformance,
};
