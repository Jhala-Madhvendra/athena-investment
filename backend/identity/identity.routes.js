const express = require("express");
const identityController = require("./identity.controller");
const { requireIdentity } = require("./identity.middleware");
const { authLimiter } = require("../middleware/rateLimit");

const router = express.Router();

router.post("/", identityController.createIdentity);
router.post("/signup", authLimiter, identityController.signup);
router.post("/login", authLimiter, identityController.login);

router.use(requireIdentity);

router.get("/me", identityController.me);
router.post("/logout", identityController.logout);
router.put("/notification-preferences", identityController.updatePreferences);

module.exports = router;
