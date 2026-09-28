const router = require("express").Router();
const authenticate = require("../middlewares/auth");
const can = require("../middlewares/rbac");
const controller = require("../controllers/categoryController");

router.get("/", authenticate, can("categories", "read"), controller.list);
// Must come before "/:id" — otherwise Express would match "filter-options" as an :id.
router.get("/filter-options", authenticate, can("categories", "read"), controller.filterOptions);
router.get("/:id", authenticate, can("categories", "read"), controller.get);
router.get("/:id/schemes", authenticate, can("schemes", "read"), controller.schemes);

module.exports = router;