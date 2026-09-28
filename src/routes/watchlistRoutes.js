const router = require("express").Router();
const authenticate = require("../middlewares/auth");
const controller = require("../controllers/watchlistController");

router.get("/", authenticate, controller.list);
router.post("/toggle", authenticate, controller.toggle);

module.exports = router;
