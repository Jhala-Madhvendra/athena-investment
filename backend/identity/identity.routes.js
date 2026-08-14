const express = require("express");
const identityController = require("./identity.controller");

const router = express.Router();

router.post("/", identityController.createIdentity);

module.exports = router;
