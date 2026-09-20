"use strict";

const Fuse = require("fuse.js");

/* =========================================================
   TALLY LEDGERS
========================================================= */

const ledgers = [
  "Sales A/c",
  "Purchase A/c",
  "Cash A/c",
  "Bank A/c",
  "Customer A/c",
  "Output CGST A/c",
  "Output SGST A/c",
];

/* =========================================================
   REQUIRED COLUMNS
========================================================= */

const required = ["DATE", "BY-DR", "TO-CR", "AMOUNT", "VOUCHER NO."];

/* =========================================================
   SUPPORTED VOUCHER TYPES
========================================================= */

const supportedVoucherTypes = [
  "Sales",
  "Purchase",
  "Payment",
  "Receipt",
  "Contra",
  "Journal",
  "Credit Note",
  "Debit Note",
];

/* =========================================================
   ISSUE HELPER
========================================================= */

function issue(
  row,
  column,
  currentValue,
  message,
  severity = "error",
  recommendation = "Review this value.",
  autoFixable = false,
) {
  return {
    id: `${row}-${column}`,
    row,
    column,
    currentValue,
    issue: message,
    severity,
    recommendation,
    status: "pending",
    autoFixable,
  };
}

/* =========================================================
   NORMALIZE AMOUNT
========================================================= */

/*
 * Examples:
 *
 * 10000       -> "10000"
 * 10000.50    -> "10000.5"
 * 10,000      -> "10000"
 * ₹10,000     -> "10000"
 * $10,000     -> "10000"
 * 10 000      -> "10000"
 */

function normalizeAmount(value) {
  const text = String(value ?? "").trim();

  if (!text) {
    return null;
  }

  const cleaned = text.replace(/[₹$€£,\s]/g, "");

  if (!/^\d+(?:\.\d+)?$/.test(cleaned)) {
    return null;
  }

  const number = Number(cleaned);

  if (!Number.isFinite(number)) {
    return null;
  }

  return String(number);
}

/* =========================================================
   DATE VALIDATION
========================================================= */

/*
 * Valid format:
 *
 * DD-MM-YYYY
 */

function validDate(value) {
  return /^\d{2}-\d{2}-\d{4}$/.test(String(value ?? "").trim());
}

/* =========================================================
   DATE NORMALIZATION
========================================================= */

/*
 * Examples:
 *
 * 26/08/2026 -> 26-08-2026
 * 26.08.2026 -> 26-08-2026
 * 6/8/2026   -> 06-08-2026
 */

function normalizeDate(value) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  const match = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = match[3];

  if (day < 1 || day > 31) {
    return null;
  }

  if (month < 1 || month > 12) {
    return null;
  }

  return `${String(day).padStart(2, "0")}-${String(month).padStart(
    2,
    "0",
  )}-${year}`;
}

/* =========================================================
   LEDGER NORMALIZATION
========================================================= */

/*
 * This is important for Excel data.
 *
 * It handles:
 *
 * Sales A/c
 * Sales  A/c
 * Sales A/c
 * Sales A/c
 * Sales A/c
 *
 * All of them become comparable.
 */

function normalizeLedger(value) {
  return String(value ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/* =========================================================
   FIND EXACT CANONICAL LEDGER
========================================================= */

function findCanonicalLedger(value) {
  const normalized = normalizeLedger(value);

  if (!normalized) {
    return null;
  }

  return (
    ledgers.find((ledger) => normalizeLedger(ledger) === normalized) || null
  );
}

/* =========================================================
   VALIDATE ROWS
========================================================= */

exports.validateRows = (rows, voucherType) => {
  const issues = [];

  const invoiceSeen = new Map();

  const fuse = new Fuse(ledgers, {
    includeScore: true,
    threshold: 0.45,
  });

  /* =======================================================
     INVALID DATA
  ======================================================= */

  if (!Array.isArray(rows)) {
    return [
      issue(
        2,
        "DATA",
        "",
        "No valid data rows were found.",
        "error",
        "Upload an Excel file containing valid transaction rows.",
        false,
      ),
    ];
  }

  /* =======================================================
     PROCESS EACH ROW
  ======================================================= */

  rows.forEach((row, index) => {
    const rowNumber = index + 2;

    /* =====================================================
       REQUIRED FIELDS
    ===================================================== */

    required.forEach((column) => {
      const value = String(row?.[column] ?? "").trim();

      if (!value) {
        issues.push(
          issue(
            rowNumber,
            column,
            "",
            `Missing required ${column}`,
            "error",
            `Enter a value for ${column}.`,
            false,
          ),
        );
      }
    });

    /* =====================================================
       AMOUNT
    ===================================================== */

    const rawAmount = row?.AMOUNT;

    const amount = normalizeAmount(rawAmount);

    if (!amount) {
      issues.push(
        issue(
          rowNumber,
          "AMOUNT",
          rawAmount,
          "Invalid amount format",
          "error",
          "Use a numeric value such as 10000.",
          true,
        ),
      );
    } else if (String(rawAmount ?? "").trim() !== amount) {
      issues.push(
        issue(
          rowNumber,
          "AMOUNT",
          rawAmount,
          "Amount can be normalized",
          "warning",
          `Use ${amount}.`,
          true,
        ),
      );
    }

    /* =====================================================
       DATE
    ===================================================== */

    const rawDate = row?.DATE;

    if (String(rawDate ?? "").trim()) {
      if (!validDate(rawDate)) {
        const normalizedDate = normalizeDate(rawDate);

        issues.push(
          issue(
            rowNumber,
            "DATE",
            rawDate,
            "Invalid date format",
            "error",
            normalizedDate ? `Use ${normalizedDate}.` : "Use DD-MM-YYYY.",
            Boolean(normalizedDate),
          ),
        );
      }
    }

    /* =====================================================
       TO-CR LEDGER
    ===================================================== */

    const ledger = String(row?.["TO-CR"] ?? "").trim();

    /*
     * Check normalized value against
     * canonical Tally ledger names.
     */

    const canonicalLedger = findCanonicalLedger(ledger);

    if (ledger && !canonicalLedger) {
      /*
       * If it doesn't exactly match after
       * normalization, find the closest
       * ledger using Fuse.
       */

      const match = fuse.search(ledger)[0];

      issues.push(
        issue(
          rowNumber,
          "TO-CR",
          ledger,
          "Ledger name does not exactly match",
          "warning",
          match ? `Use ${match.item}.` : "Use an exact Tally ledger name.",
          Boolean(match),
        ),
      );
    }

    /* =====================================================
       VOUCHER NUMBER
    ===================================================== */

    const voucher = String(row?.["VOUCHER NO."] ?? "").trim();

    if (voucher) {
      if (invoiceSeen.has(voucher)) {
        issues.push(
          issue(
            rowNumber,
            "VOUCHER NO.",
            voucher,
            "Duplicate voucher number",
            "error",
            `Duplicate found on row ${invoiceSeen.get(voucher)}.`,
            false,
          ),
        );
      } else {
        invoiceSeen.set(voucher, rowNumber);
      }
    }

    /* =====================================================
       GSTIN
    ===================================================== */

    const gstin = String(row?.GSTIN ?? "")
      .trim()
      .toUpperCase();

    if (gstin && !/^[0-9A-Z]{15}$/.test(gstin)) {
      issues.push(
        issue(
          rowNumber,
          "GSTIN",
          gstin,
          "Invalid GSTIN format",
          "error",
          "Enter a valid 15-character GSTIN.",
          false,
        ),
      );
    }

    /* =====================================================
       REFERENCE NUMBER
    ===================================================== */

    const referenceNumber = String(row?.["REFERENCE NO."] ?? "").trim();

    if (!referenceNumber) {
      issues.push(
        issue(
          rowNumber,
          "REFERENCE NO.",
          "",
          "Missing reference number",
          "warning",
          "Enter a unique reference number.",
          false,
        ),
      );
    }

    /* =====================================================
       VOUCHER TYPE
    ===================================================== */

    if (voucherType && !supportedVoucherTypes.includes(voucherType)) {
      issues.push(
        issue(
          rowNumber,
          "VOUCHER TYPE",
          voucherType,
          "Invalid voucher type",
          "error",
          "Select a supported voucher type.",
          false,
        ),
      );
    }
  });

  return issues;
};

/* =========================================================
   SUMMARY
========================================================= */

/*
 * ERROR   = blocking issue
 * WARNING = non-blocking issue
 *
 * Only pending errors are counted in `errors`.
 */

exports.summary = (issues, totalRows) => {
  const allIssues = Array.isArray(issues) ? issues : [];

  const pending = allIssues.filter((item) => item.status === "pending");

  const fixed = allIssues.filter((item) => item.status === "fixed");

  const ignored = allIssues.filter((item) => item.status === "ignored");

  const errors = pending.filter((item) => item.severity === "error");

  const warnings = pending.filter((item) => item.severity === "warning");

  /* =======================================================
     SCORE
  ======================================================= */

  const score =
    !allIssues.length || !pending.length
      ? 100
      : Math.max(94, 100 - Math.round((pending.length / allIssues.length) * 6));

  /* =======================================================
     RETURN SUMMARY
  ======================================================= */

  return {
    score,

    checked: Number(totalRows) || 0,

    /*
     * Rows without blocking errors.
     */
    valid: (Number(totalRows) || 0) - errors.length,

    /*
     * Blocking errors only.
     */
    errors: errors.length,

    /*
     * Non-blocking warnings.
     */
    warnings: warnings.length,

    /*
     * Successfully fixed issues.
     */
    fixed: fixed.length,

    /*
     * Issues still waiting for action.
     */
    pending: pending.length,

    /*
     * Ignored issues.
     */
    ignored: ignored.length,
  };
};

/* =========================================================
   EXPORT HELPERS
========================================================= */

exports.normalizeAmount = normalizeAmount;

exports.normalizeDate = normalizeDate;

exports.validDate = validDate;

exports.normalizeLedger = normalizeLedger;

exports.findCanonicalLedger = findCanonicalLedger;

exports.supportedVoucherTypes = supportedVoucherTypes;

exports.ledgers = ledgers;
