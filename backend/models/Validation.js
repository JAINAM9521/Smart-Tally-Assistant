const mongoose = require("mongoose");

const issue = new mongoose.Schema(
  {
    id: String,
    row: Number,
    column: String,
    currentValue: mongoose.Schema.Types.Mixed,
    suggestedValue: mongoose.Schema.Types.Mixed,
    issue: String,
    severity: { type: String, enum: ["error", "warning"] },
    recommendation: String,
    status: {
      type: String,
      enum: ["pending", "fixed", "ignored"],
      default: "pending",
    },
    autoFixable: Boolean,
  },
  { _id: false },
);

const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    upload: { type: mongoose.Schema.Types.ObjectId, ref: "Upload", required: true, index: true },
    score: Number,
    checked: Number,
    valid: Number,
    errors: Number,
    warnings: Number,
    status: {
      type: String,
      enum: ["needs_review", "validated", "failed"],
      default: "needs_review",
    },
    issues: [issue],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Validation", schema);
