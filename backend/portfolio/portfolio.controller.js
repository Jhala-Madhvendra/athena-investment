const mongoose = require("mongoose");
const portfolioService = require("./portfolio.service");
const portfolioHistoryService = require("./portfolioHistory.service");
const companyService = require("../services/company.service");
const { resolveTickerParam, sendServiceError } = require("../utils/httpErrors");

const isValidObjectId = (id) => typeof id === "string" && mongoose.Types.ObjectId.isValid(id);
const isValidDateString = (value) => typeof value === "string" && !Number.isNaN(new Date(value).getTime());

const getPortfolio = async (req, res) => {
    try {
        const portfolio = await portfolioService.getPortfolio(req.userId);
        return res.status(200).json(portfolio);
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const getSummary = async (req, res) => {
    try {
        const summary = await portfolioService.getPortfolioSummary(req.userId);
        return res.status(200).json({ summary });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const addHolding = async (req, res) => {
    try {
        const query = typeof req.body?.ticker === "string" ? req.body.ticker : "";
        const ticker = await resolveTickerParam(query, companyService);

        const holding = await portfolioService.addHolding(req.userId, {
            ticker,
            shares: req.body?.shares,
            averagePurchasePrice: req.body?.averagePurchasePrice,
            purchaseDate: req.body?.purchaseDate,
        });

        return res.status(201).json({ holding });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const updateHolding = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: "A valid holding id is required." });
        }

        const holding = await portfolioService.updateHolding(req.userId, id, {
            shares: req.body?.shares,
            averagePurchasePrice: req.body?.averagePurchasePrice,
            purchaseDate: req.body?.purchaseDate,
        });

        return res.status(200).json({ holding });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const deleteHolding = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: "A valid holding id is required." });
        }

        await portfolioService.deleteHolding(req.userId, id);

        return res.status(200).json({ message: "Holding removed." });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

/** GET /api/portfolio/holdings?date=YYYY-MM-DD - reconstructed holdings from the Transaction ledger, not today's Holding rows. Requires ?date - see PortfolioCalculationAssumptions.md for why this doesn't fall back to "current holdings" when the ledger is empty. */
const getHoldingsAt = async (req, res) => {
    try {
        const { date } = req.query;
        if (!isValidDateString(date)) {
            return res.status(400).json({ message: "A valid ?date=YYYY-MM-DD query parameter is required." });
        }

        const result = await portfolioHistoryService.getHoldingsAt(req.userId, date);
        return res.status(200).json(result);
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

/** GET /api/portfolio/holdings/history - the full reconstructed holdings timeline, one interval per composition change. */
const getHoldingsHistory = async (req, res) => {
    try {
        const result = await portfolioHistoryService.getHoldingsTimeline(req.userId);
        return res.status(200).json(result);
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

module.exports = { getPortfolio, getSummary, addHolding, updateHolding, deleteHolding, getHoldingsAt, getHoldingsHistory };
