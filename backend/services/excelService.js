"use strict";

const XLSX = require("xlsx");

const columns = [
  "DATE",
  "BY-DR",
  "TO-CR",
  "AMOUNT",
  "VOUCHER NO.",
  "GSTIN",
  "NARRATION",
  "REFERENCE NO.",
];

const aliases = new Map([
  ["date", "DATE"],
  ["by-dr", "BY-DR"],
  ["by dr", "BY-DR"],
  ["by/dr", "BY-DR"],
  ["debit", "BY-DR"],
  ["debit ledger", "BY-DR"],
  ["party ledger", "BY-DR"],
  ["partyledgername", "BY-DR"],
  ["to-cr", "TO-CR"],
  ["to cr", "TO-CR"],
  ["to/cr", "TO-CR"],
  ["credit", "TO-CR"],
  ["credit ledger", "TO-CR"],
  ["amount", "AMOUNT"],
  ["voucher no", "VOUCHER NO."],
  ["voucher no.", "VOUCHER NO."],
  ["voucher number", "VOUCHER NO."],
  ["vouchernumber", "VOUCHER NO."],
  ["gstin", "GSTIN"],
  ["gst details", "GSTIN"],
  ["narration", "NARRATION"],
  ["reference no", "REFERENCE NO."],
  ["reference no.", "REFERENCE NO."],
  ["reference number", "REFERENCE NO."],
]);

function normalizeHeader(value) {
  return String(value ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function canonicalHeader(value) {
  const normalized = normalizeHeader(value);
  return aliases.get(normalized) || String(value ?? "").trim();
}

function excelDateToString(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getDate()).padStart(2, "0")}-${String(
      value.getMonth() + 1,
    ).padStart(2, "0")}-${value.getFullYear()}`;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const utc = XLSX.SSF.parse_date_code(value);
    if (utc?.y && utc?.m && utc?.d) {
      return `${String(utc.d).padStart(2, "0")}-${String(utc.m).padStart(
        2,
        "0",
      )}-${utc.y}`;
    }
  }

  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const match = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (match) {
    return `${String(Number(match[1])).padStart(2, "0")}-${String(
      Number(match[2]),
    ).padStart(2, "0")}-${match[3]}`;
  }

  return raw;
}

function normalizeRow(row) {
  const normalized = {};

  for (const [key, value] of Object.entries(row || {})) {
    const column = canonicalHeader(key);
    normalized[column] = column === "DATE" ? excelDateToString(value) : value;
  }

  for (const column of columns) {
    if (!(column in normalized)) normalized[column] = "";
  }

  if (normalized.GSTIN) {
    normalized.GSTIN = String(normalized.GSTIN).trim().toUpperCase();
  }

  return normalized;
}

function readWorkbook(filePath) {
  const workbook = XLSX.readFile(filePath, {
    cellDates: true,
    raw: true,
  });

  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  if (!sheet) {
    throw new Error("The workbook does not contain a readable worksheet.");
  }

  const rawRows = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: true,
  });

  const rows = rawRows.map(normalizeRow);

  const rawHeader =
    XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: true,
    })[0] || [];

  const detectedColumns = rawHeader.map(canonicalHeader).filter(Boolean);

  return {
    rows,
    columns: detectedColumns.length ? detectedColumns : columns,
  };
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv() {
  const rows = [
    [...columns],
    [
      "01-08-2026",
      "Customer A/c",
      "Sales A/c",
      "10000",
      "INV-101",
      "27ABCDE1234F1Z5",
      "August sales transaction",
      "REF-101",
    ],
  ];

  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

exports.templateColumns = columns;
exports.readWorkbook = readWorkbook;
exports.toCsv = toCsv;
exports.canonicalHeader = canonicalHeader;
exports.excelDateToString = excelDateToString;
