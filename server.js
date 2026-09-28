require("dotenv").config();
const app = require("./src/app");
const { sequelize } = require("./src/models");
const startCronJobs = require("./src/cron/refreshStats");

const PORT = process.env.PORT || 5000;

// Safety net: without this, ANY unhandled promise rejection anywhere in the app (e.g. a
// transient "database is locked" error from SQLite under concurrent requests) kills the whole
// Node process — nodemon then shows "app crashed" with no useful stack trace. Logging instead
// keeps the server up; the request that triggered it still fails with a normal 500, which is
// far easier to see and debug than a full restart.
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

async function start() {
  try {
    await sequelize.authenticate();
    console.log("Database connected.");

    // NOTE: intentionally NOT using { alter: true } here. In testing, running `npm run seed`
    // and then `npm start` back-to-back against the same SQLite file caused Sequelize's
    // alter-sync to rebuild the `users` table and silently null out the roleId foreign key,
    // breaking login. Plain sync() still creates any new tables that don't exist yet (e.g. a
    // model you've just added) — it just won't rewrite the schema of tables that already
    // exist. If you change a model's columns/indexes, delete dev.sqlite and reseed instead
    // of relying on auto-migration; see the README for the proper migration path in MySQL.
    await sequelize.sync();
    console.log("Models synced.");

    startCronJobs();

    app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

start();