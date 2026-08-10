const express = require("express");
const valuationController = require("./valuation.controller");
const compsRoutes = require("./comps/comps.routes");
const { expensiveLimiter } = require("../middleware/rateLimit");

const router = express.Router();

router.get("/:ticker/dcf/defaults", valuationController.getDCFDefaults);
router.post("/:ticker/dcf", expensiveLimiter, valuationController.calculateDCF);
router.post("/:ticker/dcf/scenarios", expensiveLimiter, valuationController.calculateScenarios);
router.post("/:ticker/dcf/sensitivity", expensiveLimiter, valuationController.calculateSensitivity);

router.use("/", compsRoutes);

module.exports = router;
