const express = require("express");
const financialsController = require("./financials.controller");

const router = express.Router();

router.post("/import/:ticker", financialsController.importFinancialStatements);
router.get("/:ticker/:year", financialsController.getFinancialStatementByYear);
router.get("/:ticker", financialsController.getFinancialStatementsByTicker);

module.exports = router;
