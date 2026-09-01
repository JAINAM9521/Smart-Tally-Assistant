const { create } = require("xmlbuilder2");

const { XMLParser } = require("fast-xml-parser");

/* =========================================================
   HELPERS
========================================================= */

/*
 * Convert common date formats to Tally's DDMMYYYY format.
 *
 * Accepted:
 *   DD-MM-YYYY
 *   DD/MM/YYYY
 *   DD.MM.YYYY
 *   DDMMYYYY
 */
function normalizeDate(value) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return "";
  }

  let match = raw.match(/^(\d{2})[-/.](\d{2})[-/.](\d{4})$/);

  if (match) {
    const day = Number(match[1]);

    const month = Number(match[2]);

    const year = Number(match[3]);

    if (
      !Number.isInteger(day) ||
      !Number.isInteger(month) ||
      !Number.isInteger(year)
    ) {
      return "";
    }

    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return "";
    }

    return [
      String(day).padStart(2, "0"),
      String(month).padStart(2, "0"),
      String(year),
    ].join("");
  }

  match = raw.match(/^(\d{2})(\d{2})(\d{4})$/);

  if (match) {
    const day = Number(match[1]);

    const month = Number(match[2]);

    const year = Number(match[3]);

    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return "";
    }

    return raw;
  }

  return "";
}

/*
 * Convert currency-formatted amount to a numeric
 * string suitable for Tally XML.
 *
 * Examples:
 *   "₹12,500" -> "12500"
 *   " 5000 "  -> "5000"
 */
function normalizeAmount(value) {
  const raw = String(value ?? "")
    .trim()
    .replace(/[₹$€£,\s]/g, "");

  if (!raw) {
    return "";
  }

  const number = Number(raw);

  if (!Number.isFinite(number)) {
    return "";
  }

  return String(number);
}

/*
 * Pick voucher number from possible field names.
 */
function getVoucherNumber(row) {
  return String(
    row?.["VOUCHER NO."] ??
      row?.["VOUCHER NO"] ??
      row?.VOUCHERNUMBER ??
      row?.["VOUCHER NUMBER"] ??
      "",
  ).trim();
}

/*
 * Pick party/ledger name.
 */
function getPartyLedger(row) {
  return String(
    row?.["BY-DR"] ?? row?.BY_DR ?? row?.PARTYLEDGERNAME ?? "",
  ).trim();
}

/*
 * Validate rows before XML generation.
 *
 * This deliberately does not invent missing accounting
 * information. A missing voucher number remains an error.
 */
function validateRowsForXml(rows, voucherType) {
  const issues = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 1;

    const date = normalizeDate(row?.DATE);

    if (!date) {
      issues.push({
        row: rowNumber,
        column: "DATE",
        message: "Invalid or missing date.",
      });
    }

    const amount = normalizeAmount(row?.AMOUNT);

    if (!amount) {
      issues.push({
        row: rowNumber,
        column: "AMOUNT",
        message: "Invalid or missing amount.",
      });
    }

    const voucherNumber = getVoucherNumber(row);

    if (!voucherNumber) {
      issues.push({
        row: rowNumber,
        column: "VOUCHER NO.",
        message: "Missing voucher number.",
      });
    }

    const partyLedger = getPartyLedger(row);

    if (!partyLedger) {
      issues.push({
        row: rowNumber,
        column: "BY-DR",
        message: "Missing party/ledger name.",
      });
    }

    if (!String(voucherType ?? "").trim()) {
      issues.push({
        row: rowNumber,
        column: "VOUCHER TYPE",
        message: "Voucher type is missing.",
      });
    }
  });

  return {
    valid: issues.length === 0,

    issues,
  };
}

/* =========================================================
   BUILD XML
========================================================= */

function buildXml({ voucherType, rows }) {
  const root = create({
    version: "1.0",
    encoding: "UTF-8",
  })
    .ele("ENVELOPE")
    .ele("HEADER")
    .ele("TALLYREQUEST")
    .txt("Import")
    .up()
    .ele("TYPE")
    .txt("Data")
    .up()
    .ele("ID")
    .txt("Vouchers")
    .up()
    .up()
    .ele("BODY")
    .ele("IMPORTDATA")
    .ele("REQUESTDESC")
    .ele("REPORTNAME")
    .txt("Vouchers")
    .up()
    .up()
    .up()
    .ele("REQUESTDATA");

  rows.forEach((row) => {
    const date = normalizeDate(row?.DATE);

    const voucherNumber = getVoucherNumber(row);

    const partyLedger = getPartyLedger(row);

    const amount = normalizeAmount(row?.AMOUNT);

    const narration = String(row?.NARRATION ?? row?.Narration ?? "").trim();

    const voucher = root.ele("TALLYMESSAGE").ele("VOUCHER", {
      VCHTYPE: String(voucherType || ""),
      ACTION: "Create",
    });

    voucher.ele("DATE").txt(date).up();

    voucher.ele("VOUCHERNUMBER").txt(voucherNumber).up();

    voucher.ele("PARTYLEDGERNAME").txt(partyLedger).up();

    voucher.ele("AMOUNT").txt(amount).up();

    voucher.ele("NARRATION").txt(narration).up();

    voucher.up().up().up();
  });

  return root.end({
    prettyPrint: true,
  });
}

/* =========================================================
   XML STRUCTURAL VALIDATION
========================================================= */

function validateXml(xml) {
  try {
    const parsed = new XMLParser({
      ignoreAttributes: false,
    }).parse(xml);

    return Boolean(
      parsed?.ENVELOPE?.HEADER &&
      parsed?.ENVELOPE?.BODY &&
      parsed?.ENVELOPE?.BODY?.IMPORTDATA !== undefined &&
      parsed?.ENVELOPE?.BODY?.REQUESTDATA !== undefined,
    );
  } catch {
    return false;
  }
}

/* =========================================================
   EXPORT
========================================================= */

module.exports = {
  buildXml,
  validateXml,
  validateRowsForXml,
  normalizeDate,
  normalizeAmount,
};
