const express = require("express");
const watchlistController = require("./watchlist.controller");
const { requireIdentity } = require("../identity/identity.middleware");
const { expensiveLimiter } = require("../middleware/rateLimit");

const router = express.Router();

router.use(requireIdentity);

// GET fans out to market/analysis/valuation per company - tighter limit like other multi-source reads.
router.get("/", expensiveLimiter, watchlistController.getWatchlist);
router.get("/insights", expensiveLimiter, watchlistController.getInsights);
router.post("/", expensiveLimiter, watchlistController.addToWatchlist);
router.delete("/:ticker", watchlistController.removeFromWatchlist);

module.exports = router;
