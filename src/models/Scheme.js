const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Scheme = sequelize.define("Scheme", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  categoryId: { type: DataTypes.INTEGER, allowNull: false },
  amcId: { type: DataTypes.INTEGER },
  fundManagerId: { type: DataTypes.INTEGER },
  benchmarkId: { type: DataTypes.INTEGER },
  launchDate: { type: DataTypes.DATEONLY },
  nav: { type: DataTypes.DECIMAL(14, 4) },
  aum: { type: DataTypes.DECIMAL(16, 2) }, // in Crores
  exitLoad: { type: DataTypes.STRING(500) },
  ytm: { type: DataTypes.DECIMAL(8, 4) },
  avgMaturity: { type: DataTypes.DECIMAL(8, 4) },
  // Every column from the source sheet that isn't one of the known/structured fields above
  // (SIP returns, "Since <date>" return columns, MTD, anything else the workbook adds later)
  // gets captured here as { "column label": value } instead of being silently dropped.
  otherData: { type: DataTypes.JSON },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  lastImportedAt: { type: DataTypes.DATE },
}, {
  tableName: "schemes",
  indexes: [
    { unique: true, fields: ["category_id", "name"] }, // prevents duplicate rows on re-import
    { fields: ["amc_id"] },
    { fields: ["nav"] },
    { fields: ["aum"] },
  ],
});

module.exports = Scheme;