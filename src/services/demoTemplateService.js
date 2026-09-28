const ExcelJS = require("exceljs");

// Produces a small but structurally-real workbook: one category sheet (matching the
// "Launch Date" header shape every real category sheet uses) and one NFO sheet (matching
// the three-section "Fund Name" shape). Re-uploading this file straight back into the app
// will actually import successfully — it's not just a static illustration.
async function buildDemoTemplate() {
  const wb = new ExcelJS.Workbook();

  // ---- Sample category sheet ----
  const cat = wb.addWorksheet("Demo Category");
  cat.getCell("A1").value = "Demo Category Snapshot — sample sheet showing the expected column layout";
  cat.getCell("A3").value = "As on Demo Date";

  const headerRow = 5;
  const headers = [
    "Scheme Name", null, "Launch Date", null, "AUM (in Crs)", null, "NAV", null,
    "1 Day", "1 Month", "3 Months", "6 Months", "1 Year", "3 Years", "5 Years", "10 Years",
    "Std.Dev", "Beta", "Sharpe", "Large Cap", "Mid Cap", "Small Cap", "Cash", "1st Sector", "Exit Load",
  ];
  headers.forEach((h, i) => { if (h) cat.getCell(headerRow, i + 1).value = h; });

  const sampleRows = [
    ["Demo Growth Fund - Reg - Growth", "01/01/2020", 1250.5, 45.32, 0.12, 1.5, 4.2, 8.1, 18.4, 52.3, 95.1, 210.4, 12.5, 0.95, 0.85, 62, 28, 10, 5, "Financial Services (28.5)", "1% if redeemed within 1 year"],
    ["Demo Value Fund - Reg - Growth", "15/06/2019", 890.2, 38.11, -0.05, 0.9, 3.1, 6.7, 15.2, 44.8, 80.5, 175.2, 14.1, 1.05, 0.78, 55, 30, 15, 3, "Technology (22.1)", "Nil"],
  ];
  sampleRows.forEach((row, r) => {
    row.forEach((v, i) => { cat.getCell(headerRow + 2 + r, i + 1).value = v; });
  });

  cat.columns.forEach((col) => { col.width = 16; });

  // ---- Sample NFO sheet (3 stacked sections, matching the real file's shape) ----
  const nfo = wb.addWorksheet("Demo NFOs");
  let r = 1;

  nfo.mergeCells(r, 1, r, 5);
  nfo.getCell(r, 1).value = "On-going NFOs";
  r += 2;
  ["Fund Name", "Nature", "Sub Nature", "Open Date", "Close Date"].forEach((h, i) => { nfo.getCell(r, i + 1).value = h; });
  r += 1;
  nfo.getCell(r, 1).value = "Demo Sectoral NFO";
  nfo.getCell(r, 2).value = "Equity";
  nfo.getCell(r, 3).value = "Sectoral";
  nfo.getCell(r, 4).value = "01/08/2026";
  nfo.getCell(r, 5).value = "15/08/2026";
  r += 3;

  nfo.mergeCells(r, 1, r, 5);
  nfo.getCell(r, 1).value = "Filings with SEBI in last 3 months";
  r += 2;
  ["Fund Name", "Nature", "Sub Nature", "Filling Date"].forEach((h, i) => { nfo.getCell(r, i + 1).value = h; });
  r += 1;
  nfo.getCell(r, 1).value = "Demo Index Fund Filing";
  nfo.getCell(r, 2).value = "Equity";
  nfo.getCell(r, 3).value = "Index";
  nfo.getCell(r, 4).value = "10/07/2026";

  nfo.columns.forEach((col) => { col.width = 22; });

  return wb.xlsx.writeBuffer();
}

module.exports = { buildDemoTemplate };