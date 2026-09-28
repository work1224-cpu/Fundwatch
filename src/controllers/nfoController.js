const { NFO } = require("../models");
const { Op } = require("sequelize");
const asyncHandler = require("../utils/asyncHandler");

exports.list = asyncHandler(async (req, res) => {
  const { section, search } = req.query;
  const where = {};
  if (section) where.section = section;
  if (search) where.fundName = { [Op.like]: `%${search}%` };

  const rows = await NFO.findAll({ where, order: [["section", "ASC"], ["openDate", "DESC"], ["filingDate", "DESC"]] });
  res.json(rows);
});

exports.sections = asyncHandler(async (req, res) => {
  const rows = await NFO.findAll({ attributes: ["section"], group: ["section"] });
  res.json(rows.map((r) => r.section));
});
