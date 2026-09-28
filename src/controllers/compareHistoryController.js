const { CompareHistory, Scheme } = require("../models");
const { buildCompareReport } = require("../services/compareReportService");
const asyncHandler = require("../utils/asyncHandler");

exports.save = asyncHandler(async (req, res) => {
  const { schemeIds, label } = req.body;
  if (!Array.isArray(schemeIds) || schemeIds.length < 2) {
    return res.status(400).json({ message: "At least 2 schemeIds are required to save a comparison" });
  }
  // No cap — save the full comparison, however many schemes it has.
  const ids = [...new Set(schemeIds)];

  let finalLabel = label && label.trim();
  if (!finalLabel) {
    const schemes = await Scheme.findAll({ where: { id: ids.slice(0, 2) }, attributes: ["name"] });
    const names = schemes.map((s) => s.name.length > 24 ? s.name.slice(0, 24) + "…" : s.name);
    finalLabel = names.join(" vs ") + (ids.length > 2 ? ` + ${ids.length - 2} more` : "");
  }

  const entry = await CompareHistory.create({ userId: req.user.id, label: finalLabel, schemeIds: ids });
  res.status(201).json(entry);
});

exports.list = asyncHandler(async (req, res) => {
  const entries = await CompareHistory.findAll({
    where: { userId: req.user.id },
    order: [["createdAt", "DESC"]],
  });
  res.json(entries);
});

exports.get = asyncHandler(async (req, res) => {
  const entry = await CompareHistory.findOne({ where: { id: req.params.id, userId: req.user.id } });
  if (!entry) return res.status(404).json({ message: "Saved comparison not found" });
  res.json(entry);
});

exports.remove = asyncHandler(async (req, res) => {
  const entry = await CompareHistory.findOne({ where: { id: req.params.id, userId: req.user.id } });
  if (!entry) return res.status(404).json({ message: "Saved comparison not found" });
  await entry.destroy();
  res.status(204).send();
});

exports.report = asyncHandler(async (req, res) => {
  const entry = await CompareHistory.findOne({ where: { id: req.params.id, userId: req.user.id } });
  if (!entry) return res.status(404).json({ message: "Saved comparison not found" });
  const { buffer } = await buildCompareReport(entry);
  const safeName = entry.label.replace(/[^a-z0-9]+/gi, "_").slice(0, 60);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="compare-${safeName}.xlsx"`);
  res.send(buffer);
});