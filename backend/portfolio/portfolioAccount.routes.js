const express = require("express");
const portfolioAccountController = require("./portfolioAccount.controller");
const { requireIdentity } = require("../identity/identity.middleware");

const router = express.Router();

router.use(requireIdentity);

router.get("/", portfolioAccountController.list);
router.post("/", portfolioAccountController.create);
router.put("/:id", portfolioAccountController.rename);
router.delete("/:id", portfolioAccountController.remove);

module.exports = router;
