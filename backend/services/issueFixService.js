"use strict";

const { normalizeAmount, normalizeDate } = require("./validationService");

function toPlainIssue(issue) {
  if (!issue) return {};
  if (typeof issue.toObject === "function") {
    return issue.toObject();
  }
  return { ...issue };
}

function getDataRowIndex(issueRow, dataRows) {
  const excelRow = Number(issueRow);

  if (!Number.isInteger(excelRow) || excelRow < 2) {
    return -1;
  }

  const primaryIndex = excelRow - 2;

  if (primaryIndex >= 0 && primaryIndex < dataRows.length) {
    return primaryIndex;
  }

  return -1;
}

function getRecommendationValue(issue) {
  const recommendation = String(issue?.recommendation ?? "").trim();
  const match = recommendation.match(/^Use\s+(.+?)\.?$/i);
  if (!match) return "";
  return String(match[1]).trim();
}

function getSuggestedValue(issue) {
  const candidates = [
    issue?.suggestedValue,
    issue?.correctedValue,
    issue?.fixValue,
    issue?.value,
    getRecommendationValue(issue),
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
}

function canonicalColumn(column) {
  const value = String(column || "").trim();

  if (value === "VOUCHER NO" || value === "VOUCHERNUMBER") {
    return "VOUCHER NO.";
  }

  if (value === "PARTYLEDGERNAME" || value === "PARTY LEDGER") {
    return "BY-DR";
  }

  return value;
}

function applyIssueToUpload(upload, issue) {
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

  if (!row || typeof row !== "object") {
    return {
      changed: false,
      message: `Excel row ${issue.row} is invalid.`,
    };
  }

  const column = canonicalColumn(issue.column);
  const suggestedValue = getSuggestedValue(issue);

  if (column === "AMOUNT") {
    const normalized = normalizeAmount(
      suggestedValue || row?.AMOUNT || issue.currentValue,
    );

    if (normalized) {
      row.AMOUNT = normalized;
      return { changed: true, value: normalized, column };
    }

    return { changed: false, message: "Unable to normalize amount." };
  }

  if (column === "DATE") {
    const normalized = normalizeDate(
      suggestedValue || row?.DATE || issue.currentValue,
    );

    if (normalized) {
      row.DATE = normalized;
      return { changed: true, value: normalized, column };
    }

    return { changed: false, message: "Unable to normalize date." };
  }

  if (column === "VOUCHER NO.") {
    if (suggestedValue) {
      row["VOUCHER NO."] = suggestedValue;
      return { changed: true, value: suggestedValue, column };
    }

    return {
      changed: false,
      message: "No actual voucher number was supplied for this issue.",
    };
  }

  if (column === "BY-DR") {
    if (suggestedValue) {
      row["BY-DR"] = suggestedValue;
      return { changed: true, value: suggestedValue, column };
    }

    return {
      changed: false,
      message: "No actual ledger value was supplied for this issue.",
    };
  }

  if (column === "TO-CR") {
    if (suggestedValue) {
      row["TO-CR"] = suggestedValue;
      return { changed: true, value: suggestedValue, column };
    }

    return {
      changed: false,
      message: "No actual TO-CR ledger value was supplied for this issue.",
    };
  }

  if (column === "GSTIN") {
    if (suggestedValue) {
      row.GSTIN = suggestedValue.toUpperCase();
      return { changed: true, value: row.GSTIN, column };
    }

    return {
      changed: false,
      message: "No actual GSTIN was supplied for this issue.",
    };
  }

  if (suggestedValue && column) {
    row[column] = suggestedValue;
    return { changed: true, value: suggestedValue, column };
  }

  return {
    changed: false,
    message: "No concrete fix value was available.",
  };
}

function persistVerified(dataRows, change) {
  const rowIndex = getDataRowIndex(change.row, dataRows);
  const savedRow = rowIndex >= 0 ? dataRows[rowIndex] : null;
  const savedValue = savedRow?.[change.column];
  return String(savedValue ?? "") === String(change.value ?? "");
}

module.exports = {
  toPlainIssue,
  getDataRowIndex,
  getRecommendationValue,
  getSuggestedValue,
  canonicalColumn,
  applyIssueToUpload,
  persistVerified,
};
