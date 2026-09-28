const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Upload = sequelize.define("Upload", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  originalFilename: { type: DataTypes.STRING, allowNull: false },
  storedPath: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.ENUM("processing", "success", "partial", "failed"), defaultValue: "processing" },
  totalSheets: { type: DataTypes.INTEGER, defaultValue: 0 },
  totalRowsImported: { type: DataTypes.INTEGER, defaultValue: 0 },
  totalRowsSkipped: { type: DataTypes.INTEGER, defaultValue: 0 },
  errorMessage: { type: DataTypes.TEXT },
}, { tableName: "uploads" });

// Singleton pointer to the workbook currently represented by the live analysis tables.
const ActiveImport = sequelize.define("ActiveImport", {
  id: { type: DataTypes.INTEGER, primaryKey: true, defaultValue: 1 },
  uploadId: { type: DataTypes.INTEGER, allowNull: false },
  activatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { tableName: "active_imports" });

// One row per worksheet processed within an upload.
const ImportLog = sequelize.define("ImportLog", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  uploadId: { type: DataTypes.INTEGER, allowNull: false },
  sheetName: { type: DataTypes.STRING, allowNull: false },
  categoryId: { type: DataTypes.INTEGER },
  rowsFound: { type: DataTypes.INTEGER, defaultValue: 0 },
  rowsInserted: { type: DataTypes.INTEGER, defaultValue: 0 },
  rowsUpdated: { type: DataTypes.INTEGER, defaultValue: 0 },
  rowsSkipped: { type: DataTypes.INTEGER, defaultValue: 0 },
  errors: { type: DataTypes.JSON, defaultValue: [] },
}, { tableName: "import_logs" });

const ActivityLog = sequelize.define("ActivityLog", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER },
  action: { type: DataTypes.STRING, allowNull: false }, // e.g. "scheme.update"
  module: { type: DataTypes.STRING, allowNull: false },
  recordId: { type: DataTypes.INTEGER },
  oldValue: { type: DataTypes.JSON },
  newValue: { type: DataTypes.JSON },
}, { tableName: "activity_logs" });

// Combines "Favorites" and "Watchlist" from the spec into one table with a type flag,
// since both are just a saved user->scheme relationship with different intents.
const Watchlist = sequelize.define("Watchlist", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  schemeId: { type: DataTypes.INTEGER, allowNull: false },
  listType: { type: DataTypes.ENUM("favorite", "watchlist"), defaultValue: "watchlist" },
}, {
  tableName: "watchlists",
  indexes: [{ unique: true, fields: ["user_id", "scheme_id", "list_type"] }],
});

const DashboardSetting = sequelize.define("DashboardSetting", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  theme: { type: DataTypes.ENUM("dark", "light"), defaultValue: "dark" },
  layout: { type: DataTypes.JSON, defaultValue: {} },
}, { tableName: "dashboard_settings" });

module.exports = { Upload, ActiveImport, ImportLog, ActivityLog, Watchlist, DashboardSetting };
