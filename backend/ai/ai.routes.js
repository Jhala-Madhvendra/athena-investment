const express = require("express");
const aiController = require("./ai.controller");
const { expensiveLimiter } = require("../middleware/rateLimit");
const { requireIdentity } = require("../identity/identity.middleware");

const router = express.Router();

router.get("/:ticker/research-report", aiController.getResearchReport);
router.get("/usage", requireIdentity, aiController.getUsage);
router.post("/:ticker/research-report", requireIdentity, expensiveLimiter, aiController.generateResearchReport);

module.exports = router;
