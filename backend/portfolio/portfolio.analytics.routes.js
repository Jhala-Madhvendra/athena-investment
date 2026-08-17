const express = require("express");
const portfolioAnalyticsController = require("./portfolio.analytics.controller");
const { requireIdentity } = require("../identity/identity.middleware");
const { expensiveLimiter } = require("../middleware/rateLimit");

const router = express.Router();

router.use(requireIdentity);

router.get("/", expensiveLimiter, portfolioAnalyticsController.getAnalytics);

module.exports = router;
