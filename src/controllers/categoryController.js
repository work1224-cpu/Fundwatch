const { Category, Scheme, AMC, SchemeReturn, RiskMeasure, SectorAllocation } = require("../models");
const { Op, fn, col } = require("sequelize");
const asyncHandler = require("../utils/asyncHandler");

// Home page "Browse All Data" grid — optionally narrowed by AMC / fund Type (Category.group)
// / Industry (sector a scheme is exposed to). A category only shows up when it has at least
// one scheme matching every active filter; with no filters this is identical to the old
// unfiltered list.
exports.list = asyncHandler(async (req, res) => {
  const { amcId, group, industry } = req.query;

  const schemeInclude = { model: Scheme, attributes: [] };
  const schemeWhere = {};
  if (amcId) schemeWhere.amcId = amcId;
  if (Object.keys(schemeWhere).length) schemeInclude.where = schemeWhere;

  if (industry) {
    schemeInclude.include = [{
      model: SectorAllocation, as: "sectorAllocations", attributes: [],
      required: true, where: { sectorName: industry },
    }];
  }
  // Any scheme-level filter turns the join into an INNER JOIN so categories with no
  // matching scheme drop out; with none set it stays a LEFT JOIN (original behaviour).
  schemeInclude.required = Boolean(amcId || industry);

  const where = {};
  if (group) where.group = group;

  const categories = await Category.findAll({
    where,
    attributes: {
      include: [[fn("COUNT", fn("DISTINCT", col("Schemes.id"))), "schemeCount"]],
    },
    include: [schemeInclude],
    group: ["Category.id"],
    order: [["name", "ASC"]],
    subQuery: false,
  });
  res.json(categories);
});

// Powers the Home page filter bar (AMC / Category / Type / Industry dropdowns) in one call.
exports.filterOptions = asyncHandler(async (req, res) => {
  const [amcs, categories, groupRows, industryRows] = await Promise.all([
    AMC.findAll({ attributes: ["id", "name"], order: [["name", "ASC"]] }),
    Category.findAll({ attributes: ["id", "name"], order: [["name", "ASC"]] }),
    Category.findAll({
      attributes: [[fn("DISTINCT", col("group")), "group"]],
      where: { group: { [Op.ne]: null } },
      order: [["group", "ASC"]],
      raw: true,
    }),
    SectorAllocation.findAll({
      // NOTE: col() takes the literal DB column name, not the JS attribute name — the
      // model is `underscored: true`, so "sectorName" is stored as "sector_name".
      attributes: [[fn("DISTINCT", col("sector_name")), "sectorName"]],
      where: { sectorName: { [Op.ne]: null } },
      order: [["sectorName", "ASC"]],
      raw: true,
    }),
  ]);

  res.json({
    amcs,
    categories,
    types: groupRows.map((g) => g.group).filter(Boolean),
    industries: industryRows.map((i) => i.sectorName).filter(Boolean),
  });
});

exports.get = asyncHandler(async (req, res) => {
  const category = await Category.findByPk(req.params.id);
  if (!category) return res.status(404).json({ message: "Category not found" });
  res.json(category);
});

// Search/filter/paginate schemes within a category — backs the Category Page data grid.
exports.schemes = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, pageSize = 15, search, amcId, minAum, maxAum, minReturn1y, maxReturn1y, sortBy = "name", sortDir = "ASC" } = req.query;

  const where = { categoryId: id };
  if (search) where.name = { [Op.like]: `%${search}%` };
  if (amcId) where.amcId = amcId;
  if (minAum || maxAum) where.aum = { ...(minAum && { [Op.gte]: minAum }), ...(maxAum && { [Op.lte]: maxAum }) };

  const include = [{ model: AMC }, { model: SchemeReturn, as: "returns" }, { model: RiskMeasure, as: "riskMeasures" }];

  const { rows, count } = await Scheme.findAndCountAll({
    where, include,
    order: [[sortBy, sortDir.toUpperCase() === "DESC" ? "DESC" : "ASC"]],
    limit: parseInt(pageSize), offset: (parseInt(page) - 1) * parseInt(pageSize),
    distinct: true,
  });

  let data = rows;
  if (minReturn1y || maxReturn1y) {
    data = data.filter((s) => {
      const r1y = s.returns.find((r) => r.period === "1Y")?.value;
      if (r1y === undefined) return false;
      if (minReturn1y && r1y < minReturn1y) return false;
      if (maxReturn1y && r1y > maxReturn1y) return false;
      return true;
    });
  }

  res.json({ data, total: count, page: parseInt(page), pageSize: parseInt(pageSize) });
});