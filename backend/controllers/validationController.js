const Upload = require("../models/Upload");
const Validation = require("../models/Validation");
const ValidationReport = require("../models/ValidationReport");

const { validateRows, summary } = require("../services/validationService");

const { applySafeFixes } = require("../services/autoFixService");

/* =========================================================
   OWNERSHIP
========================================================= */

const own = (validation, user) =>
  Boolean(
    validation &&
    (user.role === "admin" || String(validation.user) === String(user._id)),
  );

/* =========================================================
   HELPERS
========================================================= */

/*
 * Validation issue rows are Excel row numbers.
 *
 * Example:
 *   Header = row 1
 *   First data row = row 2
 *
 * Therefore:
 *   Excel row 2 -> dataRows[0]
 *   Excel row 3 -> dataRows[1]
 */
const getDataRowIndex = (issueRow, dataRows) => {
  const excelRow = Number(issueRow);

  if (!Number.isInteger(excelRow)) {
    return -1;
  }

  const primaryIndex = excelRow - 2;

  if (primaryIndex >= 0 && primaryIndex < dataRows.length) {
    return primaryIndex;
  }

  /*
   * Fallback in case the validation service stores
   * zero-based/one-based data row indexes instead.
   */
  const fallbackIndex = excelRow - 1;

  if (fallbackIndex >= 0 && fallbackIndex < dataRows.length) {
    return fallbackIndex;
  }

  return -1;
};

/*
 * Convert amount into a numeric string.
 *
 * Examples:
 *   ₹12,500  -> 12500
 *   12,500   -> 12500
 *   12500     -> 12500
 */
const normalizeAmount = (value) => {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/[₹$€£,\s]/g, "");

  if (cleaned === "") {
    return "";
  }

  const number = Number(cleaned);

  if (!Number.isFinite(number)) {
    return "";
  }

  return String(number);
};

/*
 * Normalize date separators.
 *
 * 26/08/2026 -> 26-08-2026
 * 26.08.2026 -> 26-08-2026
 *
 * Also preserves DD-MM-YYYY.
 */
const normalizeDate = (value) => {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return "";
  }

  const match = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);

  if (!match) {
    return raw;
  }

  const day = String(Number(match[1])).padStart(2, "0");

  const month = String(Number(match[2])).padStart(2, "0");

  const year = match[3];

  return `${day}-${month}-${year}`;
};

/*
 * Determine whether an issue can provide a concrete
 * corrected value.
 */
const getSuggestedValue = (issue) => {
  const candidates = [
    issue?.suggestedValue,
    issue?.correctedValue,
    issue?.fixValue,
    issue?.value,
  ];

  for (const candidate of candidates) {
    if (
      candidate !== undefined &&
      candidate !== null &&
      String(candidate).trim() !== ""
    ) {
      return String(candidate).trim();
    }
  }

  return "";
};

/*
 * Apply the issue fix to the actual upload row.
 *
 * IMPORTANT:
 * This is the part that was missing before.
 * Validation status alone is not enough because XML
 * generation reads Upload.dataRows.
 */
const applyIssueToUpload = (upload, issue) => {
  if (!upload || !Array.isArray(upload.dataRows) || !issue) {
    return {
      changed: false,
      message: "Upload data is unavailable.",
    };
  }

  const rowIndex = getDataRowIndex(issue.row, upload.dataRows);

  if (rowIndex < 0) {
    return {
      changed: false,
      message: `Unable to locate Excel row ${issue.row}.`,
    };
  }

  const row = upload.dataRows[rowIndex];

  const column = String(issue.column || "").trim();

  const suggestedValue = getSuggestedValue(issue);

  /* -------------------------------------------------------
     AMOUNT
  ------------------------------------------------------- */

  if (column === "AMOUNT") {
    const normalized = normalizeAmount(
      suggestedValue || row?.AMOUNT || issue.currentValue,
    );

    if (normalized) {
      row.AMOUNT = normalized;

      return {
        changed: true,
        value: normalized,
      };
    }

    return {
      changed: false,
      message: "Unable to normalize amount.",
    };
  }

  /* -------------------------------------------------------
     DATE
  ------------------------------------------------------- */

  if (column === "DATE") {
    const normalized = normalizeDate(
      suggestedValue || row?.DATE || issue.currentValue,
    );

    if (normalized) {
      row.DATE = normalized;

      return {
        changed: true,
        value: normalized,
      };
    }

    return {
      changed: false,
      message: "Unable to normalize date.",
    };
  }

  /* -------------------------------------------------------
     VOUCHER NUMBER
  ------------------------------------------------------- */

  if (
    column === "VOUCHER NO." ||
    column === "VOUCHER NO" ||
    column === "VOUCHERNUMBER"
  ) {
    /*
     * We can only write a voucher number when a real
     * suggested/corrected value is available.
     *
     * We intentionally do NOT invent voucher numbers.
     */
    if (suggestedValue) {
      row["VOUCHER NO."] = suggestedValue;

      return {
        changed: true,
        value: suggestedValue,
      };
    }

    return {
      changed: false,
      message: "No actual voucher number was supplied for this issue.",
    };
  }

  /* -------------------------------------------------------
     BY-DR / PARTY LEDGER
  ------------------------------------------------------- */

  if (column === "BY-DR" || column === "PARTYLEDGERNAME") {
    if (suggestedValue) {
      row["BY-DR"] = suggestedValue;

      return {
        changed: true,
        value: suggestedValue,
      };
    }

    return {
      changed: false,
      message: "No actual ledger value was supplied for this issue.",
    };
  }

  /* -------------------------------------------------------
     GSTIN
  ------------------------------------------------------- */

  if (column === "GSTIN") {
    if (suggestedValue) {
      row.GSTIN = suggestedValue;

      return {
        changed: true,
        value: suggestedValue,
      };
    }

    return {
      changed: false,
      message: "No actual GSTIN was supplied for this issue.",
    };
  }

  /* -------------------------------------------------------
     GENERIC SUGGESTED VALUE
  ------------------------------------------------------- */

  if (suggestedValue) {
    row[column] = suggestedValue;

    return {
      changed: true,
      value: suggestedValue,
    };
  }

  return {
    changed: false,
    message: "No concrete fix value was available.",
  };
};

/* =========================================================
   REPORT CALCULATION
========================================================= */

async function report(validation) {
  const stats = summary(validation.issues, validation.checked);

  validation.score = stats.score;

  validation.valid = stats.valid;

  validation.errors = stats.errors;

  validation.warnings = stats.warnings;

  validation.status = stats.errors ? "needs_review" : "validated";

  return stats;
}

/* =========================================================
   VALIDATE
========================================================= */

exports.validate = async (req, res, next) => {
  try {
    const upload = await Upload.findOne({
      _id: req.params.uploadId,
      user: req.user._id,
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
      user: req.user._id,

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

    upload.errors = stats.errors;

    upload.warnings = stats.warnings;

    upload.status = "validated";

    await upload.save();

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

/* =========================================================
   GET VALIDATION
========================================================= */

exports.get = async (req, res, next) => {
  try {
    const validation = await Validation.findOne({
      _id: req.params.validationId,

      ...(req.user.role === "admin"
        ? {}
        : {
            user: req.user._id,
          }),
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

/* =========================================================
   AUTO FIX
========================================================= */

exports.autoFix = async (req, res, next) => {
  try {
    const validation = await Validation.findOne({
      _id: req.params.validationId,

      ...(req.user.role === "admin"
        ? {}
        : {
            user: req.user._id,
          }),
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

      ...(req.user.role === "admin"
        ? {}
        : {
            user: req.user._id,
          }),
    });

    /*
     * First use the existing safe-fix service.
     */
    validation.issues = applySafeFixes(validation.issues);

    /*
     * Then synchronize every issue marked fixed
     * with the real Upload.dataRows.
     */
    if (upload && Array.isArray(validation.issues)) {
      for (const issue of validation.issues) {
        if (issue.status === "fixed") {
          applyIssueToUpload(upload, issue);
        }
      }

      await upload.save();
    }

    const stats = await report(validation);

    await validation.save();

    return res.json({
      success: true,

      ...stats,

      issues: validation.issues,
    });
  } catch (error) {
    next(error);
  }
};

/* =========================================================
   FIX INDIVIDUAL ISSUE
========================================================= */

exports.fixIssue = async (req, res, next) => {
  try {
    const validation = await Validation.findOne({
      _id: req.params.validationId,

      ...(req.user.role === "admin"
        ? {}
        : {
            user: req.user._id,
          }),
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

      ...(req.user.role === "admin"
        ? {}
        : {
            user: req.user._id,
          }),
    });

    if (!upload) {
      return res.status(404).json({
        success: false,
        message: "Original upload not found",
        code: "UPLOAD_NOT_FOUND",
      });
    }

    /*
     * Apply the actual fix to the source row first.
     */
    const result = applyIssueToUpload(upload, item);

    /*
     * Only mark fixed when we were able to make
     * a real change OR the issue is a purely
     * validation-state issue that has a concrete
     * corrected value.
     */
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

    item.status = "fixed";

    item.currentValue = result.value;

    /*
     * Clear the issue message after a successful
     * correction so the UI reflects the fixed state.
     */
    item.issue = item.issue || item.message || "Validation issue";

    await upload.save();

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

/* =========================================================
   APPLY RECOMMENDATION
========================================================= */

exports.apply = async (req, res, next) => {
  /*
   * Apply recommendation uses the exact same
   * source-row synchronization as Fix.
   */
  req.body = {
    ...req.body,
    action: "apply",
  };

  return exports.fixIssue(req, res, next);
};

/* =========================================================
   IGNORE ISSUE
========================================================= */

exports.ignore = async (req, res, next) => {
  try {
    const validation = await Validation.findOne({
      _id: req.params.validationId,

      ...(req.user.role === "admin"
        ? {}
        : {
            user: req.user._id,
          }),
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

/* =========================================================
   REVALIDATE
========================================================= */

exports.revalidate = async (req, res, next) => {
  try {
    const validation = await Validation.findOne({
      _id: req.params.validationId,

      ...(req.user.role === "admin"
        ? {}
        : {
            user: req.user._id,
          }),
    });

    if (!validation) {
      return res.status(404).json({
        success: false,
        message: "Validation not found",
        code: "NOT_FOUND",
      });
    }

    /*
     * IMPORTANT:
     * Re-read the actual corrected source rows from
     * Upload.dataRows. This means validation is now
     * checking the same data that XML generation uses.
     */
    const upload = await Upload.findOne({
      _id: validation.upload,

      ...(req.user.role === "admin"
        ? {}
        : {
            user: req.user._id,
          }),
    });

    if (!upload) {
      return res.status(404).json({
        success: false,
        message: "Original upload not found",
        code: "UPLOAD_NOT_FOUND",
      });
    }

    /*
     * Run the validation engine AGAIN against
     * the corrected Upload.dataRows.
     */
    const freshIssues = validateRows(upload.dataRows, upload.voucherType);

    /*
     * Preserve the current issue states where possible,
     * but replace validation findings with the fresh
     * results from the corrected data.
     */
    const oldIssues = Array.isArray(validation.issues) ? validation.issues : [];

    const oldByKey = new Map(
      oldIssues.map((issue) => [`${issue.row}:${issue.column}`, issue]),
    );

    validation.issues = freshIssues.map((freshIssue) => {
      const key = `${freshIssue.row}:${freshIssue.column}`;

      const old = oldByKey.get(key);

      return {
        ...freshIssue,

        /*
         * A fresh issue is pending because
         * the corrected source data still fails.
         */
        status: freshIssue.status || "pending",

        id: old?.id || freshIssue.id,
      };
    });

    /*
     * Any issues that no longer exist in fresh
     * validation are removed from the blocking list.
     */

    const stats = await report(validation);

    validation.checked = upload.rows;

    await validation.save();

    await ValidationReport.create({
      user: req.user._id,

      validation: validation._id,

      fileName: upload.originalName,

      ...stats,

      status: validation.status,
    });

    upload.errors = stats.errors;

    upload.warnings = stats.warnings;

    upload.status = "validated";

    await upload.save();

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
