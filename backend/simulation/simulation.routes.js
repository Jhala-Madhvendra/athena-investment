const express = require("express");
const simulationController = require("./simulation.controller");
const { requireIdentity } = require("../identity/identity.middleware");
const { expensiveLimiter } = require("../middleware/rateLimit");

const router = express.Router();

router.use(requireIdentity);

router.post("/portfolios", simulationController.createPortfolio);
router.get("/portfolios", simulationController.listPortfolios);
router.get("/portfolios/:id", expensiveLimiter, simulationController.getPortfolio);
router.put("/portfolios/:id", simulationController.updatePortfolio);
router.delete("/portfolios/:id", simulationController.deletePortfolio);
router.get("/portfolios/:id/analytics", expensiveLimiter, simulationController.getAnalytics);
router.post("/portfolios/:id/scenarios/run", expensiveLimiter, simulationController.runScenario);
router.post("/portfolios/:id/scenarios/compare", expensiveLimiter, simulationController.compareScenarios);

module.exports = router;
