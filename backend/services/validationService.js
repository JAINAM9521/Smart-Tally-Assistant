"use strict";

const Fuse = require("fuse.js");

const ledgers = [
  "Sales A/c",
  "Purchase A/c",
  "Cash A/c",
  "Bank A/c",
  "Customer A/c",
  "Output CGST A/c",
  "Output SGST A/c",
];

const required = ["DATE", "BY-DR", "TO-CR", "AMOUNT", "VOUCHER NO."];

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

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

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

function normalizeAmount(value) {
  const text = String(value ?? "")
    .trim()
    .replace(/[₹$€£,\s]/g, "");

  if (!text || !/^\d+(?:\.\d+)?$/.test(text)) return null;

  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? String(number) : null;
}

function isValidCalendarDate(day, month, year) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function formatDate(day, month, year) {
  if (!isValidCalendarDate(day, month, year)) return null;
  return `${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}-${year}`;
}

function validDate(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return false;
  return isValidCalendarDate(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  );
}

function normalizeDate(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) {
    return formatDate(Number(iso[3]), Number(iso[2]), Number(iso[1]));
  }

  const match = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (!match) return null;

  return formatDate(Number(match[1]), Number(match[2]), Number(match[3]));
}

function normalizeLedger(value) {
  return String(value ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\u200B/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function findCanonicalLedger(value) {
  const normalized = normalizeLedger(value);
  if (!normalized) return null;
  return (
    ledgers.find((ledger) => normalizeLedger(ledger) === normalized) || null
  );
}

function suggestLedger(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;

  const canonical = findCanonicalLedger(trimmed);
  if (canonical) return canonical;

  const fuse = new Fuse(ledgers, { includeScore: true, threshold: 0.45 });
  const match = fuse.search(trimmed)[0];
  return match?.item || null;
}

function validateLedgerColumn(row, rowNumber, column, issues) {
  const ledger = String(row?.[column] ?? "").trim();
  if (!ledger) return;

  const canonicalLedger = findCanonicalLedger(ledger);

  if (canonicalLedger && canonicalLedger !== ledger) {
    issues.push(
      issue(
        rowNumber,
        column,
        ledger,
        "Ledger name formatting should match the Tally ledger",
        "warning",
        `Use ${canonicalLedger}.`,
        true,
      ),
    );
    return;
  }

  if (!canonicalLedger) {
    const suggested = suggestLedger(ledger);
    issues.push(
      issue(
        rowNumber,
        column,
        ledger,
        "Ledger name does not exactly match",
        "warning",
        suggested ? `Use ${suggested}.` : "Use an exact Tally ledger name.",
        Boolean(suggested),
      ),
    );
  }
}

function validateRows(rows, voucherType) {
  const issues = [];

  if (!Array.isArray(rows) || rows.length === 0) {
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

  if (!supportedVoucherTypes.includes(String(voucherType || ""))) {
    issues.push(
      issue(
        2,
        "VOUCHER TYPE",
        voucherType || "",
        "Invalid voucher type",
        "error",
        "Select a supported voucher type.",
        false,
      ),
    );
  }

  const invoiceSeen = new Map();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;

    for (const column of required) {
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
    }

    const rawAmount = row?.AMOUNT;
    const amountText = String(rawAmount ?? "").trim();
    if (amountText) {
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
            false,
          ),
        );
      } else if (amountText !== amount) {
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
    }

    const rawDate = row?.DATE;
    const dateText = String(rawDate ?? "").trim();
    if (dateText && !validDate(dateText)) {
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

    validateLedgerColumn(row, rowNumber, "TO-CR", issues);
    validateLedgerColumn(row, rowNumber, "BY-DR", issues);

    const voucher = String(row?.["VOUCHER NO."] ?? "").trim();
    const dateKey = String(row?.DATE ?? "").trim();
    if (voucher) {
      const duplicateKey = `${voucher}|${dateKey}|${String(voucherType || "")}`;
      if (invoiceSeen.has(duplicateKey)) {
        issues.push(
          issue(
            rowNumber,
            "VOUCHER NO.",
            voucher,
            "Duplicate voucher number",
            "error",
            `Duplicate found on row ${invoiceSeen.get(duplicateKey)}.`,
            false,
          ),
        );
      } else {
        invoiceSeen.set(duplicateKey, rowNumber);
      }
    }

    const gstinRaw = String(row?.GSTIN ?? "").trim();
    if (gstinRaw) {
      const gstin = gstinRaw.replace(/\s+/g, "").toUpperCase();
      if (GSTIN_PATTERN.test(gstin) && gstin !== gstinRaw) {
        issues.push(
          issue(
            rowNumber,
            "GSTIN",
            gstinRaw,
            "GSTIN formatting can be normalized",
            "warning",
            `Use ${gstin}.`,
            true,
          ),
        );
      } else if (!GSTIN_PATTERN.test(gstin)) {
        issues.push(
          issue(
            rowNumber,
            "GSTIN",
            gstinRaw,
            "Invalid GSTIN format",
            "error",
            "Enter a valid 15-character GSTIN.",
            false,
          ),
        );
      }
    }

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
  });

  return issues;
}

function summary(issues, totalRows) {
  const allIssues = Array.isArray(issues) ? issues : [];
  const pending = allIssues.filter((item) => item.status === "pending");
  const fixed = allIssues.filter((item) => item.status === "fixed");
  const ignored = allIssues.filter((item) => item.status === "ignored");
  const errors = pending.filter((item) => item.severity === "error");
  const warnings = pending.filter((item) => item.severity === "warning");

  const checked = Math.max(0, Number(totalRows) || 0);
  const errorRows = new Set(errors.map((item) => Number(item.row)));
  const valid = Math.max(0, checked - errorRows.size);
  const score = checked === 0 ? 0 : Math.round((valid / checked) * 100);

  return {
    score,
    checked,
    valid,
    errors: errors.length,
    warnings: warnings.length,
    fixed: fixed.length,
    pending: pending.length,
    ignored: ignored.length,
  };
}

module.exports = {
  ledgers,
  required,
  supportedVoucherTypes,
  validateRows,
  summary,
  normalizeAmount,
  validDate,
  normalizeDate,
  normalizeLedger,
  findCanonicalLedger,
  suggestLedger,
};
