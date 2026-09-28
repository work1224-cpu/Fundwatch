const path = require("path");
const fs = require("fs");
const { importWorkbook } = require("../services/excelImportService");
const { buildDemoTemplate } = require("../services/demoTemplateService");
const { buildImportReport } = require("../services/importReportService");
const { buildSampleTemplate } = require("../services/sampleTemplateService");
const { readWorkbookGrid, writeWorkbookGrid } = require("../services/excelGridService");
const { Upload, ActiveImport, ImportLog } = require("../models");
const asyncHandler = require("../utils/asyncHandler");
const logActivity = require("../utils/activityLogger");

exports.upload = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded (field name: file)" });

  const result = await importWorkbook(req.file.path, req.user.id, req.file.originalname);
  await ActiveImport.upsert({ id: 1, uploadId: result.uploadId, activatedAt: new Date() });
  await logActivity({ userId: req.user.id, action: "excel.import", module: "uploads", recordId: result.uploadId, newValue: result });

  res.status(201).json({ message: "Import complete", ...result });
});

exports.history = asyncHandler(async (req, res) => {
  const uploads = await Upload.findAll({ order: [["createdAt", "DESC"]], limit: 50 });
  const active = await ActiveImport.findByPk(1);
  res.json(uploads.map((upload) => ({ ...upload.toJSON(), isActive: active?.uploadId === upload.id })));
});

exports.rename = asyncHandler(async (req, res) => {
  const upload = await Upload.findByPk(req.params.uploadId);
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  if (!upload) return res.status(404).json({ message: "Upload not found" });
  if (!name) return res.status(400).json({ message: "A file name is required" });
  upload.originalFilename = name.toLowerCase().endsWith(".xlsx") ? name : `${name}.xlsx`;
  await upload.save();
  res.json(upload);
});

exports.activate = asyncHandler(async (req, res) => {
  const upload = await Upload.findByPk(req.params.uploadId);
  if (!upload) return res.status(404).json({ message: "Upload not found" });
  if (upload.status === "processing") return res.status(409).json({ message: "This import is already processing" });
  if (!fs.existsSync(upload.storedPath)) return res.status(410).json({ message: "The original file is no longer available on the server." });
  const result = await importWorkbook(upload.storedPath, req.user.id, upload.originalFilename, upload.id);
  await ActiveImport.upsert({ id: 1, uploadId: upload.id, activatedAt: new Date() });
  await logActivity({ userId: req.user.id, action: "excel.activate", module: "uploads", recordId: upload.id, newValue: result });
  res.json({ message: "Analysis switched", ...result });
});

exports.remove = asyncHandler(async (req, res) => {
  const upload = await Upload.findByPk(req.params.uploadId);
  if (!upload) return res.status(404).json({ message: "Upload not found" });
  const active = await ActiveImport.findByPk(1);
  if (active?.uploadId === upload.id) return res.status(409).json({ message: "Active analysis cannot be deleted. Switch to another import first." });
  await ImportLog.destroy({ where: { uploadId: upload.id } });
  const { NFO, SchemeSnapshot } = require("../models");
  await NFO.destroy({ where: { uploadId: upload.id } });
  await SchemeSnapshot.destroy({ where: { uploadId: upload.id } });
  await upload.destroy();
  if (upload.storedPath && fs.existsSync(upload.storedPath)) fs.unlinkSync(upload.storedPath);
  res.json({ message: "Import deleted" });
});

exports.logs = asyncHandler(async (req, res) => {
  const logs = await ImportLog.findAll({ where: { uploadId: req.params.uploadId } });
  res.json(logs);
});

exports.demoTemplate = asyncHandler(async (req, res) => {
  const buffer = await buildDemoTemplate();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="fundwatch-demo-template.xlsx"');
  res.send(buffer);
});

// Excel Viewer — shows the exact uploaded workbook as an editable grid, sheet by sheet.
exports.grid = asyncHandler(async (req, res) => {
  const upload = await Upload.findByPk(req.params.uploadId);
  if (!upload) return res.status(404).json({ message: "Upload not found" });
  if (!fs.existsSync(upload.storedPath)) {
    return res.status(410).json({ message: "The original file is no longer available on the server." });
  }
  const sheets = await readWorkbookGrid(upload.storedPath);
  res.json({ upload: { id: upload.id, originalFilename: upload.originalFilename }, sheets });
});

// Persists edits made in the Excel Viewer straight back onto the stored file — full CRUD
// (rows, columns, sheets) is resolved client-side into a plain grid; this just rewrites the
// workbook from that grid. It intentionally does NOT touch the structured analysis tables —
// use "Activate" on the Admin import page afterwards to re-run this file through the importer.
exports.saveGrid = asyncHandler(async (req, res) => {
  const upload = await Upload.findByPk(req.params.uploadId);
  if (!upload) return res.status(404).json({ message: "Upload not found" });
  if (!fs.existsSync(upload.storedPath)) {
    return res.status(410).json({ message: "The original file is no longer available on the server." });
  }

  const sheets = Array.isArray(req.body.sheets) ? req.body.sheets : null;
  if (!sheets || !sheets.length) return res.status(400).json({ message: "At least one sheet is required" });
  for (const sheet of sheets) {
    if (!sheet.name || !String(sheet.name).trim()) return res.status(400).json({ message: "Every sheet needs a name" });
    if (!Array.isArray(sheet.rows)) return res.status(400).json({ message: "Each sheet needs a rows array" });
  }

  await writeWorkbookGrid(upload.storedPath, sheets);
  await logActivity({ userId: req.user.id, action: "excel.editGrid", module: "uploads", recordId: upload.id });
  res.json({ message: "Saved" });
});

// Serves a blank re-uploadable template built from this import: every sheet keeps its titles,
// headers and formatting but only ONE sample row per table. The full original file stays on disk
// untouched, so Excel Viewer, switching analysis and reports still show all the data.
exports.download = asyncHandler(async (req, res) => {
  const upload = await Upload.findByPk(req.params.uploadId);
  if (!upload) return res.status(404).json({ message: "Upload not found" });
  if (!fs.existsSync(upload.storedPath)) {
    return res.status(410).json({ message: "The original file is no longer available on the server." });
  }
  const buffer = await buildSampleTemplate(path.resolve(upload.storedPath));
  const safeName = upload.originalFilename.replace(/\.[^.]+$/, "");
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${safeName}-template.xlsx"`);
  res.send(Buffer.from(buffer));
});

// One-click analysis report: sheet-by-sheet import outcome + a full point-in-time dump of
// every scheme's NAV/AUM as captured during this specific upload (from data that's kept
// permanently, independent of the original file).
exports.report = asyncHandler(async (req, res) => {
  const result = await buildImportReport(req.params.uploadId);
  if (!result) return res.status(404).json({ message: "Upload not found" });
  const safeName = result.upload.originalFilename.replace(/\.[^.]+$/, "");
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${safeName}-report.xlsx"`);
  res.send(result.buffer);
});