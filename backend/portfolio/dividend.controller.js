const mongoose = require("mongoose");
const dividendService = require("./dividend.service");
const companyService = require("../services/company.service");
const { resolveTickerParam, sendServiceError } = require("../utils/httpErrors");

const isValidObjectId = (id) => typeof id === "string" && mongoose.Types.ObjectId.isValid(id);

const addDividend = async (req, res) => {
    try {
        const query = typeof req.body?.ticker === "string" ? req.body.ticker : "";
        const ticker = await resolveTickerParam(query, companyService);

        const dividend = await dividendService.addDividend(req.userId, {
            ticker,
            amountPerShare: req.body?.amountPerShare,
            shares: req.body?.shares,
            payDate: req.body?.payDate,
            reinvested: req.body?.reinvested,
            reinvestmentPrice: req.body?.reinvestmentPrice,
            portfolioId: isValidObjectId(req.body?.portfolioId) ? req.body.portfolioId : undefined,
        });

        return res.status(201).json({ dividend });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const getDividends = async (req, res) => {
    try {
        const ticker = typeof req.query?.ticker === "string" ? req.query.ticker.trim().toUpperCase() : undefined;
        const portfolioId = isValidObjectId(req.query?.portfolioId) ? req.query.portfolioId : undefined;

        const dividends = await dividendService.getDividends(req.userId, { ticker, portfolioId });
        return res.status(200).json({ dividends });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const updateDividend = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: "A valid dividend id is required." });
        }

        const dividend = await dividendService.updateDividend(req.userId, id, {
            amountPerShare: req.body?.amountPerShare,
            shares: req.body?.shares,
            payDate: req.body?.payDate,
            reinvested: req.body?.reinvested,
            reinvestmentPrice: req.body?.reinvestmentPrice,
        });

        return res.status(200).json({ dividend });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const deleteDividend = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: "A valid dividend id is required." });
        }

        await dividendService.deleteDividend(req.userId, id);

        return res.status(200).json({ message: "Dividend removed." });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

module.exports = { addDividend, getDividends, updateDividend, deleteDividend };
