const router = require("express").Router();
const authenticate = require("../middlewares/auth");
const controller = require("../controllers/dashboardController");

router.get("/kpis", authenticate, controller.kpis);
router.get("/category-performance", authenticate, controller.categoryPerformance);

module.exports = router;
