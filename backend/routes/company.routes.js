const express = require("express");
const companyController = require("../controllers/company.controller");
const { expensiveLimiter } = require("../middleware/rateLimit");

const router = express.Router();

router.get("/search", companyController.searchCompanies);
router.get("/resolve", companyController.resolveCompanyTicker);
router.get("/:ticker", companyController.getCompanyByTicker);
router.post("/import/:ticker", expensiveLimiter, companyController.importCompany);

module.exports = router;
