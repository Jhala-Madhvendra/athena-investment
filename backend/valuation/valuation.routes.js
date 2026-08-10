const express = require("express");
const valuationController = require("./valuation.controller");
const compsRoutes = require("./comps/comps.routes");

const router = express.Router();

router.get("/:ticker/dcf/defaults", valuationController.getDCFDefaults);
router.post("/:ticker/dcf", valuationController.calculateDCF);
router.post("/:ticker/dcf/scenarios", valuationController.calculateScenarios);
router.post("/:ticker/dcf/sensitivity", valuationController.calculateSensitivity);

router.use("/", compsRoutes);

module.exports = router;
