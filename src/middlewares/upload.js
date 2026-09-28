const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = process.env.UPLOAD_DIR || "./uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const ok = [".xlsx", ".xls"].includes(path.extname(file.originalname).toLowerCase());
  cb(ok ? null : new Error("Only .xlsx/.xls files are allowed"), ok);
};

module.exports = multer({ storage, fileFilter, limits: { fileSize: 50 * 1024 * 1024 } });
