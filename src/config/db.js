require("dotenv").config();
const { Sequelize } = require("sequelize");

// Defaults to SQLite (zero-config) if DB_DIALECT isn't set at all — e.g. if .env is
// missing entirely. Only uses MySQL when explicitly requested via DB_DIALECT=mysql.
const dialect = process.env.DB_DIALECT || "sqlite";

let sequelize;
if (dialect === "sqlite") {
  // Zero-config local mode — useful for evaluating the project without a MySQL server.
  sequelize = new Sequelize({
    dialect: "sqlite",
    storage: process.env.DB_STORAGE || "./dev.sqlite",
    logging: false,
    define: { underscored: true, freezeTableName: false },
  });
} else {
  sequelize = new Sequelize(
    process.env.DB_NAME || "mf_intelligence",
    process.env.DB_USER || "root",
    process.env.DB_PASSWORD || "",
    {
      host: process.env.DB_HOST || "127.0.0.1",
      port: process.env.DB_PORT || 3306,
      dialect: "mysql",
      logging: false,
      define: { underscored: true, freezeTableName: false },
      pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
    }
  );
}

module.exports = sequelize;
