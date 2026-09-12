const express = require("express");
const scenarioController = require("./valuationScenario.controller");
const { requireIdentity } = require("../../identity/identity.middleware");
const { expensiveLimiter } = require("../../middleware/rateLimit");

const router = express.Router();

router.use(requireIdentity);

// Saving/comparing/backtesting each run a full DCF calculation - expensiveLimiter,
// same as the existing POST /:ticker/dcf. Listing is a plain indexed DB read.
router.post("/:ticker/dcf/saved", expensiveLimiter, scenarioController.saveScenario);
router.get("/:ticker/dcf/saved", scenarioController.listScenarios);
router.delete("/:ticker/dcf/saved/:id", scenarioController.deleteScenario);
router.post("/:ticker/dcf/saved/compare", expensiveLimiter, scenarioController.compareScenarios);
router.get("/:ticker/dcf/saved/:id/backtest", expensiveLimiter, scenarioController.backtestScenario);

module.exports = router;
