const express = require("express");
const industryController = require("./industry.controller");
const { expensiveLimiter } = require("../middleware/rateLimit");

const router = express.Router();

// Benchmarking a whole reference universe fans out to several
// financial-statement + market-quote lookups per request (bounded by
// industry.peerDiscovery's MAX_UNIVERSE_SIZE), same cost profile as
// Comps/DCF - so these share the same tighter rate limit.
router.get("/:ticker/peers", expensiveLimiter, industryController.getIndustryPeers);
router.get("/:ticker/metrics", industryController.getIndustryMetrics);
router.get("/:ticker", expensiveLimiter, industryController.getIndustry);

module.exports = router;
