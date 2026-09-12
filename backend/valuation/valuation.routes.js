const express = require("express");
const valuationController = require("./valuation.controller");
const compsRoutes = require("./comps/comps.routes");
const valuationScenarioRoutes = require("./scenarios/valuationScenario.routes");
const { expensiveLimiter } = require("../middleware/rateLimit");

const router = express.Router();

router.get("/:ticker/dcf/defaults", valuationController.getDCFDefaults);
router.post("/:ticker/dcf", expensiveLimiter, valuationController.calculateDCF);
router.post("/:ticker/dcf/scenarios", expensiveLimiter, valuationController.calculateScenarios);
router.post("/:ticker/dcf/sensitivity", expensiveLimiter, valuationController.calculateSensitivity);

router.use("/", compsRoutes);
// Saved/compare/backtest endpoints are identity-gated (see valuationScenario.routes.js);
// the public DCF calculation routes above are untouched.
router.use("/", valuationScenarioRoutes);

module.exports = router;
