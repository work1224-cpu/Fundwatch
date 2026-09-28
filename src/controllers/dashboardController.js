const dashboardService = require("../services/dashboardService");
const asyncHandler = require("../utils/asyncHandler");

exports.kpis = asyncHandler(async (req, res) => {
  res.json(await dashboardService.getKPIs());
});

exports.categoryPerformance = asyncHandler(async (req, res) => {
  res.json(await dashboardService.getCategoryPerformance());
});
