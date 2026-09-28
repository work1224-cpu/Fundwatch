const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const errorHandler = require("./middlewares/errorHandler");
const routes = require("./routes");

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));
app.use("/api", routes);

app.use((req, res) => res.status(404).json({ message: "Route not found" }));
app.use(errorHandler);

module.exports = app;
