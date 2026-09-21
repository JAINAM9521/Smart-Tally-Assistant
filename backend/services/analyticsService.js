"use strict";

const Upload = require("../models/Upload");
const Validation = require("../models/Validation");
const XMLFile = require("../models/XMLFile");

exports.dashboard = async (user) => {
  const scope = user.role === "admin" ? {} : { user: user._id };
  const [
    totalUploads,
    totalValidations,
    totalXMLFiles,
    uploads,
    validatedCount,
    failedCount,
  ] = await Promise.all([
    Upload.countDocuments(scope),
    Validation.countDocuments(scope),
    XMLFile.countDocuments(scope),
    Upload.find(scope).select("rows voucherType"),
    Validation.countDocuments({ ...scope, status: "validated" }),
    Validation.countDocuments({
      ...scope,
      status: { $in: ["needs_review", "failed"] },
    }),
  ]);

  const totalRows = uploads.reduce((sum, item) => sum + (item.rows || 0), 0);
  const successRate = totalValidations
    ? Math.round((validatedCount / totalValidations) * 100)
    : 0;

  const voucherBreakdown = uploads.reduce((out, item) => {
    if (item.voucherType) {
      out[item.voucherType] = (out[item.voucherType] || 0) + 1;
    }
    return out;
  }, {});

  return {
    totalUploads,
    totalRows,
    totalTransactions: totalRows,
    totalValidations,
    totalXMLFiles,
    successRate,
    successfulConversions: validatedCount,
    failedConversions: failedCount,
    totalVouchers: totalRows,
    validationSuccessRate: successRate,
    voucherBreakdown,
  };
};
