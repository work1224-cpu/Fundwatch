const ExcelJS = require("exceljs");
const { Scheme, Category, AMC, FundManager, Benchmark, SchemeReturn, RiskMeasure,
  MarketCapAllocation, SectorAllocation, SchemeSnapshot, SchemeSipReturn } = require("../models");

const PERIOD_LABELS = { "1D": "1 Day", "7D": "7 Days", "1M": "1 Month", "3M": "3 Months", "6M": "6 Months",
  "1Y": "1 Year", "2Y": "2 Years", "3Y": "3 Years", "5Y": "5 Years", "10Y": "10 Years", "SI": "Since Inception" };
const RISK_LABELS = { stdDev: "Std. Dev", beta: "Beta", sharpe: "Sharpe", jensen: "Jensen's Alpha" };

async function buildSchemeReport(schemeId) {
  const scheme = await Scheme.findByPk(schemeId, {
    include: [
      Category, AMC, FundManager, Benchmark,
      { model: SchemeReturn, as: "returns" },
      { model: SchemeSipReturn, as: "sipReturns" },
      { model: RiskMeasure, as: "riskMeasures" },
      { model: MarketCapAllocation, as: "marketCapAllocations" },
      { model: SectorAllocation, as: "sectorAllocations", separate: true, order: [["rank", "ASC"]] },
    ],
  });
  if (!scheme) return null;

  const snapshots = await SchemeSnapshot.findAll({ where: { schemeId }, order: [["snapshotDate", "ASC"]] });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Fund Report");

  ws.addRow([scheme.name]);
  ws.addRow(["Category", scheme.Category?.name || ""]);
  ws.addRow(["AMC", scheme.AMC?.name || ""]);
  if (scheme.FundManager) ws.addRow(["Fund Manager", scheme.FundManager.name]);
  if (scheme.Benchmark) ws.addRow(["Benchmark", scheme.Benchmark.name]);
  ws.addRow(["Launch Date", scheme.launchDate]);
  ws.addRow(["NAV", scheme.nav]);
  ws.addRow(["AUM (Cr)", scheme.aum]);
  if (scheme.exitLoad) ws.addRow(["Exit Load", scheme.exitLoad]);
  ws.addRow([]);

  ws.addRow(["Returns by Period"]);
  ws.addRow(["Period", "Return (%)"]);
  scheme.returns.forEach((r) => ws.addRow([PERIOD_LABELS[r.period] || r.period, Number(r.value)]));
  ws.addRow([]);

  if (scheme.sipReturns.length) {
    ws.addRow(["SIP Returns by Period (annualized)"]);
    ws.addRow(["Period", "SIP Return (%)"]);
    scheme.sipReturns.forEach((r) => ws.addRow([r.period, Number(r.value)]));
    ws.addRow([]);
  }

  if (scheme.riskMeasures.length) {
    ws.addRow(["Risk Measures"]);
    scheme.riskMeasures.forEach((r) => ws.addRow([RISK_LABELS[r.metric] || r.metric, Number(r.value)]));
    ws.addRow([]);
  }

  if (scheme.marketCapAllocations.length) {
    ws.addRow(["Market Cap Allocation (%)"]);
    scheme.marketCapAllocations.forEach((m) => ws.addRow([m.capType, Number(m.percentage)]));
    ws.addRow([]);
  }

  if (scheme.sectorAllocations.length) {
    ws.addRow(["Sector Allocation (%)"]);
    scheme.sectorAllocations.forEach((s) => ws.addRow([s.sectorName, Number(s.percentage)]));
    ws.addRow([]);
  }

  if (scheme.otherData && Object.keys(scheme.otherData).length) {
    ws.addRow(["Other Data (every extra column from the source sheet)"]);
    Object.entries(scheme.otherData).forEach(([k, v]) => ws.addRow([k, v]));
    ws.addRow([]);
  }

  ws.columns.forEach((c) => { c.width = 26; });
  ws.getRow(1).font = { bold: true, size: 13 };

  if (snapshots.length > 1) {
    const trend = wb.addWorksheet("NAV-AUM History");
    trend.addRow(["Snapshot Date", "NAV", "AUM (Cr)"]);
    snapshots.forEach((s) => trend.addRow([s.snapshotDate, Number(s.nav), s.aum != null ? Number(s.aum) : null]));
    trend.columns.forEach((c) => { c.width = 18; });
  }

  return { buffer: await wb.xlsx.writeBuffer(), scheme };
}

module.exports = { buildSchemeReport };