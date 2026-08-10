const express = require("express");
const financialsController = require("./financials.controller");
const { expensiveLimiter } = require("../middleware/rateLimit");

const router = express.Router();

router.post("/import/:ticker", expensiveLimiter, financialsController.importFinancialStatements);
router.get("/:ticker/:year", financialsController.getFinancialStatementByYear);
router.get("/:ticker", financialsController.getFinancialStatementsByTicker);

module.exports = router;
