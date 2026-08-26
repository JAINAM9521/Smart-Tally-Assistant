const mongoose = require("mongoose");
module.exports = mongoose.model("Notification", new mongoose.Schema({ user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true }, message: String, type: String, read: { type: Boolean, default: false } }, { timestamps: true }));
