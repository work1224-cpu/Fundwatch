const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const errorHandler = require("./middlewares/errorHandler");
const routes = require("./routes");

const app = express();

// =====================================================
// Security Middleware
// =====================================================

app.use(helmet());

// =====================================================
// CORS
// =====================================================

app.use(cors());

// =====================================================
// Logging
// =====================================================

app.use(morgan("dev"));

// =====================================================
// Body Parser
// =====================================================

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// =====================================================
// Root Route
// =====================================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "FundWatch API is running successfully",
    status: "online",
    timestamp: new Date().toISOString(),
  });
});

// =====================================================
// Health Check
// =====================================================

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// =====================================================
// API Routes
// =====================================================

app.use("/api", routes);

// =====================================================
// 404 Handler
// =====================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});

// =====================================================
// Global Error Handler
// =====================================================

app.use(errorHandler);

// =====================================================
// Export App
// =====================================================

module.exports = app;
