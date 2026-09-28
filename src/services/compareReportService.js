const ExcelJS = require("exceljs");
const { Scheme, Category, AMC, SchemeReturn, RiskMeasure, MarketCapAllocation, SectorAllocation } = require("../models");

const PERIODS = ["1D", "7D", "1M", "3M", "6M", "1Y", "2Y", "3Y", "5Y", "10Y", "SI"];

async function buildCompareReport(compareHistory) {
  const schemes = await Scheme.findAll({
    where: { id: compareHistory.schemeIds },
    include: [
      Category, AMC,
      { model: SchemeReturn, as: "returns" },
      { model: RiskMeasure, as: "riskMeasures" },
      { model: MarketCapAllocation, as: "marketCapAllocations" },
    ],
  });
  // Preserve the original comparison order rather than whatever order the DB returns.
  const ordered = compareHistory.schemeIds.map((id) => schemes.find((s) => s.id === id)).filter(Boolean);

  const wb = new ExcelJS.Workbook();

  const overview = wb.addWorksheet("Comparison");
  overview.addRow([compareHistory.label]);
  overview.addRow(["Saved", compareHistory.createdAt.toISOString()]);
  overview.addRow([]);

  const metricRows = [
    ["Scheme", ...ordered.map((s) => s.name)],
    ["Category", ...ordered.map((s) => s.Category?.name || "")],
    ["AMC", ...ordered.map((s) => s.AMC?.name || "")],
    ["NAV", ...ordered.map((s) => s.nav)],
    ["AUM (Cr)", ...ordered.map((s) => s.aum)],
    ["Launch Date", ...ordered.map((s) => s.launchDate)],
  ];
  PERIODS.forEach((p) => {
    metricRows.push([`${p} Return (%)`, ...ordered.map((s) => s.returns.find((r) => r.period === p)?.value ?? "")]);
  });
  ["stdDev", "beta", "sharpe", "jensen"].forEach((metric) => {
    metricRows.push([metric, ...ordered.map((s) => s.riskMeasures.find((r) => r.metric === metric)?.value ?? "")]);
  });
  metricRows.push(["Exit Load", ...ordered.map((s) => s.exitLoad || "")]);

  metricRows.forEach((row) => overview.addRow(row));
  overview.getColumn(1).width = 18;
  overview.columns.forEach((c, i) => { if (i > 0) c.width = 30; });
  overview.getRow(4).font = { bold: true };

  // Different fund types have different "extra" columns (SIP returns for equity funds,
  // credit ratings / instrument mix for debt funds, etc.), so this sheet is built from the
  // union of every key present across the compared schemes, leaving a blank cell for any
  // scheme that doesn't have a particular one — rather than assuming they all match.
  const allOtherKeys = [...new Set(ordered.flatMap((s) => Object.keys(s.otherData || {})))];
  if (allOtherKeys.length) {
    const otherSheet = wb.addWorksheet("Other Data");
    otherSheet.addRow(["Field", ...ordered.map((s) => s.name)]);
    allOtherKeys.forEach((key) => {
      otherSheet.addRow([key, ...ordered.map((s) => (s.otherData && s.otherData[key] !== undefined) ? s.otherData[key] : "")]);
    });
    otherSheet.getColumn(1).width = 40;
    otherSheet.columns.forEach((c, i) => { if (i > 0) c.width = 30; });
    otherSheet.getRow(1).font = { bold: true };
  }

  return { buffer: await wb.xlsx.writeBuffer(), schemeCount: ordered.length };
}

module.exports = { buildCompareReport };