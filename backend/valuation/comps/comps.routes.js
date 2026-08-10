const express = require("express");
const compsController = require("./comps.controller");
const { expensiveLimiter } = require("../../middleware/rateLimit");

const router = express.Router();

router.get("/:ticker/comps/available-peers", compsController.getAvailablePeers);
router.get("/:ticker/comps/available-peers/live-search", compsController.searchLivePeer);
router.post("/:ticker/comps", expensiveLimiter, compsController.calculateComps);

module.exports = router;
