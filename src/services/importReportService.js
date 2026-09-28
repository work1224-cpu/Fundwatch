const ExcelJS = require("exceljs");
const { Upload, ImportLog, SchemeSnapshot, Scheme, Category, AMC, NFO } = require("../models");

// One-click analysis report for a past import — lets someone review what a given Excel
// upload actually contained (and what changed) without needing to re-upload or keep the
// original file around. Built from data already permanently retained in the DB:
// ImportLog (per-sheet outcome) and SchemeSnapshot (point-in-time NAV/AUM captured on
// every import, never overwritten by later uploads).
async function buildImportReport(uploadId) {
  const upload = await Upload.findByPk(uploadId);
  if (!upload) return null;

  const logs = await ImportLog.findAll({ where: { uploadId }, include: [Category] });
  const snapshots = await SchemeSnapshot.findAll({
    where: { uploadId },
    include: [{ model: Scheme, include: [Category, AMC] }],
    order: [[Scheme, Category, "name", "ASC"], [Scheme, "name", "ASC"]],
  });
  const nfos = await NFO.findAll({ where: { uploadId } });

  const wb = new ExcelJS.Workbook();

  const summary = wb.addWorksheet("Import Summary");
  summary.addRow(["FundWatch Import Report"]);
  summary.addRow(["File", upload.originalFilename]);
  summary.addRow(["Uploaded", upload.createdAt.toISOString()]);
  summary.addRow(["Status", upload.status]);
  summary.addRow(["Sheets Processed", upload.totalSheets]);
  summary.addRow(["Rows Imported", upload.totalRowsImported]);
  summary.addRow(["Rows Skipped", upload.totalRowsSkipped]);
  summary.addRow([]);
  summary.addRow(["Sheet Name", "Category", "Rows Found", "Inserted", "Updated", "Skipped", "Errors"]);
  logs.forEach((l) => {
    summary.addRow([
      l.sheetName, l.Category?.name || "", l.rowsFound, l.rowsInserted, l.rowsUpdated, l.rowsSkipped,
      Array.isArray(l.errors) && l.errors.length ? l.errors.join(" | ") : "",
    ]);
  });
  summary.columns.forEach((c) => { c.width = 20; });
  summary.getColumn(7).width = 50;

  const dataSheet = wb.addWorksheet("Scheme Data (this upload)");
  dataSheet.addRow(["Scheme", "Category", "AMC", "NAV", "AUM (Cr)", "Snapshot Date"]);
  snapshots.forEach((s) => {
    dataSheet.addRow([
      s.Scheme?.name || "", s.Scheme?.Category?.name || "", s.Scheme?.AMC?.name || "",
      s.nav, s.aum, s.snapshotDate,
    ]);
  });
  dataSheet.columns.forEach((c) => { c.width = 22; });

  if (nfos.length) {
    const nfoSheet = wb.addWorksheet("NFOs (this upload)");
    nfoSheet.addRow(["Fund Name", "Section", "Nature", "Sub Nature", "Open Date", "Close Date", "Filing Date"]);
    nfos.forEach((n) => {
      nfoSheet.addRow([n.fundName, n.section, n.nature, n.subNature, n.openDate, n.closeDate, n.filingDate]);
    });
    nfoSheet.columns.forEach((c) => { c.width = 22; });
  }

  return { buffer: await wb.xlsx.writeBuffer(), upload };
}

module.exports = { buildImportReport };