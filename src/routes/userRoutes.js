const router = require("express").Router();
const authenticate = require("../middlewares/auth");
const can = require("../middlewares/rbac");
const controller = require("../controllers/userController");

router.get("/", authenticate, can("users", "read"), controller.list);
router.post("/", authenticate, can("users", "create"), controller.create);
router.put("/:id", authenticate, can("users", "update"), controller.update);
router.delete("/:id", authenticate, can("users", "delete"), controller.remove);
router.get("/roles/all", authenticate, controller.roles);

module.exports = router;
