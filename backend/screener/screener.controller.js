const screenerService = require("./screener.service");
const { validateScreenerQuery } = require("./screener.validator");
const { sendServiceError } = require("../utils/httpErrors");

const runScreener = async (req, res) => {
    const validation = validateScreenerQuery(req.query);

    if (!validation.isValid) {
        return res.status(400).json({ message: "Invalid screener query.", errors: validation.errors });
    }

    try {
        const result = await screenerService.runScreener(validation.normalized);
        return res.status(200).json(result);
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const getFacets = async (req, res) => {
    try {
        const facets = await screenerService.getFacets();
        return res.status(200).json(facets);
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

module.exports = { runScreener, getFacets };
