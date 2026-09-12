const express = require("express");
const screenerController = require("./screener.controller");
const { expensiveLimiter, generalLimiter } = require("../middleware/rateLimit");

const router = express.Router();

// Public, same posture as company/valuation routes - no user data involved.
// expensiveLimiter because each request can fan out to up to
// SCREENER_LIMIT_MAX per-company Health Score calculations.
router.get("/", expensiveLimiter, screenerController.runScreener);

// generalLimiter, not expensiveLimiter - just a cached Company.distinct(), no per-company Health Score fan-out.
router.get("/facets", generalLimiter, screenerController.getFacets);

module.exports = router;
