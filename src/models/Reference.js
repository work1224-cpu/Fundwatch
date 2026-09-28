const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

// Category = one worksheet in the source Excel (Multicap, Flexicap, Liquid, BAF, ...).
// New worksheets automatically become new Category rows on import — nothing here is hardcoded.
const Category = sequelize.define("Category", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
  slug: { type: DataTypes.STRING, allowNull: false, unique: true },
  group: { type: DataTypes.STRING }, // Equity / Debt / Hybrid / Passive & FoF / Other
  sourceSheetName: { type: DataTypes.STRING },
}, { tableName: "categories" });

const AMC = sequelize.define("AMC", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
}, { tableName: "amcs" });

const FundManager = sequelize.define("FundManager", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
}, { tableName: "fund_managers" });

const Benchmark = sequelize.define("Benchmark", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
}, { tableName: "benchmarks" });

module.exports = { Category, AMC, FundManager, Benchmark };
