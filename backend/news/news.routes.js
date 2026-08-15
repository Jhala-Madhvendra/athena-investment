const express = require("express");
const newsController = require("./news.controller");
const { expensiveLimiter } = require("../middleware/rateLimit");

const router = express.Router();

// GET can trigger a live provider call when the cache is stale/empty, so it
// shares the tighter limiter with POST /refresh, not the general one.
router.get("/:ticker/categories", expensiveLimiter, newsController.getCategories);
router.post("/:ticker/refresh", expensiveLimiter, newsController.refreshNews);
router.get("/:ticker", expensiveLimiter, newsController.getNews);

module.exports = router;
