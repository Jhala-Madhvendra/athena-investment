const express = require("express");
const portfolioDigestController = require("./portfolioDigest.controller");
const { requireIdentity } = require("../identity/identity.middleware");

const router = express.Router();

router.use(requireIdentity);

router.get("/", portfolioDigestController.getDigest);

module.exports = router;
