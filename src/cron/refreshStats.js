const { CronJob } = require("cron");
const { Scheme } = require("../models");

// Runs daily at 2 AM — flags schemes that haven't been refreshed by any import in 30+ days.
// Extend this to plug in a live NAV feed, recompute cached aggregates, purge old snapshots, etc.
function startCronJobs() {
  const job = new CronJob("0 2 * * *", async () => {
    try {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const staleCount = await Scheme.count({ where: { lastImportedAt: { [require("sequelize").Op.lt]: cutoff } } });
      console.log(`[cron] ${staleCount} schemes have not been refreshed in 30+ days`);
    } catch (err) {
      console.error("[cron] refreshStats failed:", err.message);
    }
  });
  job.start();
  console.log("Cron jobs started.");
}

module.exports = startCronJobs;
