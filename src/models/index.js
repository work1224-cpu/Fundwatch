const sequelize = require("../config/db");
const Role = require("./Role");
const User = require("./User");
const { Category, AMC, FundManager, Benchmark } = require("./Reference");
const Scheme = require("./Scheme");
const { SchemeReturn, RiskMeasure, MarketCapAllocation, SectorAllocation, SchemeSnapshot, SchemeSipReturn } = require("./SchemeMetrics");
const { Upload, ActiveImport, ImportLog, ActivityLog, Watchlist, DashboardSetting } = require("./Operational");
const NFO = require("./NFO");
const CompareHistory = require("./CompareHistory");

// ---- Associations ----
Role.hasMany(User, { foreignKey: "roleId" });
User.belongsTo(Role, { foreignKey: "roleId" });

Category.hasMany(Scheme, { foreignKey: "categoryId" });
Scheme.belongsTo(Category, { foreignKey: "categoryId" });

AMC.hasMany(Scheme, { foreignKey: "amcId" });
Scheme.belongsTo(AMC, { foreignKey: "amcId" });

FundManager.hasMany(Scheme, { foreignKey: "fundManagerId" });
Scheme.belongsTo(FundManager, { foreignKey: "fundManagerId" });

Benchmark.hasMany(Scheme, { foreignKey: "benchmarkId" });
Scheme.belongsTo(Benchmark, { foreignKey: "benchmarkId" });

Scheme.hasMany(SchemeReturn, { foreignKey: "schemeId", as: "returns", onDelete: "CASCADE" });
SchemeReturn.belongsTo(Scheme, { foreignKey: "schemeId" });

Scheme.hasMany(RiskMeasure, { foreignKey: "schemeId", as: "riskMeasures", onDelete: "CASCADE" });
RiskMeasure.belongsTo(Scheme, { foreignKey: "schemeId" });

Scheme.hasMany(MarketCapAllocation, { foreignKey: "schemeId", as: "marketCapAllocations", onDelete: "CASCADE" });
MarketCapAllocation.belongsTo(Scheme, { foreignKey: "schemeId" });

Scheme.hasMany(SectorAllocation, { foreignKey: "schemeId", as: "sectorAllocations", onDelete: "CASCADE" });
SectorAllocation.belongsTo(Scheme, { foreignKey: "schemeId" });

Scheme.hasMany(SchemeSnapshot, { foreignKey: "schemeId", as: "snapshots", onDelete: "CASCADE" });
SchemeSnapshot.belongsTo(Scheme, { foreignKey: "schemeId" });

Scheme.hasMany(SchemeSipReturn, { foreignKey: "schemeId", as: "sipReturns", onDelete: "CASCADE" });
SchemeSipReturn.belongsTo(Scheme, { foreignKey: "schemeId" });

User.hasMany(Upload, { foreignKey: "userId" });
Upload.belongsTo(User, { foreignKey: "userId" });

Upload.hasMany(ImportLog, { foreignKey: "uploadId", onDelete: "CASCADE" });
ImportLog.belongsTo(Upload, { foreignKey: "uploadId" });
Category.hasMany(ImportLog, { foreignKey: "categoryId" });
ImportLog.belongsTo(Category, { foreignKey: "categoryId" });

User.hasMany(ActivityLog, { foreignKey: "userId" });
ActivityLog.belongsTo(User, { foreignKey: "userId" });

User.hasMany(Watchlist, { foreignKey: "userId", onDelete: "CASCADE" });
Watchlist.belongsTo(User, { foreignKey: "userId" });
Scheme.hasMany(Watchlist, { foreignKey: "schemeId", onDelete: "CASCADE" });
Watchlist.belongsTo(Scheme, { foreignKey: "schemeId" });

User.hasOne(DashboardSetting, { foreignKey: "userId", onDelete: "CASCADE" });
DashboardSetting.belongsTo(User, { foreignKey: "userId" });

Upload.hasMany(NFO, { foreignKey: "uploadId" });
NFO.belongsTo(Upload, { foreignKey: "uploadId" });

User.hasMany(CompareHistory, { foreignKey: "userId", onDelete: "CASCADE" });
CompareHistory.belongsTo(User, { foreignKey: "userId" });

module.exports = {
  sequelize,
  Role, User, Category, AMC, FundManager, Benchmark, Scheme,
  SchemeReturn, RiskMeasure, MarketCapAllocation, SectorAllocation, SchemeSnapshot, SchemeSipReturn,
  Upload, ActiveImport, ImportLog, ActivityLog, Watchlist, DashboardSetting, NFO, CompareHistory,
};