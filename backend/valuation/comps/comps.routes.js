const express = require("express");
const compsController = require("./comps.controller");

const router = express.Router();

router.get("/:ticker/comps/available-peers", compsController.getAvailablePeers);
router.get("/:ticker/comps/available-peers/live-search", compsController.searchLivePeer);
router.post("/:ticker/comps", compsController.calculateComps);

module.exports = router;
