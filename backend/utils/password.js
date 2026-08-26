const bcrypt = require("bcryptjs");
exports.hashPassword = password => bcrypt.hash(password, 12);
exports.comparePassword = (password, hash) => bcrypt.compare(password, hash);
