const express = require("express");
const aiController = require("./ai.controller");
const { expensiveLimiter } = require("../middleware/rateLimit");

const router = express.Router();

router.get("/:ticker/research-report", aiController.getResearchReport);
router.post("/:ticker/research-report", expensiveLimiter, aiController.generateResearchReport);

module.exports = router;
