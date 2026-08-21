const express = require("express");
const scenarioController = require("./portfolio.scenario.controller");
const { requireIdentity } = require("../identity/identity.middleware");
const { expensiveLimiter } = require("../middleware/rateLimit");

const router = express.Router();

router.use(requireIdentity);

router.get("/presets", scenarioController.getPresets);
router.post("/run", expensiveLimiter, scenarioController.runScenario);
router.post("/compare", expensiveLimiter, scenarioController.compareScenarios);

module.exports = router;
