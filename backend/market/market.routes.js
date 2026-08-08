const express = require("express");
const marketController = require("./market.controller");

const router = express.Router();

router.get("/:ticker/history", marketController.getHistoricalPrices);
router.get("/:ticker/performance", marketController.getPerformance);
router.get("/:ticker", marketController.getCurrentMarketData);

module.exports = router;
