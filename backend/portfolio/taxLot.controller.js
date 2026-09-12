const mongoose = require("mongoose");
const taxLotService = require("./taxLot.service");
const { sendServiceError } = require("../utils/httpErrors");

const isValidObjectId = (id) => typeof id === "string" && mongoose.Types.ObjectId.isValid(id);

/** GET /api/portfolio/tax-lots/realized?portfolioId=&ticker=&taxYear= */
const getRealized = async (req, res) => {
    try {
        const portfolioId = isValidObjectId(req.query?.portfolioId) ? req.query.portfolioId : undefined;
        const ticker = typeof req.query?.ticker === "string" ? req.query.ticker.trim().toUpperCase() : undefined;
        const taxYear = req.query?.taxYear ? Number(req.query.taxYear) : undefined;

        const result = await taxLotService.getRealizedGains(req.userId, { portfolioId, ticker, taxYear });
        return res.status(200).json(result);
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

/** GET /api/portfolio/tax-lots/open?portfolioId=&ticker= */
const getOpen = async (req, res) => {
    try {
        const portfolioId = isValidObjectId(req.query?.portfolioId) ? req.query.portfolioId : undefined;
        const ticker = typeof req.query?.ticker === "string" ? req.query.ticker.trim().toUpperCase() : undefined;

        const result = await taxLotService.getOpenLots(req.userId, { portfolioId, ticker });
        return res.status(200).json(result);
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

module.exports = { getRealized, getOpen };
