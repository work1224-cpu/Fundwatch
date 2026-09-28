const router = require("express").Router();

router.use("/auth", require("./authRoutes"));
router.use("/categories", require("./categoryRoutes"));
router.use("/schemes", require("./schemeRoutes"));
router.use("/dashboard", require("./dashboardRoutes"));
router.use("/imports", require("./importRoutes"));
router.use("/users", require("./userRoutes"));
router.use("/watchlist", require("./watchlistRoutes"));
router.use("/nfos", require("./nfoRoutes"));
router.use("/compare-history", require("./compareHistoryRoutes"));

module.exports = router;