const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

// One row per (scheme, period) - keeps returns normalized instead of a wide table with 1D/1M/1Y... columns.
const SchemeReturn = sequelize.define("SchemeReturn", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  schemeId: { type: DataTypes.INTEGER, allowNull: false },
  period: { type: DataTypes.ENUM("1D", "7D", "1M", "3M", "6M", "1Y", "2Y", "3Y", "5Y", "10Y", "SI"), allowNull: false },
  value: { type: DataTypes.DECIMAL(10, 4) },
}, {
  tableName: "scheme_returns",
  indexes: [{ unique: true, fields: ["scheme_id", "period"] }],
});

const RiskMeasure = sequelize.define("RiskMeasure", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  schemeId: { type: DataTypes.INTEGER, allowNull: false },
  metric: { type: DataTypes.ENUM("stdDev", "beta", "sharpe", "jensen"), allowNull: false },
  value: { type: DataTypes.DECIMAL(10, 4) },
}, {
  tableName: "risk_measures",
  indexes: [{ unique: true, fields: ["scheme_id", "metric"] }],
});

const MarketCapAllocation = sequelize.define("MarketCapAllocation", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  schemeId: { type: DataTypes.INTEGER, allowNull: false },
  capType: { type: DataTypes.ENUM("large", "mid", "small", "cash"), allowNull: false },
  percentage: { type: DataTypes.DECIMAL(6, 2) },
}, {
  tableName: "market_cap_allocations",
  indexes: [{ unique: true, fields: ["scheme_id", "cap_type"] }],
});

const SectorAllocation = sequelize.define("SectorAllocation", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  schemeId: { type: DataTypes.INTEGER, allowNull: false },
  rank: { type: DataTypes.INTEGER, allowNull: false }, // 1st..5th sector
  sectorName: { type: DataTypes.STRING },
  percentage: { type: DataTypes.DECIMAL(6, 2) },
}, {
  tableName: "sector_allocations",
  indexes: [{ unique: true, fields: ["scheme_id", "rank"] }],
});

// One row created per import — gives NAV/AUM trend + a rollback point without full column-level versioning.
const SchemeSnapshot = sequelize.define("SchemeSnapshot", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  schemeId: { type: DataTypes.INTEGER, allowNull: false },
  uploadId: { type: DataTypes.INTEGER },
  nav: { type: DataTypes.DECIMAL(14, 4) },
  aum: { type: DataTypes.DECIMAL(16, 2) },
  snapshotDate: { type: DataTypes.DATEONLY, allowNull: false },
}, {
  tableName: "scheme_snapshots",
  indexes: [{ fields: ["scheme_id", "snapshot_date"] }],
});

// SIP (Systematic Investment Plan) returns, kept separate from lump-sum SchemeReturn above
// since they're a genuinely different return calculation, not just another period.
const SchemeSipReturn = sequelize.define("SchemeSipReturn", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  schemeId: { type: DataTypes.INTEGER, allowNull: false },
  period: { type: DataTypes.ENUM("1Y", "3Y", "5Y", "7Y", "10Y"), allowNull: false },
  value: { type: DataTypes.DECIMAL(10, 4) },
}, {
  tableName: "scheme_sip_returns",
  indexes: [{ unique: true, fields: ["scheme_id", "period"] }],
});

module.exports = { SchemeReturn, RiskMeasure, MarketCapAllocation, SectorAllocation, SchemeSnapshot, SchemeSipReturn };