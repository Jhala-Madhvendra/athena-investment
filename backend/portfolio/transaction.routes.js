const express = require("express");
const transactionController = require("./transaction.controller");
const { requireIdentity } = require("../identity/identity.middleware");

const router = express.Router();

router.use(requireIdentity);

router.post("/", transactionController.addTransaction);
router.get("/", transactionController.getTransactions);
router.get("/:id", transactionController.getTransaction);
router.put("/:id", transactionController.updateTransaction);
router.delete("/:id", transactionController.deleteTransaction);

module.exports = router;
