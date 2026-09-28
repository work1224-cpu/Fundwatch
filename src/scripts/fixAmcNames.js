// One-time cleanup for AMC fragmentation caused by the old two-word fallback in
// extractAMCName (e.g. "JM Aggressive Hybrid Fund" used to create a separate "JM Aggressive"
// AMC instead of being recognised as "JM"). Safe to run any number of times — it recomputes the
// correct AMC for every scheme using today's extractAMCName, re-links schemes that point to the
// wrong (fragmented) AMC, and deletes any AMC left with zero schemes afterwards.
//
// Run from the backend folder with:  node src/scripts/fixAmcNames.js
require("dotenv").config();
const { sequelize, Scheme, AMC } = require("../models");
const { extractAMCName } = require("../services/excelImportService");

async function run() {
  await sequelize.authenticate();

  const schemes = await Scheme.findAll({ attributes: ["id", "name", "amcId"] });
  const amcCache = new Map(); // amcName -> AMC instance, avoids a repeated lookup per scheme
  let relinked = 0;

  for (const scheme of schemes) {
    const correctName = extractAMCName(scheme.name);
    let amc = amcCache.get(correctName);
    if (!amc) {
      [amc] = await AMC.findOrCreate({ where: { name: correctName } });
      amcCache.set(correctName, amc);
    }
    if (scheme.amcId !== amc.id) {
      await scheme.update({ amcId: amc.id });
      relinked++;
    }
  }

  // Anything left with no schemes pointing to it was a fragment (or a genuinely unused AMC) —
  // safe to remove now that every scheme has been re-linked to its correct AMC above.
  const allAmcs = await AMC.findAll();
  let removed = 0;
  for (const amc of allAmcs) {
    const count = await Scheme.count({ where: { amcId: amc.id } });
    if (count === 0) {
      await amc.destroy();
      removed++;
    }
  }

  console.log(`Checked ${schemes.length} schemes.`);
  console.log(`Re-linked ${relinked} scheme(s) to their correct AMC.`);
  console.log(`Removed ${removed} now-empty (fragmented/duplicate) AMC record(s).`);
  console.log(`${allAmcs.length - removed} AMC(s) remain.`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => { console.error("fixAmcNames failed:", err); process.exit(1); });