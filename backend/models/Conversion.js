const mongoose = require("mongoose");
module.exports = mongoose.model("Conversion", new mongoose.Schema({ user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, upload: { type: mongoose.Schema.Types.ObjectId, ref: "Upload" }, voucherType: String, status: String, progress: Number }, { timestamps: true }));
