const ExcelJS = require("exceljs");

// Normalizes one exceljs cell value into something JSON-safe and human-readable — plain
// strings/numbers pass through untouched, dates become ISO strings, formulas resolve to
// their last-computed result (not the formula text), and rich text / hyperlink objects
// collapse to their visible text. This is what makes the raw workbook show up "as-is".
function normalizeCellValue(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if (typeof value.result !== "undefined") return normalizeCellValue(value.result);
    if (Array.isArray(value.richText)) return value.richText.map((t) => t.text).join("");
    if (typeof value.text !== "undefined") return normalizeCellValue(value.text);
    if (typeof value.hyperlink !== "undefined") return value.text || value.hyperlink;
    return "";
  }
  return value;
}

// Reads every worksheet of the workbook at filePath into { name, rows } grids, where each
// row is a plain array of cell values in column order (1 row/col of headers included, since
// this is meant to look exactly like opening the file in Excel).
async function readWorkbookGrid(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  return workbook.worksheets.map((sheet) => {
    const rows = [];
    let maxCols = 0;
    sheet.eachRow({ includeEmpty: true }, (row) => {
      // row.values is 1-indexed (index 0 is always empty) — drop it to get a plain 0-indexed row.
      const values = row.values.slice(1).map(normalizeCellValue);
      maxCols = Math.max(maxCols, values.length);
      rows.push(values);
    });
    // Pad ragged rows so every row in a sheet has the same column count for a clean grid.
    const padded = rows.map((r) => (r.length < maxCols ? [...r, ...Array(maxCols - r.length).fill("")] : r));
    return { name: sheet.name, rows: padded };
  });
}

// Rebuilds the workbook at filePath from scratch out of the given { name, rows } sheets —
// this is the "save" side of the CRUD grid: whatever the admin edited in the browser becomes
// the new file on disk, replacing the previously uploaded one.
async function writeWorkbookGrid(filePath, sheets) {
  const workbook = new ExcelJS.Workbook();
  const usedNames = new Set();
  sheets.forEach((sheet, idx) => {
    let name = (sheet.name || `Sheet${idx + 1}`).toString().slice(0, 31) || `Sheet${idx + 1}`;
    let suffix = 1;
    while (usedNames.has(name)) { name = `${name.slice(0, 28)}(${suffix++})`; }
    usedNames.add(name);
    const worksheet = workbook.addWorksheet(name);
    (sheet.rows || []).forEach((row) => worksheet.addRow(Array.isArray(row) ? row : []));
  });
  await workbook.xlsx.writeFile(filePath);
}

module.exports = { readWorkbookGrid, writeWorkbookGrid };