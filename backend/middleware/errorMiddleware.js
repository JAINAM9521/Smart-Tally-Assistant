exports.notFound = (req, res) => res.status(404).json({ success: false, message: "Route not found", code: "NOT_FOUND" });
exports.errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || (err.code === "LIMIT_FILE_SIZE" ? 413 : 500);
  const hideDetails = process.env.NODE_ENV === "production" && status >= 500;
  res.status(status).json({
    success: false,
    message: hideDetails ? "Server error" : err.message,
    code: status === 413 ? "FILE_TOO_LARGE" : err.code || "SERVER_ERROR",
  });
};
