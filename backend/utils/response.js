exports.ok = (res, data, status = 200) => res.status(status).json({ success: true, ...data });
exports.fail = (res, message, code = "SERVER_ERROR", status = 500, errors = []) => res.status(status).json({ success: false, message, code, errors });
