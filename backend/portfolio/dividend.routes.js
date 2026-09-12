const express = require("express");
const dividendController = require("./dividend.controller");
const { requireIdentity } = require("../identity/identity.middleware");

const router = express.Router();

router.use(requireIdentity);

router.post("/", dividendController.addDividend);
router.get("/", dividendController.getDividends);
router.put("/:id", dividendController.updateDividend);
router.delete("/:id", dividendController.deleteDividend);

module.exports = router;
