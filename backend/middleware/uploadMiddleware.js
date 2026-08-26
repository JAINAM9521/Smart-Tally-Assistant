const multer = require("multer"); const path = require("path"); const { maxFileSize, uploadDir } = require("../config/env"); const { ensureDirectories, safeFileName } = require("../utils/fileUtils");
ensureDirectories(path.resolve(__dirname, "..", uploadDir));
const allowed = new Set([".xlsx", ".xls", ".csv"]);
const storage = multer.diskStorage({ destination: (_, __, cb) => cb(null, path.resolve(__dirname, "..", uploadDir)), filename: (_, file, cb) => cb(null, safeFileName(file.originalname)) });
exports.uploadSingle = multer({ storage, limits: { fileSize: maxFileSize }, fileFilter: (_, file, cb) => allowed.has(path.extname(file.originalname).toLowerCase()) ? cb(null, true) : cb(new Error("Only .xlsx, .xls and .csv files are supported.")) }).single("file");
