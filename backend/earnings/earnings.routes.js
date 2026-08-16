const express = require("express");
const earningsController = require("./earnings.controller");

const router = express.Router();

router.get("/:ticker", earningsController.getEarnings);

module.exports = router;
