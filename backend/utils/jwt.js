const jwt = require("jsonwebtoken");
const { jwtSecret, jwtExpiresIn } = require("../config/env");
exports.signToken = payload => jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn });
exports.verifyToken = token => jwt.verify(token, jwtSecret);
