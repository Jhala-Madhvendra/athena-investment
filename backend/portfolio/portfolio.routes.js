const express = require("express");
const portfolioController = require("./portfolio.controller");
const { requireIdentity } = require("../identity/identity.middleware");
const { expensiveLimiter } = require("../middleware/rateLimit");

const router = express.Router();

router.use(requireIdentity);

router.get("/summary", expensiveLimiter, portfolioController.getSummary);
router.get("/", expensiveLimiter, portfolioController.getPortfolio);
router.post("/holdings", portfolioController.addHolding);
router.put("/holdings/:id", portfolioController.updateHolding);
router.delete("/holdings/:id", portfolioController.deleteHolding);
router.get("/holdings/history", portfolioController.getHoldingsHistory);
router.get("/holdings", portfolioController.getHoldingsAt);

module.exports = router;
