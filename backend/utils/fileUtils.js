const fs = require("fs"); const path = require("path"); const crypto = require("crypto");
exports.ensureDirectories = (...dirs) => dirs.forEach(dir => fs.mkdirSync(dir, { recursive: true }));
exports.safeFileName = name => `${crypto.randomUUID()}-${path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_")}`;
exports.removeFile = file => { if (file && fs.existsSync(file)) fs.unlinkSync(file); };
