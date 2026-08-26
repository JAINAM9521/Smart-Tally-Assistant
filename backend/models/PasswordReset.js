const mongoose = require("mongoose");
module.exports = mongoose.model("PasswordReset", new mongoose.Schema({ user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, otpHash: String, expiresAt: Date, used: { type: Boolean, default: false } }, { timestamps: true }));
