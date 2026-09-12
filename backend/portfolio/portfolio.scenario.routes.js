const express = require("express");
const scenarioController = require("./portfolio.scenario.controller");
const savedScenarioController = require("./savedScenario.controller");
const { requireIdentity } = require("../identity/identity.middleware");
const { expensiveLimiter } = require("../middleware/rateLimit");

const router = express.Router();

router.use(requireIdentity);

router.get("/presets", scenarioController.getPresets);
router.post("/run", expensiveLimiter, scenarioController.runScenario);
router.post("/compare", expensiveLimiter, scenarioController.compareScenarios);
router.post("/explain", expensiveLimiter, scenarioController.explainScenario);

router.post("/saved", savedScenarioController.createSavedScenario);
router.get("/saved", savedScenarioController.listSavedScenarios);
router.delete("/saved/:id", savedScenarioController.deleteSavedScenario);

module.exports = router;
