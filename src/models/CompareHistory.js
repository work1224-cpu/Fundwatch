const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

// A saved snapshot of a "Compare Funds" selection. Stores only the scheme IDs (not a
// copy of their data) — the report is always generated from live data at download time,
// so it reflects the latest import rather than going stale.
const CompareHistory = sequelize.define("CompareHistory", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  label: { type: DataTypes.STRING, allowNull: false },
  schemeIds: { type: DataTypes.JSON, allowNull: false }, // array of Scheme ids, in the order they were compared
}, { tableName: "compare_histories" });

module.exports = CompareHistory;