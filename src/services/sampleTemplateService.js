const fs = require("fs");
const JSZip = require("jszip");

// Builds a "client template" from an uploaded workbook.
//
// The workbook is edited at the file (XML) level instead of being re-created, so everything
// that is not a data table stays byte-for-byte identical: the Home sheet, its charts and
// shapes, images, styles, hidden sheets, Disclaimer, column widths, merges, etc.
//
// Only the data sheets are trimmed:
//   - category sheets (have a "Launch Date" header): headers + ONE sample scheme row are kept
//   - NFO sheet (stacked sections with a "Fund Name" header): headers + ONE sample row per section
// The stored original file is never modified, so Excel Viewer still shows all the data.

const xmlUnescape = (s) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

function parseSharedStrings(xml) {
  if (!xml) return [];
  const out = [];
  const siRe = /<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g;
  let m;
  while ((m = siRe.exec(xml))) {
    let text = "";
    const tRe = /<t\b[^>]*?>([\s\S]*?)<\/t>/g;
    let t;
    while ((t = tRe.exec(m[1] || ""))) text += t[1];
    out.push(xmlUnescape(text));
  }
  return out;
}

function colToNum(letters) {
  return letters.split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
}

function parseRows(sheetXml, shared) {
  const rows = [];
  const rowRe = /<row\b[^>]*?\/>|<row\b[^>]*>[\s\S]*?<\/row>/g;
  let m;
  while ((m = rowRe.exec(sheetXml))) {
    const xml = m[0];
    const num = Number(/\br="(\d+)"/.exec(xml)[1]);
    const cells = [];
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let c;
    while ((c = cellRe.exec(xml))) {
      const ref = /\br="([A-Z]+)\d+"/.exec(c[1]);
      if (!ref) continue;
      const type = (/\bt="(\w+)"/.exec(c[1]) || [])[1];
      const body = c[2] || "";
      let text = "";
      if (type === "s") {
        const v = /<v>([\s\S]*?)<\/v>/.exec(body);
        text = v ? shared[Number(v[1])] || "" : "";
      } else if (type === "inlineStr") {
        const t = /<t\b[^>]*?>([\s\S]*?)<\/t>/.exec(body);
        text = t ? xmlUnescape(t[1]) : "";
      } else {
        const v = /<v>([\s\S]*?)<\/v>/.exec(body);
        text = v ? xmlUnescape(v[1]) : "";
      }
      cells.push({ col: colToNum(ref[1]), text: text.trim() });
    }
    rows.push({ num, xml, cells });
  }
  return rows;
}

const firstCol = (row) => (row.cells.find((c) => c.col === 1) || {}).text || "";
const filledTexts = (row) => row.cells.map((c) => c.text).filter((t) => t !== "");

function classify(rows) {
  const top10 = rows.filter((r) => r.num <= 10);
  const header = top10.find((r) => r.cells.some((c) => c.text.includes("Launch Date")));
  if (header) return { kind: "category", headerRow: header.num };
  const top15 = rows.filter((r) => r.num <= 15);
  if (top15.some((r) => r.cells.some((c) => c.text === "Fund Name"))) return { kind: "nfo" };
  return { kind: "other" };
}

function parseRange(ref) {
  const m = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(ref);
  if (!m) return null;
  return { c1: m[1], r1: Number(m[2]), c2: m[3] || m[1], r2: Number(m[4] || m[2]) };
}

// Rewrites <mergeCells> so only merges whose rows all survive remain, with renumbered rows.
function rewriteMerges(sheetXml, rowMap) {
  return sheetXml.replace(/<mergeCells\b[^>]*>([\s\S]*?)<\/mergeCells>/, (all, inner) => {
    const kept = [];
    const re = /<mergeCell\b[^>]*\bref="([^"]+)"[^>]*\/>/g;
    let m;
    while ((m = re.exec(inner))) {
      const r = parseRange(m[1]);
      if (!r) continue;
      let ok = true;
      for (let i = r.r1; i <= r.r2; i++) if (!rowMap.has(i)) { ok = false; break; }
      if (!ok) continue;
      kept.push(`<mergeCell ref="${r.c1}${rowMap.get(r.r1)}:${r.c2}${rowMap.get(r.r2)}"/>`);
    }
    return kept.length ? `<mergeCells count="${kept.length}">${kept.join("")}</mergeCells>` : "";
  });
}

function renumberRow(rowXml, oldNum, newNum) {
  if (oldNum === newNum) return rowXml;
  return rowXml
    .replace(/^<row\b[^>]*?>|^<row\b[^>]*?\/>/, (open) => open.replace(/\br="\d+"/, `r="${newNum}"`))
    .replace(/(<c\b[^>]*?\br="[A-Z]+)\d+(")/g, `$1${newNum}$2`);
}

function trimSheet(sheetXml, shared) {
  const rows = parseRows(sheetXml, shared);
  if (!rows.length) return sheetXml;
  const info = classify(rows);
  if (info.kind === "other") return sheetXml; // Home, Graph Data, Disclaimer... untouched

  const keep = new Set();
  if (info.kind === "category") {
    // headers + everything up to (and including) the first real scheme row
    let sampleRow = null;
    for (const r of rows) {
      if (r.num <= info.headerRow + 1) { keep.add(r.num); continue; }
      keep.add(r.num);
      if (firstCol(r) && filledTexts(r).length > 1) { sampleRow = r.num; break; }
    }
    if (sampleRow === null) rows.forEach((r) => keep.add(r.num)); // no scheme row found: leave sheet as-is
  } else {
    let inTable = false, sampleTaken = false;
    for (const r of rows) {
      const filled = filledTexts(r);
      if (filled.length === 0) continue; // blank row dropped
      if (firstCol(r) === "Fund Name") { keep.add(r.num); inTable = true; sampleTaken = false; continue; }
      if (new Set(filled).size <= 1) { keep.add(r.num); continue; } // section title / label row
      if (inTable && !sampleTaken) { keep.add(r.num); sampleTaken = true; }
    }
  }

  const keptRows = rows.filter((r) => keep.has(r.num));
  const rowMap = new Map();
  keptRows.forEach((r, i) => rowMap.set(r.num, i + 1));

  const newRowsXml = keptRows.map((r) => renumberRow(r.xml, r.num, rowMap.get(r.num))).join("");
  const start = sheetXml.indexOf("<sheetData");
  const openEnd = sheetXml.indexOf(">", start) + 1;
  const end = sheetXml.indexOf("</sheetData>");
  let out = sheetXml.slice(0, openEnd) + newRowsXml + sheetXml.slice(end);

  out = rewriteMerges(out, rowMap);
  const lastRow = keptRows.length;
  out = out.replace(/<dimension\b[^>]*\bref="([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?"[^>]*\/>/, (all, c1, r1, c2) =>
    `<dimension ref="${c1}${r1}:${c2 || c1}${Math.max(lastRow, Number(r1))}"/>`);
  return out;
}

async function buildSampleTemplate(filePath) {
  const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
  const sharedFile = zip.file("xl/sharedStrings.xml");
  const shared = parseSharedStrings(sharedFile ? await sharedFile.async("string") : "");

  const sheetPaths = Object.keys(zip.files).filter((p) => /^xl\/worksheets\/[^/]+\.xml$/.test(p));
  for (const p of sheetPaths) {
    const xml = await zip.file(p).async("string");
    const trimmed = trimSheet(xml, shared);
    if (trimmed !== xml) zip.file(p, trimmed);
  }

  // The calculation chain lists cells that no longer exist; Excel simply rebuilds it.
  if (zip.file("xl/calcChain.xml")) {
    zip.remove("xl/calcChain.xml");
    const relsPath = "xl/_rels/workbook.xml.rels";
    if (zip.file(relsPath)) {
      const rels = await zip.file(relsPath).async("string");
      zip.file(relsPath, rels.replace(/<Relationship\b[^>]*calcChain[^>]*\/>/g, ""));
    }
    if (zip.file("[Content_Types].xml")) {
      const ct = await zip.file("[Content_Types].xml").async("string");
      zip.file("[Content_Types].xml", ct.replace(/<Override\b[^>]*calcChain[^>]*\/>/g, ""));
    }
  }

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

module.exports = { buildSampleTemplate };