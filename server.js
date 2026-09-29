require("dotenv").config();

const app = require("./src/app");
const { sequelize } = require("./src/models");
const startCronJobs = require("./src/cron/refreshStats");

const PORT = process.env.PORT || 5000;

// =====================================================
// Process Error Handling
// =====================================================

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

// =====================================================
// Start Application
// =====================================================

async function start() {
  try {
    // -------------------------------------------------
    // Database Connection
    // -------------------------------------------------

    await sequelize.authenticate();

    console.log("Database connected.");

    // -------------------------------------------------
    // Sync Sequelize Models
    // -------------------------------------------------

    await sequelize.sync();

    console.log("Models synced.");

    // -------------------------------------------------
    // Start Cron Jobs
    // -------------------------------------------------

    startCronJobs();

    console.log("Cron jobs started.");

    // -------------------------------------------------
    // Start Express Server
    // -------------------------------------------------

    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`API listening on port ${PORT}`);
    });

    // -------------------------------------------------
    // Server Error Handler
    // -------------------------------------------------

    server.on("error", (err) => {
      console.error("[Server Error]", err);
    });

  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

// =====================================================
// Start Server
// =====================================================

start();
