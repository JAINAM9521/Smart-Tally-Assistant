const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
exports.ensureDirectories = (...dirs) =>
  dirs.forEach((dir) => fs.mkdirSync(dir, { recursive: true }));
exports.safeFileName = (name) => {
  // Normalise BOTH Windows (\) and POSIX (/) path separators so path.basename
  // works correctly on Linux production (Render) regardless of the OS that
  // produced the original filename.
  const normalised = String(name ?? "").replace(/\\/g, "/");
  // Extract just the filename portion — no directory components.
  const base = path.basename(normalised);
  // Defence-in-depth: strip any residual ".." sequences and disallow
  // everything except safe filename characters.
  const safe = base.replace(/\.\./g, "_").replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${crypto.randomUUID()}-${safe}`;
};
exports.removeFile = (file) => {
  if (file && fs.existsSync(file)) fs.unlinkSync(file);
};
