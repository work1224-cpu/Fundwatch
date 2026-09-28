const ExcelJS = require("exceljs");
const { sequelize, Category, AMC, FundManager, Benchmark, Scheme, SchemeReturn, RiskMeasure, MarketCapAllocation,
  SectorAllocation, SchemeSnapshot, Upload, ImportLog, NFO, SchemeSipReturn } = require("../models");

/* ---------- generic cell helpers ---------- */
function clean(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object" && v.result !== undefined) v = v.result; // formula cell
  if (typeof v === "string") {
    const t = v.trim();
    if (["--", "", ".", "NA", "N/A"].includes(t)) return null;
    return t;
  }
  return v;
}
function toNum(v) {
  v = clean(v);
  if (v === null) return null;
  if (typeof v === "number") return Math.round(v * 100) / 100;
  const n = parseFloat(String(v).replace(/,/g, "").replace("%", ""));
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}
function forwardFill(arr) {
  let last = null;
  return arr.map((v) => {
    if (v !== null && v !== undefined && String(v).trim() !== "") last = v;
    return last;
  });
}
function slug(s) {
  return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function extractAMCName(schemeName) {
  const known = [
    "360 ONE", "Abakkus", "Aditya Birla Sun Life", "AlphaGrep", "Angel One", "Axis",
    "Bajaj Finserv", "Bandhan", "Bank of India", "Baroda BNP Paribas", "BHARAT Bond",
    "Canara Robeco", "Capitalmind", "Choice", "DSP", "Edelweiss", "Franklin", "Groww",
    "HDFC", "HSBC", "Helios", "ICICI Prudential", "IDBI", "IDFC", "Invesco", "ITI",
    "Indiabulls", "JM", "JioBlackRock", "Kotak", "LIC", "Mahindra Manulife", "Mirae Asset",
    "Motilal Oswal", "Navi", "Nippon India", "NJ", "Old Bridge", "Parag Parikh", "PGIM",
    "Quant", "Quantum", "Samco", "SBI", "Shriram", "Sundaram", "Tata", "Taurus",
    "Templeton India", "The Wealth Company", "Trust", "Union", "Unifi", "UTI",
    "WhiteOak Capital", "Zerodha",
  ];
  let best = null;
  for (const a of known) if (schemeName.toLowerCase().startsWith(a.toLowerCase())) {
    if (!best || a.length > best.length) best = a;
  }
  // Unrecognised AMC (not in the list above) — fall back to just the first word. Two words is
  // tempting but wrong here: for a name like "JM Aggressive Hybrid Fund", the second word is
  // part of the fund's own category, not the AMC, and using it fragments one AMC into many.
  return best || schemeName.split(" ")[0];
}
function groupFor(categoryName) {
  const GROUPS = {
    "Equity, FOFs & ETFs Funds": ["Multicap", "Flexicap", "Largecap", "Large & Mid", "Midcap", "Smallcap", "Dividend Yield Fund",
      "Focused Fund", "Contra Value Fund", "Sectoral-Infrastructure", "Sectoral-Thematic", "ELSS", "Equity Index Fund",
      "ETFs", "Gold ETFs", "FoF - Overseas", "FoF - Domestic"],
    "Debt Funds": ["Overnight", "Liquid", "Ultra Short Duration", "Low Duration", "Money Market", "Short Duration",
      "Medium Duration", "Medium to Long Duration", "Long Duration", "Dynamic Bond", "Corporate Bond",
      "Credit Risk", "BPSU", "Gilt", "Gilt Fund with 10 years", "Floater", "Debt – ETFs, Index Funds, FOF"],
    "Hybrid Funds": ["Aggressive Hybrid", "BAF", "EQ Savings", "Arbitrage", "Multi Asset", "Conservative Hybrid", "Balanced Hybrid"],
  };
  for (const [g, list] of Object.entries(GROUPS)) if (list.includes(categoryName)) return g;
  return "Other";
}

function parseDMY(v) {
  v = clean(v);
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const m = String(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

// NFO sheets have no "Launch Date" column at all (new funds have no track record yet).
// Detected generically by the presence of a "Fund Name" header, not by sheet name,
// so a differently-named sheet with the same shape would still import correctly.
function looksLikeNFOSheet(worksheet) {
  for (let r = 1; r <= Math.min(15, worksheet.rowCount); r++) {
    for (let c = 1; c <= worksheet.columnCount; c++) {
      const v = worksheet.getRow(r).getCell(c).value;
      if (typeof v === "string" && v.trim() === "Fund Name") return true;
    }
  }
  return false;
}

// This sheet has multiple stacked sections (On-going NFOs / Recently launched / SEBI filings),
// each with its own header row and slightly different columns — so it's parsed row-by-row
// with a running "current section + column map" rather than one fixed header offset.
//
// Note: ExcelJS repeats a merged cell's value across every cell in the merge (unlike some
// other libraries, which leave only the master cell populated), so a merged section-title
// row looks like ["On-going NFOs","On-going NFOs","On-going NFOs",...] rather than
// ["On-going NFOs", null, null...]. Detection below is written for that behavior.
function parseNFORows(worksheet) {
  const records = [];
  let section = null;
  let pendingLabel = null;
  let headerMap = null;

  for (let r = 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const vals = [];
    for (let c = 1; c <= worksheet.columnCount; c++) vals.push(clean(row.getCell(c).value));

    if (!vals[0]) continue; // blank row — ignore, don't disturb pendingLabel/headerMap state

    if (vals[0] === "Fund Name") {
      section = pendingLabel || section;
      headerMap = {};
      vals.forEach((label, i) => {
        if (!label) return;
        const low = String(label).toLowerCase();
        if (low === "fund name") headerMap.fundName = i;
        else if (low === "nature") headerMap.nature = i;
        else if (low === "sub nature") headerMap.subNature = i;
        else if (low === "open date") headerMap.openDate = i;
        else if (low === "close date") headerMap.closeDate = i;
        else if (low === "allotment date") headerMap.allotmentDate = i;
        else if (low === "duration") headerMap.duration = i;
        else if (low.includes("aum")) headerMap.aum = i;
        else if (low.includes("filling date") || low.includes("filing date")) headerMap.filingDate = i;
      });
      continue;
    }

    const distinctNonNull = new Set(vals.filter((v) => v !== null && v !== undefined && v !== "")).size;

    // A merged title/label row: every filled cell holds the identical string.
    // Covers both real section titles ("On-going NFOs") and sub-category labels
    // ("Open Ended Funds") — either way we just remember it as the latest label;
    // it only gets "promoted" to `section` the next time a header row is seen.
    if (distinctNonNull <= 1) {
      pendingLabel = vals[0];
      continue;
    }

    if (!headerMap || !section) continue; // stray row before any section is established

    const get = (key) => (headerMap[key] !== undefined ? vals[headerMap[key]] : null);
    const fundName = get("fundName");
    if (!fundName) continue;

    records.push({
      section,
      fundName,
      nature: get("nature"),
      subNature: get("subNature"),
      openDate: parseDMY(get("openDate")),
      closeDate: parseDMY(get("closeDate")),
      allotmentDate: parseDMY(get("allotmentDate")),
      duration: get("duration"),
      aum: toNum(get("aum")),
      filingDate: parseDMY(get("filingDate")),
    });
  }
  return records;
}

async function importNFOSheet(worksheet, uploadId) {
  const rows = parseNFORows(worksheet);
  let inserted = 0, updated = 0, skipped = 0;
  const errors = [];

  for (const rec of rows) {
    try {
      const where = { section: rec.section, fundName: rec.fundName, openDate: rec.openDate, filingDate: rec.filingDate };
      const [nfo, created] = await NFO.findOrCreate({ where, defaults: { ...rec, uploadId } });
      if (created) inserted++;
      else { await nfo.update({ ...rec, uploadId }); updated++; }
    } catch (err) {
      skipped++;
      errors.push(`${rec.fundName}: ${err.message}`);
    }
  }

  await ImportLog.create({
    uploadId, sheetName: worksheet.name, rowsFound: rows.length,
    rowsInserted: inserted, rowsUpdated: updated, rowsSkipped: skipped, errors,
  });
  return { inserted, updated, skipped };
}
function findHeaderRow(worksheet) {
  for (let r = 1; r <= Math.min(10, worksheet.rowCount); r++) {
    const row = worksheet.getRow(r);
    for (let c = 1; c <= worksheet.columnCount; c++) {
      const v = row.getCell(c).value;
      if (typeof v === "string" && v.includes("Launch Date")) return r;
    }
  }
  return null;
}
function buildColumnLabels(worksheet, headerRow) {
  const ncols = worksheet.columnCount;
  const group = [], sub = [];
  for (let c = 1; c <= ncols; c++) {
    group.push(clean(worksheet.getRow(headerRow).getCell(c).value));
    sub.push(clean(worksheet.getRow(headerRow + 1).getCell(c).value));
  }
  const groupFf = forwardFill(group);
  // The sub-header row also only writes its label once per span (e.g. "SIP Returns(%)" appears
  // under the first of five period columns, then is blank for the other four) — forward-fill it
  // the same way the group row already is, or every period after the first in a span loses its
  // qualifier and becomes indistinguishable from the same period in a different span (a plain
  // "3 Years" column could be the lump-sum return OR the SIP return with no way to tell apart).
  const subFf = forwardFill(sub);
  const labels = [];
  for (let i = 0; i < ncols; i++) {
    const g = groupFf[i], s = subFf[i];
    labels.push(g && s ? `${g} - ${s}` : g || s || null);
  }
  return labels;
}
// The source workbook is inconsistent about singular vs plural in its headers — e.g. "10
// Years" right next to "7 Year", "5 Year", "3 Year", "1 Year" in the very same row. Treating
// "Year(s)" / "Month(s)" / "Day(s)" as equivalent means column detection isn't at the mercy
// of which spelling a particular sheet happened to use.
function normalizeLabel(str) {
  return str.toLowerCase().replace(/\b(year|month|day)s\b/g, "$1");
}
function findCol(labels, keywords, exclude = []) {
  const normKeywords = keywords.map(normalizeLabel);
  const normExclude = exclude.map(normalizeLabel);
  for (let i = 0; i < labels.length; i++) {
    const lab = labels[i];
    if (!lab) continue;
    const low = normalizeLabel(lab);
    if (normKeywords.every((k) => low.includes(k)) && !normExclude.some((e) => low.includes(e))) {
      return i + 1; // exceljs columns are 1-indexed
    }
  }
  return null;
}

/* ---------- main import routine ---------- */
async function importWorkbook(filePath, userId, originalFilename, existingUploadId = null) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const upload = existingUploadId
    ? await Upload.findByPk(existingUploadId)
    : await Upload.create({
      userId, originalFilename: originalFilename || filePath.split("/").pop(), storedPath: filePath, status: "processing",
    });
  if (!upload) return null;
  if (existingUploadId) {
    await ImportLog.destroy({ where: { uploadId: upload.id } });
    await NFO.destroy({ where: { uploadId: upload.id } });
    await SchemeSnapshot.destroy({ where: { uploadId: upload.id } });
    await upload.update({ userId, status: "processing", errorMessage: null, totalSheets: 0, totalRowsImported: 0, totalRowsSkipped: 0 });
  }

  let totalInserted = 0, totalUpdated = 0, totalSkipped = 0, sheetsProcessed = 0;

  for (const worksheet of workbook.worksheets) {
    const headerRow = findHeaderRow(worksheet);
    if (!headerRow) {
      if (looksLikeNFOSheet(worksheet)) {
        sheetsProcessed++;
        const nfoResult = await importNFOSheet(worksheet, upload.id);
        totalInserted += nfoResult.inserted; totalUpdated += nfoResult.updated; totalSkipped += nfoResult.skipped;
        continue;
      }
      // No "Launch Date" or "Fund Name" header found -> not a fund data sheet (e.g. a cover/summary tab). Skip automatically.
      await ImportLog.create({ uploadId: upload.id, sheetName: worksheet.name, rowsFound: 0, rowsSkipped: 0, errors: ["no header detected - skipped"] });
      continue;
    }
    sheetsProcessed++;
    const labels = buildColumnLabels(worksheet, headerRow);
    const cols = {
      launch: findCol(labels, ["Launch Date"]),
      aum: findCol(labels, ["AUM"]),
      nav: findCol(labels, ["NAV"]),
      r1d: findCol(labels, ["1 Day"]), r7d: findCol(labels, ["7 Days"]),
      r1m: findCol(labels, ["1 Month"]), r3m: findCol(labels, ["3 Months"]), r6m: findCol(labels, ["6 Months"]),
      r1y: findCol(labels, ["1 Year"], ["sip"]), r2y: findCol(labels, ["2 Years"]),
      r3y: findCol(labels, ["3 Years"], ["sip"]), r5y: findCol(labels, ["5 Years"], ["sip"]),
      r10y: findCol(labels, ["10 Years"], ["sip"]), rsi: findCol(labels, ["Since Inception"]),
      stdDev: findCol(labels, ["Std.Dev"]), beta: findCol(labels, ["Beta"]), sharpe: findCol(labels, ["Sharpe"]),
      jensen: findCol(labels, ["Jenson"]), // source workbook spells it "Jenson" — this is Jensen's Alpha
      large: findCol(labels, ["Large Cap"]), mid: findCol(labels, ["Mid Cap"]), small: findCol(labels, ["Small Cap"]), cash: findCol(labels, ["Cash"]),
      sec1: findCol(labels, ["1st Sector"]), sec2: findCol(labels, ["2nd Sector"]), sec3: findCol(labels, ["3rd Sector"]),
      sec4: findCol(labels, ["4th Sector"]), sec5: findCol(labels, ["5th Sector"]),
      exitLoad: findCol(labels, ["Exit Load"]), ytm: findCol(labels, ["YTM"]), avgMat: findCol(labels, ["Avg Maturity"]),
      sip1y: findCol(labels, ["1 Year", "SIP"]), sip3y: findCol(labels, ["3 Years", "SIP"]),
      sip5y: findCol(labels, ["5 Years", "SIP"]), sip7y: findCol(labels, ["7 Years", "SIP"]),
      sip10y: findCol(labels, ["10 Years", "SIP"]),
      fundManager: findCol(labels, ["Fund Manager"]) || findCol(labels, ["Manager"]),
      benchmark: findCol(labels, ["Benchmark"]),
    };

    // Every column index already claimed by a known field above. Anything else with a
    // real header label and a non-empty value in a given row gets captured into that
    // scheme's otherData instead of being silently dropped.
    const consumedIndices = new Set(Object.values(cols).filter((idx) => idx != null));

    const [category, categoryCreated] = await Category.findOrCreate({
      where: { name: worksheet.name },
      defaults: { name: worksheet.name, slug: slug(worksheet.name), group: groupFor(worksheet.name), sourceSheetName: worksheet.name },
    });
    if (!categoryCreated) {
      // Keeps categorization current if grouping rules change later, instead of freezing
      // whatever group a category happened to get on its very first import.
      const freshGroup = groupFor(worksheet.name);
      if (category.group !== freshGroup) await category.update({ group: freshGroup });
    }

    let rowsFound = 0, inserted = 0, updated = 0, skipped = 0;
    const errors = [];
    const dataStart = headerRow + 2;

    for (let r = dataStart; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      const schemeName = clean(row.getCell(1).value);
      const navVal = cols.nav ? toNum(row.getCell(cols.nav).value) : null;
      if (!schemeName || navVal === null) continue; // section-label / blank rows without a NAV are not scheme rows
      rowsFound++;

      try {
        const g = (idx) => (idx ? row.getCell(idx).value : null);
        const amcName = extractAMCName(schemeName);
        const [amc] = await AMC.findOrCreate({ where: { name: amcName } });

        const fundManagerName = clean(g(cols.fundManager));
        const fundManager = fundManagerName ? (await FundManager.findOrCreate({ where: { name: fundManagerName } }))[0] : null;
        const benchmarkName = clean(g(cols.benchmark));
        const benchmark = benchmarkName ? (await Benchmark.findOrCreate({ where: { name: benchmarkName } }))[0] : null;

        const otherData = {};
        for (let c = 2; c <= worksheet.columnCount; c++) {
          if (consumedIndices.has(c)) continue;
          const label = labels[c - 1];
          if (!label) continue;
          const val = clean(row.getCell(c).value);
          if (val === null) continue;
          otherData[label] = val;
        }
        const otherDataValue = Object.keys(otherData).length ? otherData : null;

        const [scheme, created] = await Scheme.findOrCreate({
          where: { categoryId: category.id, name: schemeName },
          defaults: {
            categoryId: category.id, name: schemeName, amcId: amc.id,
            fundManagerId: fundManager?.id ?? null, benchmarkId: benchmark?.id ?? null,
            launchDate: clean(g(cols.launch)), nav: navVal, aum: toNum(g(cols.aum)),
            exitLoad: clean(g(cols.exitLoad)), ytm: toNum(g(cols.ytm)), avgMaturity: toNum(g(cols.avgMat)),
            otherData: otherDataValue, lastImportedAt: new Date(),
          },
        });

        if (!created) {
          await scheme.update({
            amcId: amc.id, nav: navVal, aum: toNum(g(cols.aum)),
            fundManagerId: fundManager?.id ?? scheme.fundManagerId, benchmarkId: benchmark?.id ?? scheme.benchmarkId,
            exitLoad: clean(g(cols.exitLoad)), ytm: toNum(g(cols.ytm)), avgMaturity: toNum(g(cols.avgMat)),
            otherData: otherDataValue, lastImportedAt: new Date(),
          });
          updated++;
        } else {
          inserted++;
        }

        // returns (upsert one row per period)
        const returnMap = { "1D": cols.r1d, "7D": cols.r7d, "1M": cols.r1m, "3M": cols.r3m, "6M": cols.r6m,
          "1Y": cols.r1y, "2Y": cols.r2y, "3Y": cols.r3y, "5Y": cols.r5y, "10Y": cols.r10y, "SI": cols.rsi };
        for (const [period, idx] of Object.entries(returnMap)) {
          const val = toNum(g(idx));
          if (val === null) continue;
          await SchemeReturn.upsert({ schemeId: scheme.id, period, value: val });
        }

        // SIP returns (kept separate from lump-sum returns above — genuinely different calc)
        const sipMap = { "1Y": cols.sip1y, "3Y": cols.sip3y, "5Y": cols.sip5y, "7Y": cols.sip7y, "10Y": cols.sip10y };
        for (const [period, idx] of Object.entries(sipMap)) {
          const val = toNum(g(idx));
          if (val === null) continue;
          await SchemeSipReturn.upsert({ schemeId: scheme.id, period, value: val });
        }

        // risk measures
        for (const [metric, idx] of Object.entries({ stdDev: cols.stdDev, beta: cols.beta, sharpe: cols.sharpe, jensen: cols.jensen })) {
          const val = toNum(g(idx));
          if (val === null) continue;
          await RiskMeasure.upsert({ schemeId: scheme.id, metric, value: val });
        }

        // market cap allocation
        for (const [capType, idx] of Object.entries({ large: cols.large, mid: cols.mid, small: cols.small, cash: cols.cash })) {
          const val = toNum(g(idx));
          if (val === null) continue;
          await MarketCapAllocation.upsert({ schemeId: scheme.id, capType, percentage: val });
        }

        // sector allocation (top 5)
        const sectorIdxs = [cols.sec1, cols.sec2, cols.sec3, cols.sec4, cols.sec5];
        for (let i = 0; i < sectorIdxs.length; i++) {
          const raw = clean(g(sectorIdxs[i]));
          if (!raw) continue;
          const m = raw.match(/^(.*?)\s*\(([\d.\-]+)\)\s*$/);
          const sectorName = m ? m[1].trim() : raw;
          const pct = m ? parseFloat(m[2]) : null;
          await SectorAllocation.upsert({ schemeId: scheme.id, rank: i + 1, sectorName, percentage: pct });
        }

        // snapshot for version history / trend / rollback
        await SchemeSnapshot.create({
          schemeId: scheme.id, uploadId: upload.id, nav: navVal, aum: toNum(g(cols.aum)),
          snapshotDate: new Date().toISOString().slice(0, 10),
        });
      } catch (err) {
        skipped++;
        errors.push(`Row ${r} (${schemeName}): ${err.message}`);
      }
    }

    totalInserted += inserted; totalUpdated += updated; totalSkipped += skipped;
    await ImportLog.create({
      uploadId: upload.id, sheetName: worksheet.name, categoryId: category.id,
      rowsFound, rowsInserted: inserted, rowsUpdated: updated, rowsSkipped: skipped, errors,
    });
  }

  await upload.update({
    status: "success", totalSheets: sheetsProcessed,
    totalRowsImported: totalInserted + totalUpdated, totalRowsSkipped: totalSkipped,
  });

  return { uploadId: upload.id, sheetsProcessed, totalInserted, totalUpdated, totalSkipped };
}

module.exports = { importWorkbook, extractAMCName };