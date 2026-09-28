const { Watchlist, Scheme, Category, AMC } = require("../models");
const asyncHandler = require("../utils/asyncHandler");

exports.list = asyncHandler(async (req, res) => {
  const listType = req.query.type || "watchlist";
  const items = await Watchlist.findAll({
    where: { userId: req.user.id, listType },
    include: [{ model: Scheme, include: [Category, AMC] }],
  });
  res.json(items);
});

exports.toggle = asyncHandler(async (req, res) => {
  const { schemeId, listType = "watchlist" } = req.body;
  const existing = await Watchlist.findOne({ where: { userId: req.user.id, schemeId, listType } });
  if (existing) {
    await existing.destroy();
    return res.json({ active: false });
  }
  await Watchlist.create({ userId: req.user.id, schemeId, listType });
  res.json({ active: true });
});
