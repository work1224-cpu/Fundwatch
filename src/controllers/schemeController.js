const { Scheme, Category, AMC, FundManager, Benchmark, SchemeReturn, RiskMeasure,
  MarketCapAllocation, SectorAllocation, SchemeSnapshot, SchemeSipReturn } = require("../models");
const { Op } = require("sequelize");
const asyncHandler = require("../utils/asyncHandler");
const logActivity = require("../utils/activityLogger");
const { buildSchemeReport } = require("../services/schemeReportService");

const FULL_INCLUDE = [
  Category, AMC, FundManager, Benchmark,
  { model: SchemeReturn, as: "returns" },
  { model: SchemeSipReturn, as: "sipReturns" },
  { model: RiskMeasure, as: "riskMeasures" },
  { model: MarketCapAllocation, as: "marketCapAllocations" },
  { model: SectorAllocation, as: "sectorAllocations", separate: true, order: [["rank", "ASC"]] },
];

exports.get = asyncHandler(async (req, res) => {
  const scheme = await Scheme.findByPk(req.params.id, { include: FULL_INCLUDE });
  if (!scheme) return res.status(404).json({ message: "Scheme not found" });
  res.json(scheme);
});

// Master "All Schemes" list, spanning every category in one call — powers the Excel Viewer's
// All Schemes view. Search/AMC/Category/Plan/Option all run as SQL conditions (Plan and Option
// are just substrings of the scheme name, e.g. "Direct Plan - Growth"), so the common case is
// paginated entirely in the database. Only Industry (a sector name, stored on a related table)
// needs a JS-level filter — that path fetches every SQL-level match once, then filters and
// paginates in memory.
exports.list = asyncHandler(async (req, res) => {
  const {
    search, amcId, categoryId, group, industry, plan, option,
    stdDevRange, betaRange, sharpeRange, jensenRange,
    largeCapRange, midCapRange, smallCapRange, cashRange,
    page = 1, pageSize = 50, sortBy = "name", sortDir = "ASC",
  } = req.query;

  const nameConditions = [];
  if (search) nameConditions.push({ [Op.like]: `%${search}%` });
  if (plan) nameConditions.push({ [Op.like]: `%${plan}%` });
  if (option) nameConditions.push({ [Op.like]: `%${option}%` });

  const where = {};
  if (nameConditions.length) where.name = { [Op.and]: nameConditions };
  if (amcId) where.amcId = amcId;
  if (categoryId) where.categoryId = categoryId;

  const include = [
    group ? { model: Category, where: { group } } : Category,
    AMC, FundManager, Benchmark,
    { model: SchemeReturn, as: "returns", separate: true },
    { model: SchemeSipReturn, as: "sipReturns", separate: true },
    { model: RiskMeasure, as: "riskMeasures", separate: true },
    { model: MarketCapAllocation, as: "marketCapAllocations", separate: true },
    { model: SectorAllocation, as: "sectorAllocations", separate: true, order: [["rank", "ASC"]] },
  ];

  const p = Math.max(parseInt(page) || 1, 1);
  const ps = Math.max(parseInt(pageSize) || 50, 1);
  const order = [[sortBy, sortDir.toUpperCase() === "DESC" ? "DESC" : "ASC"]];

  // "min,max" (e.g. "25,50"); an empty side means unbounded (",5" is "under 5", "20," is "20+").
  // Comma (not dash) on purpose — Sharpe/Jensen can be negative, which would collide with "-".
  const parseRange = (str) => {
    if (!str) return null;
    const [lo, hi] = str.split(",");
    return { min: lo === "" || lo === undefined ? -Infinity : Number(lo), max: hi === "" || hi === undefined ? Infinity : Number(hi) };
  };
  const ranges = {
    stdDev: parseRange(stdDevRange), beta: parseRange(betaRange), sharpe: parseRange(sharpeRange), jensen: parseRange(jensenRange),
    large: parseRange(largeCapRange), mid: parseRange(midCapRange), small: parseRange(smallCapRange), cash: parseRange(cashRange),
  };
  const needsSlowPath = industry || Object.values(ranges).some(Boolean);

  if (!needsSlowPath) {
    // Fast path — everything filters, sorts, and paginates in SQL. No sibling hasMany
    // association is joined directly (they're all `separate: true`), so this never inflates
    // row counts and `distinct` isn't needed.
    const { rows, count } = await Scheme.findAndCountAll({ where, include, order, limit: ps, offset: (p - 1) * ps });
    return res.json({ data: rows, total: count, page: p, pageSize: ps });
  }

  // Slow path — Industry and any risk/allocation range needs the related rows to filter on, so
  // pull every SQL-level match once, then filter/paginate in memory.
  let schemes = await Scheme.findAll({ where, include, order });

  if (industry) {
    const needle = industry.toLowerCase();
    schemes = schemes.filter((s) => s.sectorAllocations?.some((x) => x.sectorName?.toLowerCase().includes(needle)));
  }
  const inRange = (value, range) => value != null && value >= range.min && value <= range.max;
  for (const metric of ["stdDev", "beta", "sharpe", "jensen"]) {
    if (ranges[metric]) schemes = schemes.filter((s) => inRange(s.riskMeasures?.find((r) => r.metric === metric)?.value, ranges[metric]));
  }
  for (const capType of ["large", "mid", "small", "cash"]) {
    if (ranges[capType]) schemes = schemes.filter((s) => inRange(s.marketCapAllocations?.find((m) => m.capType === capType)?.percentage, ranges[capType]));
  }

  const total = schemes.length;
  const data = schemes.slice((p - 1) * ps, (p - 1) * ps + ps);
  res.json({ data, total, page: p, pageSize: ps });
});

exports.history = asyncHandler(async (req, res) => {
  const snapshots = await SchemeSnapshot.findAll({
    where: { schemeId: req.params.id }, order: [["snapshotDate", "ASC"]],
  });
  res.json(snapshots);
});

exports.report = asyncHandler(async (req, res) => {
  const result = await buildSchemeReport(req.params.id);
  if (!result) return res.status(404).json({ message: "Scheme not found" });
  const safeName = result.scheme.name.replace(/[^a-z0-9]+/gi, "_").slice(0, 60);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${safeName}.xlsx"`);
  res.send(result.buffer);
});

// Global search across every scheme, used by the top-bar search and Compare picker.
exports.search = asyncHandler(async (req, res) => {
  const { q, limit = 15 } = req.query;
  if (!q || q.trim().length < 2) return res.json([]);
  const results = await Scheme.findAll({
    where: { name: { [Op.like]: `%${q}%` } },
    include: [Category, AMC],
    limit: parseInt(limit),
  });
  res.json(results);
});

exports.compare = asyncHandler(async (req, res) => {
  // No hard cap — compare as many schemes as the user picks (e.g. by loading an entire
  // category). Duplicate ids are ignored.
  const ids = [...new Set((req.query.ids || "").split(",").filter(Boolean))];
  if (!ids.length) return res.json([]);
  const schemes = await Scheme.findAll({ where: { id: ids }, include: FULL_INCLUDE });
  res.json(schemes);
});

exports.update = asyncHandler(async (req, res) => {
  const scheme = await Scheme.findByPk(req.params.id);
  if (!scheme) return res.status(404).json({ message: "Scheme not found" });
  const oldValue = scheme.toJSON();
  await scheme.update(req.body);
  await logActivity({ userId: req.user.id, action: "scheme.update", module: "schemes", recordId: scheme.id, oldValue, newValue: req.body });
  res.json(scheme);
});

exports.remove = asyncHandler(async (req, res) => {
  const scheme = await Scheme.findByPk(req.params.id);
  if (!scheme) return res.status(404).json({ message: "Scheme not found" });
  await logActivity({ userId: req.user.id, action: "scheme.delete", module: "schemes", recordId: scheme.id, oldValue: scheme.toJSON() });
  await scheme.destroy();
  res.status(204).send();
});

exports.bulkDelete = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ message: "ids array required" });
  await Scheme.destroy({ where: { id: ids } });
  await logActivity({ userId: req.user.id, action: "scheme.bulkDelete", module: "schemes", newValue: { ids } });
  res.status(204).send();
});