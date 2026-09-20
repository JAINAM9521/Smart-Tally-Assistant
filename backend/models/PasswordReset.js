const mongoose = require("mongoose");
module.exports = mongoose.model(
  "PasswordReset",
  new mongoose.Schema(
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
      otpHash: String,
      expiresAt: Date,
      used: { type: Boolean, default: false },
      attempts: { type: Number, default: 0 },
    },
    { timestamps: true },
  ),
);
