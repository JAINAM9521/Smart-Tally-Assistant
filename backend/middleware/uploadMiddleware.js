"use strict";

const multer = require("multer");
const path = require("path");
const { maxFileSize, uploadDir } = require("../config/env");
const { ensureDirectories, safeFileName } = require("../utils/fileUtils");

ensureDirectories(path.resolve(__dirname, "..", uploadDir));

const allowedExtensions = new Set([".xlsx", ".xls", ".csv"]);
const allowedMimeTypes = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
  "text/plain",
  "application/octet-stream",
]);

const storage = multer.diskStorage({
  destination: (_, __, cb) =>
    cb(null, path.resolve(__dirname, "..", uploadDir)),
  filename: (_, file, cb) => cb(null, safeFileName(file.originalname)),
});

exports.uploadSingle = multer({
  storage,
  limits: { fileSize: maxFileSize },
  fileFilter: (_, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const mime = String(file.mimetype || "").toLowerCase();

    if (!allowedExtensions.has(extension)) {
      return cb(new Error("Only .xlsx, .xls and .csv files are supported."));
    }

    if (mime && !allowedMimeTypes.has(mime)) {
      return cb(new Error("Only Excel and CSV files are supported."));
    }

    return cb(null, true);
  },
}).single("file");
