const ratioService = require("./ratio.service");
const companyService = require("../services/company.service");

const tickerPattern = /^[A-Za-z0-9.-]+$/;

const isTickerLike = (value) =>
    typeof value === "string" &&
    value.trim().length > 0 &&
    tickerPattern.test(value.trim());

const sendServiceError = (res, error, fallbackStatusCode) => {
    const statusCode = error.statusCode || fallbackStatusCode;

    return res.status(statusCode).json({
        message: error.message,
        ...(error.errors ? { errors: error.errors } : {}),
    });
};

const resolveTickerParam = async (query) => {
    const normalizedQuery = typeof query === "string" ? query.trim() : "";

    if (!normalizedQuery) {
        const error = new Error("A valid ticker or company name is required.");
        error.statusCode = 400;
        throw error;
    }

    const ticker = await companyService.resolveTicker(normalizedQuery);

    if (!ticker) {
        const error = new Error("Company name or ticker could not be resolved.");
        error.statusCode = 404;
        throw error;
    }

    return ticker;
};

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
