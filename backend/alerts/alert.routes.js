const express = require("express");
const { requireIdentity } = require("../identity/identity.middleware");
const { expensiveLimiter, monitorLimiter } = require("../middleware/rateLimit");
const controller = require("./alert.controller");

const router = express.Router();

// Anonymous-identity-scoped, same as Watchlist/Portfolio (see identity.middleware.js).
router.use(requireIdentity);

router.get("/unread-count", controller.getUnreadCount);
router.get("/counts", controller.getCountsByTicker);
router.get("/", expensiveLimiter, controller.getAlerts);
router.patch("/:id/read", controller.markAsRead);
router.patch("/:id/dismiss", controller.dismissAlert);
// Iterates every ticker the user tracks across five rule categories - the
// most expensive endpoint in this router, so it gets its own tighter limit.
router.post("/monitor", monitorLimiter, controller.monitor);

module.exports = router;
