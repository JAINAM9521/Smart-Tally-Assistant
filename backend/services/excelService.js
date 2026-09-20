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
  ["gstdetails", "GSTIN"],
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
  if (!normalized) return "";
  return aliases.get(normalized) || String(value ?? "").trim();
}

function excelDateToString(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getUTCDate()).padStart(2, "0")}-${String(
      value.getUTCMonth() + 1,
    ).padStart(2, "0")}-${value.getUTCFullYear()}`;
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

  const iso = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) {
    return `${String(Number(iso[3])).padStart(2, "0")}-${String(
      Number(iso[2]),
    ).padStart(2, "0")}-${iso[1]}`;
  }

  const match = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (match) {
    return `${String(Number(match[1])).padStart(2, "0")}-${String(
      Number(match[2]),
    ).padStart(2, "0")}-${match[3]}`;
  }

  return raw;
}

function cellToValue(column, value) {
  if (value === undefined || value === null) return "";
  if (column === "DATE") return excelDateToString(value);
  if (column === "GSTIN") return String(value).trim().toUpperCase();
  if (column === "AMOUNT" && typeof value === "number") {
    return String(value);
  }
  return typeof value === "string" ? value.trim() : value;
}

function isBlankRow(row) {
  return columns.every((column) => String(row?.[column] ?? "").trim() === "");
}

function readWorkbook(filePath) {
  let workbook;

  try {
    workbook = XLSX.readFile(filePath, {
      cellDates: false,
      raw: true,
    });
  } catch {
    const error = new Error(
      "The file could not be read as a valid spreadsheet.",
    );
    error.status = 400;
    error.code = "INVALID_FILE";
    throw error;
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  if (!sheet) {
    const error = new Error("The workbook does not contain a readable worksheet.");
    error.status = 400;
    error.code = "INVALID_FILE";
    throw error;
  }

  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: true,
    blankrows: false,
  });

  if (!matrix.length) {
    const error = new Error("The spreadsheet is empty.");
    error.status = 400;
    error.code = "EMPTY_FILE";
    throw error;
  }

  const headerRow = matrix[0] || [];
  const mappedHeaders = [];
  const seen = new Set();

  for (const header of headerRow) {
    const column = canonicalHeader(header);
    if (!column) {
      mappedHeaders.push("");
      continue;
    }
    if (seen.has(column)) {
      const error = new Error(`Duplicate column "${column}" is not allowed.`);
      error.status = 400;
      error.code = "DUPLICATE_COLUMN";
      throw error;
    }
    seen.add(column);
    mappedHeaders.push(column);
  }

  const detectedColumns = mappedHeaders.filter(Boolean);

  if (!detectedColumns.length) {
    const error = new Error("No recognizable column headers were found.");
    error.status = 400;
    error.code = "MISSING_COLUMNS";
    throw error;
  }

  const rows = [];

  for (const cells of matrix.slice(1)) {
    const row = {};
    mappedHeaders.forEach((column, index) => {
      if (!column) return;
      row[column] = cellToValue(column, cells?.[index]);
    });

    for (const column of columns) {
      if (!(column in row)) row[column] = "";
    }

    if (!isBlankRow(row)) {
      rows.push(row);
    }
  }

  if (!rows.length) {
    const error = new Error("The spreadsheet does not contain any data rows.");
    error.status = 400;
    error.code = "EMPTY_FILE";
    throw error;
  }

  return {
    rows,
    columns: detectedColumns,
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
