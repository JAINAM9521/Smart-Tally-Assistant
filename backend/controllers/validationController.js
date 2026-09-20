"use strict";

const Upload = require("../models/Upload");
const Validation = require("../models/Validation");
const ValidationReport = require("../models/ValidationReport");

const { validateRows, summary } = require("../services/validationService");
const { applySafeFixes } = require("../services/autoFixService");
const {
  applyIssueToUpload,
  persistVerified,
  toPlainIssue,
} = require("../services/issueFixService");

const ownFilter = (user) =>
  user.role === "admin" ? {} : { user: user._id };

async function persistDataRows(uploadId, dataRows) {
  const updateResult = await Upload.updateOne(
    { _id: uploadId },
    { $set: { dataRows } },
  );

  if (updateResult.matchedCount !== 1) {
    throw new Error("Unable to persist changes to the upload.");
  }

  const savedUpload = await Upload.findById(uploadId).lean();

  if (!savedUpload || !Array.isArray(savedUpload.dataRows)) {
    throw new Error("Unable to reload the updated upload data.");
  }

  return savedUpload;
}

async function report(validation) {
  const stats = summary(validation.issues, validation.checked);
  validation.score = stats.score;
  validation.valid = stats.valid;
  validation.errors = stats.errors;
  validation.warnings = stats.warnings;
  validation.status = stats.errors > 0 ? "needs_review" : "validated";
  return stats;
}

async function syncUploadStatus(upload, stats) {
  upload.errors = stats.errors;
  upload.warnings = stats.warnings;
  upload.status = stats.errors > 0 ? "failed" : "validated";
  await upload.save();
}

exports.validate = async (req, res, next) => {
  try {
    const upload = await Upload.findOne({
      _id: req.params.uploadId,
      ...ownFilter(req.user),
    });

    if (!upload) {
      return res.status(404).json({
        success: false,
        message: "Upload not found",
        code: "NOT_FOUND",
      });
    }

    const issues = validateRows(upload.dataRows, upload.voucherType);

    const validation = await Validation.create({
      user: upload.user,
      upload: upload._id,
      issues,
      checked: upload.rows,
    });

    const stats = await report(validation);
    await validation.save();

    await ValidationReport.create({
      user: req.user._id,
      validation: validation._id,
      fileName: upload.originalName,
      ...stats,
      status: validation.status,
    });

    await syncUploadStatus(upload, stats);

    return res.json({
      success: true,
      validationId: validation._id,
      ...stats,
      issues: validation.issues,
    });
  } catch (error) {
    next(error);
  }
};

exports.get = async (req, res, next) => {
  try {
    const validation = await Validation.findOne({
      _id: req.params.validationId,
      ...ownFilter(req.user),
    });

    if (!validation) {
      return res.status(404).json({
        success: false,
        message: "Validation not found",
        code: "NOT_FOUND",
      });
    }

    return res.json({
      success: true,
      validation,
    });
  } catch (error) {
    next(error);
  }
};

exports.autoFix = async (req, res, next) => {
  try {
    const validation = await Validation.findOne({
      _id: req.params.validationId,
      ...ownFilter(req.user),
    });

    if (!validation) {
      return res.status(404).json({
        success: false,
        message: "Validation not found",
        code: "NOT_FOUND",
      });
    }

    const upload = await Upload.findOne({
      _id: validation.upload,
      ...ownFilter(req.user),
    });

    if (!upload) {
      return res.status(404).json({
        success: false,
        message: "Original upload not found",
        code: "UPLOAD_NOT_FOUND",
      });
    }

    const issues = applySafeFixes(
      JSON.parse(JSON.stringify(validation.issues || [])),
    );

    const dataRows = JSON.parse(
      JSON.stringify(Array.isArray(upload.dataRows) ? upload.dataRows : []),
    );

    const appliedChanges = [];

    for (const issue of issues) {
      if (issue.status !== "fixed") continue;

      const result = applyIssueToUpload({ dataRows }, issue);

      if (result.changed) {
        appliedChanges.push({
          row: Number(issue.row),
          column: result.column || String(issue.column || "").trim(),
          value: result.value,
        });
        issue.currentValue = result.value;
        issue.suggestedValue = result.value;
      } else {
        issue.status = "pending";
      }
    }

    let savedRows = dataRows;

    if (appliedChanges.length > 0) {
      const savedUpload = await persistDataRows(upload._id, dataRows);
      savedRows = savedUpload.dataRows;

      for (const change of appliedChanges) {
        if (persistVerified(savedRows, change)) continue;

        const issue = issues.find(
          (item) =>
            Number(item.row) === change.row &&
            String(item.column || "").trim() === change.column &&
            item.status === "fixed",
        );

        if (issue) {
          issue.status = "pending";
        }
      }
    }

    validation.issues = issues;
    validation.checked = upload.rows;

    const stats = await report(validation);
    await validation.save();

    const freshUpload = await Upload.findById(upload._id);
    if (freshUpload) {
      await syncUploadStatus(freshUpload, stats);
    }

    return res.json({
      success: true,
      ...stats,
      issues: validation.issues,
    });
  } catch (error) {
    next(error);
  }
};

exports.fixIssue = async (req, res, next) => {
  try {
    const validation = await Validation.findOne({
      _id: req.params.validationId,
      ...ownFilter(req.user),
    });

    if (!validation) {
      return res.status(404).json({
        success: false,
        message: "Validation not found",
        code: "NOT_FOUND",
      });
    }

    const item = validation.issues.find(
      (issue) => String(issue.id) === String(req.params.issueId),
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Issue not found",
        code: "NOT_FOUND",
      });
    }

    const upload = await Upload.findOne({
      _id: validation.upload,
      ...ownFilter(req.user),
    });

    if (!upload) {
      return res.status(404).json({
        success: false,
        message: "Original upload not found",
        code: "UPLOAD_NOT_FOUND",
      });
    }

    const dataRows = JSON.parse(
      JSON.stringify(Array.isArray(upload.dataRows) ? upload.dataRows : []),
    );

    const result = applyIssueToUpload({ dataRows }, toPlainIssue(item));

    if (!result.changed) {
      return res.status(400).json({
        success: false,
        message:
          result.message ||
          "No concrete correction could be applied to the uploaded data.",
        code: "FIX_VALUE_REQUIRED",
        issue: item,
      });
    }

    const savedUpload = await persistDataRows(upload._id, dataRows);

    if (
      !persistVerified(savedUpload.dataRows, {
        row: Number(item.row),
        column: result.column,
        value: result.value,
      })
    ) {
      return res.status(500).json({
        success: false,
        message: "The suggested fix could not be confirmed in saved upload data.",
        code: "PERSISTENCE_FAILED",
      });
    }

    item.status = "fixed";
    item.currentValue = result.value;
    item.suggestedValue = result.value;
    item.issue = item.issue || "Validation issue";

    validation.checked = upload.rows;
    const stats = await report(validation);
    await validation.save();

    const freshUpload = await Upload.findById(upload._id);
    if (freshUpload) {
      await syncUploadStatus(freshUpload, stats);
    }

    return res.json({
      success: true,
      updatedIssue: item,
      summary: stats,
    });
  } catch (error) {
    next(error);
  }
};

exports.apply = async (req, res, next) => {
  req.body = {
    ...req.body,
    action: "apply",
  };

  return exports.fixIssue(req, res, next);
};

exports.ignore = async (req, res, next) => {
  try {
    const validation = await Validation.findOne({
      _id: req.params.validationId,
      ...ownFilter(req.user),
    });

    if (!validation) {
      return res.status(404).json({
        success: false,
        message: "Validation not found",
        code: "NOT_FOUND",
      });
    }

    const item = validation.issues.find(
      (issue) => String(issue.id) === String(req.params.issueId),
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Issue not found",
        code: "NOT_FOUND",
      });
    }

    item.status = "ignored";
    validation.checked = validation.checked || 0;
    const stats = await report(validation);
    await validation.save();

    return res.json({
      success: true,
      updatedIssue: item,
      summary: stats,
    });
  } catch (error) {
    next(error);
  }
};

exports.revalidate = async (req, res, next) => {
  try {
    const validation = await Validation.findOne({
      _id: req.params.validationId,
      ...ownFilter(req.user),
    });

    if (!validation) {
      return res.status(404).json({
        success: false,
        message: "Validation not found",
        code: "NOT_FOUND",
      });
    }

    const upload = await Upload.findOne({
      _id: validation.upload,
      ...ownFilter(req.user),
    }).lean();

    if (!upload) {
      return res.status(404).json({
        success: false,
        message: "Original upload not found",
        code: "UPLOAD_NOT_FOUND",
      });
    }

    const sourceRows = JSON.parse(
      JSON.stringify(Array.isArray(upload.dataRows) ? upload.dataRows : []),
    );

    const freshIssues = validateRows(sourceRows, upload.voucherType);
    const oldIssues = Array.isArray(validation.issues) ? validation.issues : [];
    const oldByKey = new Map(
      oldIssues.map((issue) => [`${issue.row}:${issue.column}`, issue]),
    );

    validation.issues = freshIssues.map((freshIssue) => {
      const old = oldByKey.get(`${freshIssue.row}:${freshIssue.column}`);
      return {
        ...freshIssue,
        status: "pending",
        id: old?.id || freshIssue.id,
      };
    });

    validation.checked = upload.rows;
    const stats = await report(validation);
    await validation.save();

    await ValidationReport.create({
      user: req.user._id,
      validation: validation._id,
      fileName: upload.originalName,
      ...stats,
      status: validation.status,
    });

    await Upload.updateOne(
      { _id: upload._id },
      {
        $set: {
          errors: stats.errors,
          warnings: stats.warnings,
          status: stats.errors > 0 ? "failed" : "validated",
        },
      },
    );

    return res.json({
      success: true,
      validationId: validation._id,
      ...stats,
      status: validation.status,
      issues: validation.issues,
    });
  } catch (error) {
    next(error);
  }
};
