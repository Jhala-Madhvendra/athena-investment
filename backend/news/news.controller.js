const newsService = require("./news.service");
const companyService = require("../services/company.service");
const { validateNewsQuery } = require("./news.validator");
const { sendServiceError, resolveTickerParam: resolveTickerParamShared } = require("../utils/httpErrors");

const resolveTickerParam = (query) => resolveTickerParamShared(query, companyService);

/** GET /:ticker - recent normalized news, refreshing from the provider only if the cache is empty/stale. */
const getNews = async (req, res) => {
    const { ticker } = req.params;
    const queryValidation = validateNewsQuery(req.query);

    if (!queryValidation.isValid) {
        return res.status(400).json({ message: "Invalid request.", errors: queryValidation.errors });
    }

    try {
        const resolvedTicker = await resolveTickerParam(ticker);
        const result = await newsService.getNews(resolvedTicker, {
            limit: queryValidation.limit,
            category: queryValidation.category,
            from: queryValidation.from,
            to: queryValidation.to,
        });

        return res.status(200).json(result);
    } catch (error) {
        return sendServiceError(res, error, 502);
    }
};

/** GET /:ticker/categories - category counts for this ticker's stored articles. */
const getCategories = async (req, res) => {
    const { ticker } = req.params;

    try {
        const resolvedTicker = await resolveTickerParam(ticker);
        const result = await newsService.getCategorySummary(resolvedTicker);

        return res.status(200).json(result);
    } catch (error) {
        return sendServiceError(res, error, 502);
    }
};

/** POST /:ticker/refresh - forces a live provider fetch now, ignoring the cache TTL. */
const refreshNews = async (req, res) => {
    const { ticker } = req.params;

    try {
        const resolvedTicker = await resolveTickerParam(ticker);
        const result = await newsService.refreshNews(resolvedTicker);

        return res.status(200).json(result);
    } catch (error) {
        return sendServiceError(res, error, 502);
    }
};

module.exports = { getNews, getCategories, refreshNews };
