const watchlistService = require("./watchlist.service");
const watchlistInsightsService = require("./watchlistInsights.service");
const companyService = require("../services/company.service");
const { resolveTickerParam, sendServiceError } = require("../utils/httpErrors");

const tickerPattern = /^[A-Za-z0-9.-]+$/;

const isValidTicker = (ticker) =>
    typeof ticker === "string" && ticker.trim().length > 0 && tickerPattern.test(ticker.trim());

const getWatchlist = async (req, res) => {
    try {
        const watchlist = await watchlistService.getWatchlistWithMetrics(req.userId);

        return res.status(200).json({ watchlist });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const addToWatchlist = async (req, res) => {
    try {
        const query = typeof req.body?.ticker === "string" ? req.body.ticker : "";
        const ticker = await resolveTickerParam(query, companyService);

        await watchlistService.addCompany(req.userId, ticker);

        return res.status(201).json({ message: `${ticker} added to your watchlist.`, ticker });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const removeFromWatchlist = async (req, res) => {
    try {
        const { ticker } = req.params;

        if (!isValidTicker(ticker)) {
            return res.status(400).json({ message: "A valid ticker is required." });
        }

        await watchlistService.removeCompany(req.userId, ticker);

        return res.status(200).json({ message: `${ticker.trim().toUpperCase()} removed from your watchlist.` });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const getInsights = async (req, res) => {
    try {
        const result = await watchlistInsightsService.getInsights(req.userId);

        return res.status(200).json(result);
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

module.exports = { getWatchlist, addToWatchlist, removeFromWatchlist, getInsights };
