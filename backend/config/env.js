"use strict";

require("dotenv").config();

module.exports = {
  port: Number(process.env.PORT || 5000),

  mongoUri: process.env.MONGO_URI || "",

  jwtSecret: process.env.JWT_SECRET || "",

  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",

  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",

  uploadDir: process.env.UPLOAD_DIR || "uploads",

  xmlDir: process.env.XML_DIR || "generated/xml",

  maxFileSize: Number(process.env.MAX_FILE_SIZE_MB || 100) * 1024 * 1024,

  devEmailVerification: process.env.DEV_EMAIL_VERIFICATION !== "false",
};
