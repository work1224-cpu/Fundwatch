const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

// New Fund Offerings have no NAV/AUM/return history yet, so they don't fit the Scheme model.
// `section` is stored verbatim from the sheet ("On-going NFOs", "NFOs launched in last 3 months",
// "Filings with SEBI in last 3 months") rather than a hardcoded enum, so if the workbook's
// wording changes next quarter, new sections still import correctly without a code change.
const NFO = sequelize.define("NFO", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  section: { type: DataTypes.STRING, allowNull: false },
  fundName: { type: DataTypes.STRING, allowNull: false },
  nature: { type: DataTypes.STRING },
  subNature: { type: DataTypes.STRING },
  openDate: { type: DataTypes.DATEONLY },
  closeDate: { type: DataTypes.DATEONLY },
  allotmentDate: { type: DataTypes.DATEONLY },
  duration: { type: DataTypes.STRING },
  aum: { type: DataTypes.DECIMAL(14, 2) },
  filingDate: { type: DataTypes.DATEONLY },
  uploadId: { type: DataTypes.INTEGER },
}, {
  tableName: "nfos",
  indexes: [{ unique: true, fields: ["section", "fund_name", "open_date", "filing_date"] }],
});

module.exports = NFO;
