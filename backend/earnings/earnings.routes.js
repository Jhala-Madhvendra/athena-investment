const express = require("express");
const earningsController = require("./earnings.controller");
const { expensiveLimiter } = require("../middleware/rateLimit");
const { requireIdentity } = require("../identity/identity.middleware");

const router = express.Router();

router.get("/:ticker", earningsController.getEarnings);
router.get("/:ticker/summary", earningsController.getSummary);
router.post("/:ticker/summary", requireIdentity, expensiveLimiter, earningsController.generateSummary);

module.exports = router;
