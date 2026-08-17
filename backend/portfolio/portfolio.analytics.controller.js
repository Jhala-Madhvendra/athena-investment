const portfolioAnalyticsService = require("./portfolio.analytics.service");
const { validateAnalyticsQuery } = require("./portfolio.analytics.validator");
const { sendServiceError } = require("../utils/httpErrors");

const getAnalytics = async (req, res) => {
    const validation = validateAnalyticsQuery({ window: req.query.window, benchmark: req.query.benchmark });

    if (!validation.isValid) {
        return res.status(400).json({ message: "Invalid analytics query.", errors: validation.errors });
    }

    try {
        const analytics = await portfolioAnalyticsService.getPortfolioAnalytics(req.userId, {
            window: validation.window,
            benchmark: validation.benchmark,
        });
        return res.status(200).json(analytics);
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

module.exports = { getAnalytics };
