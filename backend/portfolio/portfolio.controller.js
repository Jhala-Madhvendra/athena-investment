const mongoose = require("mongoose");
const portfolioService = require("./portfolio.service");
const companyService = require("../services/company.service");
const { resolveTickerParam, sendServiceError } = require("../utils/httpErrors");

const isValidObjectId = (id) => typeof id === "string" && mongoose.Types.ObjectId.isValid(id);

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

module.exports = { getPortfolio, getSummary, addHolding, updateHolding, deleteHolding };
