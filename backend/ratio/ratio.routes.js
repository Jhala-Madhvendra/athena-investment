const express = require("express");
const ratioController = require("./ratio.controller");

const router = express.Router();

router.get("/:ticker", ratioController.getRatiosByTicker);

module.exports = router;
