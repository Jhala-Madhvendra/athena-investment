const express = require("express");
const snapshotController = require("./snapshot.controller");
const { requireIdentity } = require("../identity/identity.middleware");

const router = express.Router();

// Public - registered before requireIdentity, so it's the one route in this
// router a recipient with no Athena account can reach. Must stay above the
// router.use(requireIdentity) line below.
router.get("/shared/:token", snapshotController.getShared);

router.use(requireIdentity);

router.post("/", snapshotController.create);
router.get("/", snapshotController.list);
router.delete("/:id", snapshotController.remove);

module.exports = router;
