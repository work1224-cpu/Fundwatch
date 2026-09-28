const router = require("express").Router();
const authenticate = require("../middlewares/auth");
const controller = require("../controllers/compareHistoryController");

// Personal, per-user data — like watchlist, any logged-in role can save/view/delete their own.
router.post("/", authenticate, controller.save);
router.get("/", authenticate, controller.list);
router.get("/:id", authenticate, controller.get);
router.get("/:id/report", authenticate, controller.report);
router.delete("/:id", authenticate, controller.remove);

module.exports = router;