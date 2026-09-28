const router = require("express").Router();
const authenticate = require("../middlewares/auth");
const can = require("../middlewares/rbac");
const controller = require("../controllers/schemeController");

router.get("/", authenticate, can("schemes", "read"), controller.list);
router.get("/search", authenticate, can("schemes", "read"), controller.search);
router.get("/compare", authenticate, can("schemes", "read"), controller.compare);
router.get("/:id", authenticate, can("schemes", "read"), controller.get);
router.get("/:id/history", authenticate, can("schemes", "read"), controller.history);
router.get("/:id/report", authenticate, can("schemes", "read"), controller.report);
router.put("/:id", authenticate, can("schemes", "update"), controller.update);
router.delete("/:id", authenticate, can("schemes", "delete"), controller.remove);
router.post("/bulk-delete", authenticate, can("schemes", "delete"), controller.bulkDelete);

module.exports = router;