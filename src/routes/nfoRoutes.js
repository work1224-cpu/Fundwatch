const router = require("express").Router();
const authenticate = require("../middlewares/auth");
const controller = require("../controllers/nfoController");

router.get("/", authenticate, controller.list);
router.get("/sections", authenticate, controller.sections);

module.exports = router;
