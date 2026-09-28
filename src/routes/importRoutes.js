const router = require("express").Router();
const authenticate = require("../middlewares/auth");
const can = require("../middlewares/rbac");
const upload = require("../middlewares/upload");
const controller = require("../controllers/importController");

router.post("/upload", authenticate, can("uploads", "create"), upload.single("file"), controller.upload);
router.get("/history", authenticate, can("uploads", "read"), controller.history);
router.get("/demo-template", authenticate, controller.demoTemplate);
router.patch("/:uploadId", authenticate, can("uploads", "update"), controller.rename);
router.post("/:uploadId/activate", authenticate, can("uploads", "update"), controller.activate);
router.delete("/:uploadId", authenticate, can("uploads", "delete"), controller.remove);
router.get("/:uploadId/logs", authenticate, can("uploads", "read"), controller.logs);
router.get("/:uploadId/download", authenticate, can("uploads", "read"), controller.download);
router.get("/:uploadId/report", authenticate, can("uploads", "read"), controller.report);
router.get("/:uploadId/grid", authenticate, can("uploads", "read"), controller.grid);
router.put("/:uploadId/grid", authenticate, can("uploads", "update"), controller.saveGrid);

module.exports = router;