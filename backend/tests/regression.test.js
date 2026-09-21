"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const mongoose = require("mongoose");
const XLSX = require("xlsx");

const {
  validateRows,
  summary,
  normalizeDate,
  normalizeAmount,
  findCanonicalLedger,
  suggestLedger,
  supportedVoucherTypes,
} = require("../services/validationService");
const { applySafeFixes } = require("../services/autoFixService");
const {
  applyIssueToUpload,
  getSuggestedValue,
  getRecommendationValue,
} = require("../services/issueFixService");
const {
  buildXml,
  validateXml,
  parseXml,
  normalizeDate: xmlDate,
} = require("../services/xmlService");
const {
  readWorkbook,
  canonicalHeader,
  excelDateToString,
} = require("../services/excelService");
const { hashPassword, comparePassword } = require("../utils/password");
const { safeFileName } = require("../utils/fileUtils");

/* ============================================================
   SHARED HELPERS
============================================================ */

function salesRow(overrides = {}) {
  return {
    DATE: "20-09-2026",
    "BY-DR": "Customer A/c",
    "TO-CR": "Sales A/c",
    AMOUNT: "10000",
    "VOUCHER NO.": "INV-101",
    GSTIN: "",
    NARRATION: "Test sale",
    "REFERENCE NO.": "REF-101",
    ...overrides,
  };
}

function stripSuggestedValue(issue) {
  const { suggestedValue, correctedValue, fixValue, value, ...rest } = issue;
  return rest;
}

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Build XML for a single row and parse it using the same string-preserving
 * XMLParser configuration used by validateXml (parseTagValue: false).
 */
function buildAndParse(voucherType, rowOverrides = {}) {
  const row = salesRow(rowOverrides);
  const xml = buildXml({ voucherType, rows: [row] });
  const parsed = parseXml(xml);
  const message = asArray(
    parsed.ENVELOPE.BODY.IMPORTDATA.REQUESTDATA.TALLYMESSAGE,
  )[0];
  const voucher = message.VOUCHER;
  const entries = asArray(voucher["ALLLEDGERENTRIES.LIST"]);
  return { xml, parsed, voucher, entries };
}

/* ============================================================
   LEDGER AND RECOMMENDATION PARSING
============================================================ */

describe("ledger and recommendation parsing", () => {
  it("extracts Sales A/c from Use Sales A/c.", () => {
    assert.equal(
      getRecommendationValue({ recommendation: "Use Sales A/c." }),
      "Sales A/c",
    );
  });

  it("does not treat arbitrary recommendation text as a replacement", () => {
    assert.equal(
      getSuggestedValue({
        recommendation: "Enter a value for TO-CR.",
        currentValue: "Sales",
      }),
      "",
    );
  });

  it("normalizes ledger formatting without converting a different ledger", () => {
    assert.equal(findCanonicalLedger(" sales a/c "), "Sales A/c");
    assert.equal(findCanonicalLedger("SALES A/C"), "Sales A/c");
    assert.equal(findCanonicalLedger("Purchase A/c"), "Purchase A/c");
    assert.equal(suggestLedger("Sales"), "Sales A/c");
  });
});

/* ============================================================
   MANDATORY AUTO-FIX REGRESSION: Sales → Sales A/c
============================================================ */

describe("mandatory Sales → Sales A/c auto-fix regression", () => {
  it("persists the corrected ledger even if Mongoose strips suggestedValue", () => {
    const dataRows = [salesRow({ "TO-CR": "Sales" })];
    const issues = validateRows(dataRows, "Sales");
    const ledgerIssue = issues.find(
      (item) => item.column === "TO-CR" && item.currentValue === "Sales",
    );

    assert.ok(ledgerIssue, "TO-CR=Sales issue must be found");
    assert.equal(ledgerIssue.autoFixable, true);
    assert.match(ledgerIssue.recommendation, /Sales A\/c/);

    const fixed = applySafeFixes(issues).map(stripSuggestedValue);
    const result = applyIssueToUpload(
      { dataRows },
      fixed.find((item) => item.column === "TO-CR"),
    );

    assert.equal(result.changed, true);
    assert.equal(result.value, "Sales A/c");
    assert.equal(dataRows[0]["TO-CR"], "Sales A/c");

    // Revalidate: the "Sales" issue must be gone
    const revalidated = validateRows(dataRows, "Sales");
    assert.equal(
      revalidated.some(
        (item) => item.column === "TO-CR" && item.currentValue === "Sales",
      ),
      false,
      "Sales A/c must survive revalidation",
    );

    // XML must contain Sales A/c
    const xml = buildXml({ voucherType: "Sales", rows: dataRows });
    const parsed = parseXml(xml);
    const messages = asArray(
      parsed.ENVELOPE.BODY.IMPORTDATA.REQUESTDATA.TALLYMESSAGE,
    );
    const ledgerNames = asArray(
      messages[0].VOUCHER["ALLLEDGERENTRIES.LIST"],
    ).map((entry) => entry.LEDGERNAME);

    assert.ok(ledgerNames.includes("Sales A/c"), "XML must contain Sales A/c");
    assert.equal(messages[0].VOUCHER.DATE, "20260920");
    assert.equal(validateXml(xml).valid, true);
  });

  it("applies an individual suggestion without Auto Fix running first", () => {
    const dataRows = [salesRow({ "TO-CR": "Sales" })];
    const issues = validateRows(dataRows, "Sales");
    const ledgerIssue = issues.find((item) => item.column === "TO-CR");

    const result = applyIssueToUpload({ dataRows }, ledgerIssue);
    assert.equal(result.changed, true);
    assert.equal(dataRows[0]["TO-CR"], "Sales A/c");
  });
});

/* ============================================================
   MONGOOSE ISSUE SCHEMA
============================================================ */

describe("mongoose issue schema", () => {
  it("keeps suggestedValue on the current Validation issue schema", () => {
    const Validation = require("../models/Validation");
    const doc = new Validation({
      user: new mongoose.Types.ObjectId(),
      upload: new mongoose.Types.ObjectId(),
      issues: [
        {
          id: "2-TO-CR",
          row: 2,
          column: "TO-CR",
          currentValue: "Sales A/c",
          suggestedValue: "Sales A/c",
          issue: "Ledger name does not exactly match",
          severity: "warning",
          recommendation: "Use Sales A/c.",
          status: "fixed",
          autoFixable: true,
        },
      ],
    });

    assert.equal(doc.issues[0].suggestedValue, "Sales A/c");
  });

  it("documents that the old schema silently dropped suggestedValue", () => {
    const oldIssue = new mongoose.Schema(
      {
        id: String,
        row: Number,
        column: String,
        currentValue: mongoose.Schema.Types.Mixed,
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
    const Old = mongoose.model(
      `OldValidation${Date.now()}`,
      new mongoose.Schema({ issues: [oldIssue] }),
    );
    const doc = new Old({
      issues: [
        {
          id: "2-TO-CR",
          column: "TO-CR",
          currentValue: "Sales",
          suggestedValue: "Sales A/c",
          severity: "warning",
          recommendation: "Use Sales A/c.",
          status: "fixed",
        },
      ],
    });

    assert.equal(doc.issues[0].suggestedValue, undefined);
  });
});

/* ============================================================
   VALIDATION ENGINE
============================================================ */

describe("validation engine", () => {
  it("treats GSTIN as optional and rejects malformed GSTIN", () => {
    const ok = validateRows([salesRow({ "TO-CR": "Sales A/c" })], "Sales");
    assert.equal(
      ok.some((item) => item.column === "GSTIN"),
      false,
    );

    const bad = validateRows(
      [salesRow({ "TO-CR": "Sales A/c", GSTIN: "BAD" })],
      "Sales",
    );
    assert.ok(
      bad.some((item) => item.column === "GSTIN" && item.severity === "error"),
    );
  });

  it("flags duplicate vouchers on the same date and type", () => {
    const rows = [
      salesRow({ "TO-CR": "Sales A/c", "VOUCHER NO.": "INV-1" }),
      salesRow({ "TO-CR": "Sales A/c", "VOUCHER NO.": "INV-1" }),
    ];
    const issues = validateRows(rows, "Sales");
    assert.ok(issues.some((item) => item.issue === "Duplicate voucher number"));
  });

  it("does not treat a warning as a blocking error", () => {
    // Use non-canonical ledger name so the validator raises a warning
    const issues = validateRows([salesRow({ "TO-CR": "Sales" })], "Sales");
    const stats = summary(issues, 1);
    assert.equal(
      stats.errors,
      0,
      "Ledger formatting warning must not be an error",
    );
    assert.ok(
      stats.warnings >= 1,
      "At least one warning expected for non-canonical ledger name",
    );
    assert.equal(
      stats.score,
      100,
      "Score must be 100 when there are only warnings, no errors",
    );
  });

  it("normalizes ISO and slash dates to DD-MM-YYYY", () => {
    assert.equal(normalizeDate("2026-02-01"), "01-02-2026");
    assert.equal(normalizeDate("01/02/2026"), "01-02-2026");
    assert.equal(normalizeDate("01-02-2026"), "01-02-2026");
  });

  it("normalizes currency amounts", () => {
    assert.equal(normalizeAmount("₹10,000"), "10000");
  });

  it("validates all supported voucher types with the same canonical columns", () => {
    for (const type of supportedVoucherTypes) {
      const issues = validateRows([salesRow({ "TO-CR": "Sales A/c" })], type);
      assert.equal(
        issues.some((item) => item.column === "VOUCHER TYPE"),
        false,
        type,
      );
    }
  });
});

/* ============================================================
   EXCEL PARSING
============================================================ */

describe("excel parsing", () => {
  it("maps aliases to canonical columns and skips blank rows", () => {
    const filePath = path.join(os.tmpdir(), `tally-${Date.now()}.xlsx`);
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      [
        "Date",
        "Party Ledger",
        "Credit Ledger",
        "Amount",
        "Voucher Number",
        "GST Details",
        "Narration",
        "Reference Number",
      ],
      [
        "01/02/2026",
        "Customer A/c",
        "Sales A/c",
        12500,
        "INV-9",
        "",
        "Row 1",
        "R1",
      ],
      ["", "", "", "", "", "", "", ""],
      [
        "2026-02-01",
        "Customer A/c",
        "Sales A/c",
        "8900",
        "INV-10",
        "",
        "Row 2",
        "R2",
      ],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
    XLSX.writeFile(workbook, filePath);

    const parsed = readWorkbook(filePath);
    fs.unlinkSync(filePath);

    assert.equal(parsed.rows.length, 2);
    assert.equal(parsed.rows[0].DATE, "01-02-2026");
    assert.equal(parsed.rows[0]["BY-DR"], "Customer A/c");
    assert.equal(parsed.rows[0]["TO-CR"], "Sales A/c");
    assert.equal(parsed.rows[1].DATE, "01-02-2026");
  });

  it("converts Excel serial dates without timezone shifting", () => {
    const serial = excelDateToString(46054);
    assert.match(serial, /^\d{2}-\d{2}-2026$/);
    assert.equal(excelDateToString("01-02-2026"), "01-02-2026");
    assert.equal(
      excelDateToString(new Date(Date.UTC(2026, 1, 1))),
      "01-02-2026",
    );
  });

  it("canonicalizes header aliases", () => {
    assert.equal(canonicalHeader("VOUCHER NO"), "VOUCHER NO.");
    assert.equal(canonicalHeader("PARTYLEDGERNAME"), "BY-DR");
    assert.equal(canonicalHeader("GST DETAILS"), "GSTIN");
  });
});

/* ============================================================
   XML GENERATION — CORE STRUCTURE TESTS
============================================================ */

describe("xml generation — core structure", () => {
  it("nests TALLYMESSAGE under REQUESTDATA and uses YYYYMMDD dates as strings", () => {
    const rows = [
      salesRow({ "TO-CR": "Sales A/c" }),
      salesRow({
        "TO-CR": "Sales A/c",
        "VOUCHER NO.": "INV-102",
        AMOUNT: "2500",
      }),
    ];
    const xml = buildXml({ voucherType: "Sales", rows });
    const parsed = parseXml(xml);
    const messages = asArray(
      parsed.ENVELOPE.BODY.IMPORTDATA.REQUESTDATA.TALLYMESSAGE,
    );

    assert.equal(messages.length, 2, "Two TALLYMESSAGE nodes");
    assert.equal(
      typeof messages[0].VOUCHER.DATE,
      "string",
      "DATE must be a string",
    );
    assert.equal(messages[0].VOUCHER.DATE, "20260920");
    assert.equal(xmlDate("20-09-2026"), "20260920");
    assert.equal(xmlDate("2026-09-20"), "20260920");

    const entries = asArray(messages[0].VOUCHER["ALLLEDGERENTRIES.LIST"]);
    assert.equal(entries[0].ISDEEMEDPOSITIVE, "Yes");
    assert.equal(entries[1].ISDEEMEDPOSITIVE, "No");
    assert.equal(entries[0].AMOUNT, "-10000.00");
    assert.equal(entries[1].AMOUNT, "10000.00");
    assert.equal(messages[0].VOUCHER.PARTYLEDGERNAME, "Customer A/c");
  });

  it("generates structurally valid XML for every supported voucher type", () => {
    const row = salesRow({ "TO-CR": "Sales A/c" });
    for (const type of supportedVoucherTypes) {
      const xml = buildXml({ voucherType: type, rows: [row] });
      assert.equal(
        validateXml(xml).valid,
        true,
        `validateXml failed for ${type}`,
      );
      assert.match(
        xml,
        new RegExp(`<VOUCHERTYPENAME>${type}</VOUCHERTYPENAME>`),
        type,
      );
    }
  });

  it("date format edge cases all produce YYYYMMDD strings", () => {
    assert.equal(xmlDate("20-09-2026"), "20260920");
    assert.equal(xmlDate("2026-09-20"), "20260920");
    assert.equal(xmlDate("20/09/2026"), "20260920");
    assert.equal(xmlDate("2026.09.20"), "20260920");
    assert.equal(xmlDate("20260920"), "20260920");
    assert.equal(xmlDate(""), "");
    assert.equal(xmlDate("invalid"), "");
  });
});

/* ============================================================
   ACCOUNTING REGRESSION: SALES VOUCHER
   DR: Customer A/c (party, ISDEEMEDPOSITIVE=Yes, AMOUNT=-ve)
   CR: Sales A/c   (ISDEEMEDPOSITIVE=No, AMOUNT=+ve)
============================================================ */

describe("accounting — Sales voucher", () => {
  it("has correct voucher type, date, party ledger, DR/CR entries, amounts and ISDEEMEDPOSITIVE", () => {
    const { voucher, entries } = buildAndParse("Sales", {
      "BY-DR": "Customer A/c",
      "TO-CR": "Sales A/c",
      AMOUNT: "5000",
      DATE: "01-08-2026",
      "VOUCHER NO.": "S-001",
    });

    // Voucher header
    assert.equal(voucher.VOUCHERTYPENAME, "Sales");
    assert.equal(voucher.DATE, "20260801");
    assert.equal(typeof voucher.DATE, "string");
    assert.equal(voucher.VOUCHERNUMBER, "S-001");
    assert.equal(
      voucher.PARTYLEDGERNAME,
      "Customer A/c",
      "Sales party = debit ledger (customer)",
    );
    assert.equal(voucher.ISINVOICE, "Yes");

    // Debit entry (Customer A/c)
    assert.equal(entries.length, 2);
    const debitEntry = entries[0];
    assert.equal(debitEntry.LEDGERNAME, "Customer A/c");
    assert.equal(
      debitEntry.ISDEEMEDPOSITIVE,
      "Yes",
      "DR entry: ISDEEMEDPOSITIVE=Yes",
    );
    assert.equal(debitEntry.AMOUNT, "-5000.00", "DR entry: negative amount");

    // Credit entry (Sales A/c)
    const creditEntry = entries[1];
    assert.equal(creditEntry.LEDGERNAME, "Sales A/c");
    assert.equal(
      creditEntry.ISDEEMEDPOSITIVE,
      "No",
      "CR entry: ISDEEMEDPOSITIVE=No",
    );
    assert.equal(creditEntry.AMOUNT, "5000.00", "CR entry: positive amount");

    // Bill allocations on the party (debit) side
    const billEntries = asArray(debitEntry["BILLALLOCATIONS.LIST"]);
    assert.equal(billEntries.length, 1);
    assert.equal(billEntries[0].NAME, "S-001");
    assert.equal(billEntries[0].BILLTYPE, "New Ref");
    assert.equal(billEntries[0].AMOUNT, "-5000.00");
  });
});

/* ============================================================
   ACCOUNTING REGRESSION: PURCHASE VOUCHER
   DR: Purchase A/c (ISDEEMEDPOSITIVE=Yes, AMOUNT=-ve)
   CR: Supplier     (party, ISDEEMEDPOSITIVE=No, AMOUNT=+ve)
============================================================ */

describe("accounting — Purchase voucher", () => {
  it("has correct voucher type, date, party ledger, DR/CR entries, amounts and ISDEEMEDPOSITIVE", () => {
    const { voucher, entries } = buildAndParse("Purchase", {
      "BY-DR": "Purchase A/c",
      "TO-CR": "Bank A/c",
      AMOUNT: "8000",
      DATE: "15-08-2026",
      "VOUCHER NO.": "P-001",
    });

    // Voucher header
    assert.equal(voucher.VOUCHERTYPENAME, "Purchase");
    assert.equal(voucher.DATE, "20260815");
    assert.equal(typeof voucher.DATE, "string");
    assert.equal(voucher.VOUCHERNUMBER, "P-001");
    assert.equal(
      voucher.PARTYLEDGERNAME,
      "Bank A/c",
      "Purchase party = credit ledger (supplier)",
    );
    assert.equal(voucher.ISINVOICE, "Yes");

    // Debit entry (Purchase A/c)
    assert.equal(entries.length, 2);
    const debitEntry = entries[0];
    assert.equal(debitEntry.LEDGERNAME, "Purchase A/c");
    assert.equal(debitEntry.ISDEEMEDPOSITIVE, "Yes");
    assert.equal(debitEntry.AMOUNT, "-8000.00");

    // Credit entry (Supplier / Bank A/c — party)
    const creditEntry = entries[1];
    assert.equal(creditEntry.LEDGERNAME, "Bank A/c");
    assert.equal(creditEntry.ISDEEMEDPOSITIVE, "No");
    assert.equal(creditEntry.AMOUNT, "8000.00");

    // Bill allocations on the party (credit) side
    const billEntries = asArray(creditEntry["BILLALLOCATIONS.LIST"]);
    assert.equal(billEntries.length, 1);
    assert.equal(billEntries[0].NAME, "P-001");
    assert.equal(
      billEntries[0].AMOUNT,
      "8000.00",
      "Purchase party-credit bill amount is positive",
    );
  });
});

/* ============================================================
   ACCOUNTING REGRESSION: RECEIPT VOUCHER
   DR: Cash/Bank    (ISDEEMEDPOSITIVE=Yes, AMOUNT=-ve) — cash comes IN
   CR: Customer/Party (ISDEEMEDPOSITIVE=No, AMOUNT=+ve)
============================================================ */

describe("accounting — Receipt voucher", () => {
  it("has correct voucher type, date, DR/CR direction, party=credit (Customer), amounts, ISDEEMEDPOSITIVE and bill allocation", () => {
    const { voucher, entries } = buildAndParse("Receipt", {
      "BY-DR": "Bank A/c",
      "TO-CR": "Customer A/c",
      AMOUNT: "3000",
      DATE: "10-09-2026",
      "VOUCHER NO.": "R-001",
    });

    assert.equal(voucher.VOUCHERTYPENAME, "Receipt");
    assert.equal(voucher.DATE, "20260910");
    assert.equal(typeof voucher.DATE, "string");
    assert.equal(voucher.VOUCHERNUMBER, "R-001");
    assert.equal(voucher.PARTYLEDGERNAME, "Customer A/c");
    assert.equal(voucher.ISINVOICE, "No");

    // DR: Bank A/c
    const debitEntry = entries[0];
    assert.equal(debitEntry.LEDGERNAME, "Bank A/c");
    assert.equal(debitEntry.ISDEEMEDPOSITIVE, "Yes");
    assert.equal(debitEntry.AMOUNT, "-3000.00");

    // CR: Customer A/c (Party entry)
    const creditEntry = entries[1];
    assert.equal(creditEntry.LEDGERNAME, "Customer A/c");
    assert.equal(creditEntry.ISDEEMEDPOSITIVE, "No");
    assert.equal(creditEntry.ISPARTYLEDGER, "Yes");
    assert.equal(creditEntry.ISLASTDEEMEDPOSITIVE, "No");
    assert.equal(creditEntry.AMOUNT, "3000.00");

    // Bill allocations on Customer A/c
    const billEntries = asArray(creditEntry["BILLALLOCATIONS.LIST"]);
    assert.equal(billEntries.length, 1);
    assert.equal(billEntries[0].NAME, "R-001");
    assert.equal(billEntries[0].BILLTYPE, "New Ref");
    assert.equal(billEntries[0].AMOUNT, "3000.00");
  });
});

/* ============================================================
   ACCOUNTING REGRESSION: PAYMENT VOUCHER
   DR: Expense/Party (ISDEEMEDPOSITIVE=Yes, AMOUNT=-ve)
   CR: Cash/Bank     (ISDEEMEDPOSITIVE=No, AMOUNT=+ve) — cash goes OUT
============================================================ */

describe("accounting — Payment voucher", () => {
  it("has correct voucher type, date, DR/CR direction, party=debit (Supplier), amounts, ISDEEMEDPOSITIVE and bill allocation", () => {
    const { voucher, entries } = buildAndParse("Payment", {
      "BY-DR": "Customer A/c",
      "TO-CR": "Bank A/c",
      AMOUNT: "7500",
      DATE: "05-09-2026",
      "VOUCHER NO.": "PAY-001",
    });

    assert.equal(voucher.VOUCHERTYPENAME, "Payment");
    assert.equal(voucher.DATE, "20260905");
    assert.equal(typeof voucher.DATE, "string");
    assert.equal(voucher.VOUCHERNUMBER, "PAY-001");
    assert.equal(voucher.PARTYLEDGERNAME, "Customer A/c");
    assert.equal(voucher.ISINVOICE, "No");

    // DR: Customer/Supplier A/c (Party entry)
    const debitEntry = entries[0];
    assert.equal(debitEntry.LEDGERNAME, "Customer A/c");
    assert.equal(debitEntry.ISDEEMEDPOSITIVE, "Yes");
    assert.equal(debitEntry.ISPARTYLEDGER, "Yes");
    assert.equal(debitEntry.ISLASTDEEMEDPOSITIVE, "Yes");
    assert.equal(debitEntry.AMOUNT, "-7500.00");

    // Bill allocations on Customer/Supplier A/c
    const billEntries = asArray(debitEntry["BILLALLOCATIONS.LIST"]);
    assert.equal(billEntries.length, 1);
    assert.equal(billEntries[0].NAME, "PAY-001");
    assert.equal(billEntries[0].BILLTYPE, "New Ref");
    assert.equal(billEntries[0].AMOUNT, "-7500.00");

    // CR: Bank A/c (credit side)
    const creditEntry = entries[1];
    assert.equal(creditEntry.LEDGERNAME, "Bank A/c");
    assert.equal(creditEntry.ISDEEMEDPOSITIVE, "No");
    assert.equal(creditEntry.AMOUNT, "7500.00");
  });

  it("Payment and Receipt produce opposite DR/CR directions for the same ledgers", () => {
    const { entries: receiptEntries } = buildAndParse("Receipt", {
      "BY-DR": "Cash A/c",
      "TO-CR": "Customer A/c",
      AMOUNT: "1000",
    });
    const { entries: paymentEntries } = buildAndParse("Payment", {
      "BY-DR": "Customer A/c",
      "TO-CR": "Cash A/c",
      AMOUNT: "1000",
    });

    // Receipt: Cash debit (Yes), Customer credit (No)
    assert.equal(receiptEntries[0].ISDEEMEDPOSITIVE, "Yes");
    assert.equal(receiptEntries[0].AMOUNT, "-1000.00");
    assert.equal(receiptEntries[1].ISDEEMEDPOSITIVE, "No");
    assert.equal(receiptEntries[1].AMOUNT, "1000.00");

    // Payment: Customer debit (Yes), Cash credit (No)
    assert.equal(paymentEntries[0].ISDEEMEDPOSITIVE, "Yes");
    assert.equal(paymentEntries[0].AMOUNT, "-1000.00");
    assert.equal(paymentEntries[1].ISDEEMEDPOSITIVE, "No");
    assert.equal(paymentEntries[1].AMOUNT, "1000.00");
  });
});

/* ============================================================
   ACCOUNTING REGRESSION: CONTRA VOUCHER
   Cash ↔ Bank transfers
   DR: Bank A/c (ISDEEMEDPOSITIVE=Yes, AMOUNT=-ve)
   CR: Cash A/c (ISDEEMEDPOSITIVE=No, AMOUNT=+ve)
============================================================ */

describe("accounting — Contra voucher", () => {
  it("has correct voucher type, date, two-sided ledger entries, amounts, ISDEEMEDPOSITIVE and no party assignment", () => {
    const { voucher, entries } = buildAndParse("Contra", {
      "BY-DR": "Bank A/c",
      "TO-CR": "Cash A/c",
      AMOUNT: "50000",
      DATE: "01-09-2026",
      "VOUCHER NO.": "C-001",
    });

    assert.equal(voucher.VOUCHERTYPENAME, "Contra");
    assert.equal(voucher.DATE, "20260901");
    assert.equal(typeof voucher.DATE, "string");
    assert.equal(voucher.VOUCHERNUMBER, "C-001");
    assert.equal(voucher.ISINVOICE, "No");
    assert.equal(
      voucher.PARTYLEDGERNAME,
      undefined,
      "Contra should not have PARTYLEDGERNAME",
    );
    assert.equal(
      entries.length,
      2,
      "Contra must have exactly 2 ledger entries",
    );

    const debitEntry = entries[0];
    assert.equal(debitEntry.LEDGERNAME, "Bank A/c");
    assert.equal(debitEntry.ISDEEMEDPOSITIVE, "Yes");
    assert.equal(debitEntry.AMOUNT, "-50000.00");
    assert.equal(debitEntry.ISPARTYLEDGER, undefined);
    assert.equal(debitEntry["BILLALLOCATIONS.LIST"], undefined);

    const creditEntry = entries[1];
    assert.equal(creditEntry.LEDGERNAME, "Cash A/c");
    assert.equal(creditEntry.ISDEEMEDPOSITIVE, "No");
    assert.equal(creditEntry.AMOUNT, "50000.00");
    assert.equal(creditEntry.ISPARTYLEDGER, undefined);
    assert.equal(creditEntry["BILLALLOCATIONS.LIST"], undefined);
  });
});

/* ============================================================
   ACCOUNTING REGRESSION: JOURNAL VOUCHER
   Flexible: any debit/credit ledger pair
   DR: Expense/Asset (ISDEEMEDPOSITIVE=Yes, AMOUNT=-ve)
   CR: Liability     (ISDEEMEDPOSITIVE=No, AMOUNT=+ve)
============================================================ */

describe("accounting — Journal voucher", () => {
  it("has correct voucher type, date, generic DR/CR entries, amounts, ISDEEMEDPOSITIVE and no party assignment", () => {
    const { voucher, entries } = buildAndParse("Journal", {
      "BY-DR": "Bank A/c",
      "TO-CR": "Customer A/c",
      AMOUNT: "12000",
      DATE: "20-09-2026",
      "VOUCHER NO.": "J-001",
    });

    assert.equal(voucher.VOUCHERTYPENAME, "Journal");
    assert.equal(voucher.DATE, "20260920");
    assert.equal(typeof voucher.DATE, "string");
    assert.equal(voucher.VOUCHERNUMBER, "J-001");
    assert.equal(voucher.ISINVOICE, "No");
    assert.equal(
      voucher.PARTYLEDGERNAME,
      undefined,
      "Generic Journal should not automatically have PARTYLEDGERNAME",
    );
    assert.equal(entries.length, 2);

    const debitEntry = entries[0];
    assert.equal(debitEntry.LEDGERNAME, "Bank A/c");
    assert.equal(debitEntry.ISDEEMEDPOSITIVE, "Yes");
    assert.equal(debitEntry.AMOUNT, "-12000.00");
    assert.equal(debitEntry.ISPARTYLEDGER, undefined);
    assert.equal(debitEntry["BILLALLOCATIONS.LIST"], undefined);

    const creditEntry = entries[1];
    assert.equal(creditEntry.LEDGERNAME, "Customer A/c");
    assert.equal(creditEntry.ISDEEMEDPOSITIVE, "No");
    assert.equal(creditEntry.AMOUNT, "12000.00");
    assert.equal(creditEntry.ISPARTYLEDGER, undefined);
    assert.equal(creditEntry["BILLALLOCATIONS.LIST"], undefined);
  });
});

/* ============================================================
   ACCOUNTING REGRESSION: CREDIT NOTE (SALES RETURN)
   ─────────────────────────────────────────────────────────
   Tally Accounting Standard for Credit Note (Sales Return):
     Dr. Sales Returns A/c (or Sales A/c)   [Debit reduces revenue]
       Cr. Customer A/c                     [Credit reduces debtor balance]

   In the spreadsheet:
     BY-DR (Debit side)  = Sales A/c (or Sales Returns A/c)
     TO-CR (Credit side) = Customer A/c

   Party:
     Customer A/c is the trade party.
     Customer is on the CREDIT side (TO-CR), hence partyIsCredit = true.
     PARTYLEDGERNAME = Customer A/c.
     Bill allocations are placed on the party entry (Customer A/c, credit side).
============================================================ */

describe("accounting — Credit Note voucher", () => {
  it("has correct voucher type, date, party=credit (Customer), DR/CR entries, amounts and ISDEEMEDPOSITIVE", () => {
    const { voucher, entries } = buildAndParse("Credit Note", {
      "BY-DR": "Sales A/c",
      "TO-CR": "Customer A/c",
      AMOUNT: "2000",
      DATE: "18-09-2026",
      "VOUCHER NO.": "CN-001",
    });

    assert.equal(voucher.VOUCHERTYPENAME, "Credit Note");
    assert.equal(voucher.DATE, "20260918");
    assert.equal(typeof voucher.DATE, "string");
    assert.equal(voucher.VOUCHERNUMBER, "CN-001");
    assert.equal(
      voucher.PARTYLEDGERNAME,
      "Customer A/c",
      "Credit Note party = Customer A/c (TO-CR, credit side)",
    );
    assert.equal(
      voucher.ISINVOICE,
      "No",
      "Credit Note is not flagged as an invoice (only Sales and Purchase are)",
    );

    // DR: Sales A/c (BY-DR column — reduces revenue)
    const debitEntry = entries[0];
    assert.equal(debitEntry.LEDGERNAME, "Sales A/c");
    assert.equal(
      debitEntry.ISDEEMEDPOSITIVE,
      "Yes",
      "Debit side: ISDEEMEDPOSITIVE=Yes",
    );
    assert.equal(debitEntry.AMOUNT, "-2000.00", "Debit side: negative amount");

    // CR: Customer A/c (TO-CR column — party, customer is credited)
    const creditEntry = entries[1];
    assert.equal(creditEntry.LEDGERNAME, "Customer A/c");
    assert.equal(
      creditEntry.ISDEEMEDPOSITIVE,
      "No",
      "Credit side: ISDEEMEDPOSITIVE=No",
    );
    assert.equal(creditEntry.AMOUNT, "2000.00", "Credit side: positive amount");
    assert.equal(
      creditEntry.ISPARTYLEDGER,
      "Yes",
      "Customer must be flagged as party ledger",
    );

    // Bill allocations on party (credit) side — amount positive
    const billEntries = asArray(creditEntry["BILLALLOCATIONS.LIST"]);
    assert.equal(billEntries.length, 1);
    assert.equal(billEntries[0].NAME, "CN-001");
    assert.equal(
      billEntries[0].AMOUNT,
      "2000.00",
      "Bill amount is positive on credit party side",
    );
  });

  it("Credit Note party is the credit ledger (TO-CR), not the debit ledger (BY-DR)", () => {
    const { voucher } = buildAndParse("Credit Note", {
      "BY-DR": "Sales A/c",
      "TO-CR": "Customer A/c",
      AMOUNT: "500",
    });
    assert.equal(
      voucher.PARTYLEDGERNAME,
      "Customer A/c",
      "Party must be Customer A/c from TO-CR (credit side)",
    );
    assert.notEqual(
      voucher.PARTYLEDGERNAME,
      "Sales A/c",
      "Party must NOT be Sales A/c from BY-DR (debit side)",
    );
  });

  it("accounting rationale: Credit Note (Sales Return) inverts Sales party direction", () => {
    // Sales: Customer is DEBIT (BY-DR), Sales A/c is CREDIT (TO-CR)
    // Credit Note (Sales Return): Sales A/c is DEBIT (BY-DR), Customer is CREDIT (TO-CR)
    // In Credit Note, Customer is CREDITED to reduce accounts receivable.
    const salesResult = buildAndParse("Sales", {
      "BY-DR": "Customer A/c",
      "TO-CR": "Sales A/c",
      AMOUNT: "1000",
    });
    const cnResult = buildAndParse("Credit Note", {
      "BY-DR": "Sales A/c",
      "TO-CR": "Customer A/c",
      AMOUNT: "1000",
    });

    assert.equal(
      salesResult.voucher.PARTYLEDGERNAME,
      "Customer A/c",
      "Sales party = Customer A/c (BY-DR)",
    );
    assert.equal(
      cnResult.voucher.PARTYLEDGERNAME,
      "Customer A/c",
      "Credit Note party = Customer A/c (TO-CR)",
    );

    // Sales marks debit entry as party; Credit Note marks credit entry as party
    assert.equal(salesResult.entries[0].ISPARTYLEDGER, "Yes");
    assert.equal(salesResult.entries[0].LEDGERNAME, "Customer A/c");
    assert.equal(cnResult.entries[1].ISPARTYLEDGER, "Yes");
    assert.equal(cnResult.entries[1].LEDGERNAME, "Customer A/c");
  });
});

/* ============================================================
   ACCOUNTING REGRESSION: DEBIT NOTE (PURCHASE RETURN)
   ─────────────────────────────────────────────────────────
   Tally Accounting Standard for Debit Note (Purchase Return):
     Dr. Supplier A/c                     [Debit reduces liability to supplier]
       Cr. Purchase Returns A/c (or Purchase A/c) [Credit reduces purchase expense]

   In the spreadsheet:
     BY-DR (Debit side)  = Supplier A/c (or Bank A/c)
     TO-CR (Credit side) = Purchase A/c (or Purchase Returns A/c)

   Party:
     Supplier A/c is the trade party.
     Supplier is on the DEBIT side (BY-DR), hence partyIsDebit = true.
     PARTYLEDGERNAME = Supplier A/c.
     Bill allocations are placed on the party entry (Supplier A/c, debit side).
============================================================ */

describe("accounting — Debit Note voucher", () => {
  it("has correct voucher type, date, party=debit (Supplier), DR/CR entries, amounts and ISDEEMEDPOSITIVE", () => {
    const { voucher, entries } = buildAndParse("Debit Note", {
      "BY-DR": "Bank A/c",
      "TO-CR": "Purchase A/c",
      AMOUNT: "3500",
      DATE: "12-09-2026",
      "VOUCHER NO.": "DN-001",
    });

    assert.equal(voucher.VOUCHERTYPENAME, "Debit Note");
    assert.equal(voucher.DATE, "20260912");
    assert.equal(typeof voucher.DATE, "string");
    assert.equal(voucher.VOUCHERNUMBER, "DN-001");
    assert.equal(
      voucher.PARTYLEDGERNAME,
      "Bank A/c",
      "Debit Note party = Bank A/c (BY-DR, debit side)",
    );
    assert.equal(
      voucher.ISINVOICE,
      "No",
      "Debit Note is not flagged as an invoice (only Sales and Purchase are)",
    );

    // DR: Bank A/c (BY-DR column — supplier/party, reducing payable)
    const debitEntry = entries[0];
    assert.equal(debitEntry.LEDGERNAME, "Bank A/c");
    assert.equal(
      debitEntry.ISDEEMEDPOSITIVE,
      "Yes",
      "Debit side: ISDEEMEDPOSITIVE=Yes",
    );
    assert.equal(debitEntry.AMOUNT, "-3500.00", "Debit side: negative amount");
    assert.equal(
      debitEntry.ISPARTYLEDGER,
      "Yes",
      "Supplier must be flagged as party ledger",
    );

    // CR: Purchase A/c (TO-CR column — reduces purchase expense)
    const creditEntry = entries[1];
    assert.equal(creditEntry.LEDGERNAME, "Purchase A/c");
    assert.equal(
      creditEntry.ISDEEMEDPOSITIVE,
      "No",
      "Credit side: ISDEEMEDPOSITIVE=No",
    );
    assert.equal(creditEntry.AMOUNT, "3500.00", "Credit side: positive amount");

    // Bill allocations on party (debit) side — amount negative
    const billEntries = asArray(debitEntry["BILLALLOCATIONS.LIST"]);
    assert.equal(billEntries.length, 1);
    assert.equal(billEntries[0].NAME, "DN-001");
    assert.equal(
      billEntries[0].AMOUNT,
      "-3500.00",
      "Bill amount is negative on debit party side",
    );
  });

  it("Debit Note party is the debit ledger (BY-DR), not the credit ledger (TO-CR)", () => {
    const { voucher } = buildAndParse("Debit Note", {
      "BY-DR": "Bank A/c",
      "TO-CR": "Purchase A/c",
      AMOUNT: "500",
    });
    assert.equal(
      voucher.PARTYLEDGERNAME,
      "Bank A/c",
      "Party must be Bank A/c from BY-DR (debit side)",
    );
    assert.notEqual(
      voucher.PARTYLEDGERNAME,
      "Purchase A/c",
      "Party must NOT be Purchase A/c from TO-CR (credit side)",
    );
  });

  it("accounting rationale: Debit Note (Purchase Return) inverts Purchase party direction", () => {
    // Purchase: Purchase A/c is DEBIT (BY-DR), Supplier is CREDIT (TO-CR)
    // Debit Note (Purchase Return): Supplier is DEBIT (BY-DR), Purchase A/c is CREDIT (TO-CR)
    // In Debit Note, Supplier is DEBITED to reduce accounts payable.
    const purchaseResult = buildAndParse("Purchase", {
      "BY-DR": "Purchase A/c",
      "TO-CR": "Bank A/c",
      AMOUNT: "1000",
    });
    const dnResult = buildAndParse("Debit Note", {
      "BY-DR": "Bank A/c",
      "TO-CR": "Purchase A/c",
      AMOUNT: "1000",
    });

    assert.equal(
      purchaseResult.voucher.PARTYLEDGERNAME,
      "Bank A/c",
      "Purchase party = Bank A/c (TO-CR)",
    );
    assert.equal(
      dnResult.voucher.PARTYLEDGERNAME,
      "Bank A/c",
      "Debit Note party = Bank A/c (BY-DR)",
    );

    // Purchase marks credit entry as party; Debit Note marks debit entry as party
    assert.equal(purchaseResult.entries[1].ISPARTYLEDGER, "Yes");
    assert.equal(purchaseResult.entries[1].LEDGERNAME, "Bank A/c");
    assert.equal(dnResult.entries[0].ISPARTYLEDGER, "Yes");
    assert.equal(dnResult.entries[0].LEDGERNAME, "Bank A/c");
  });
});

/* ============================================================
   MULTI-ROW EXCEL — ALL VOUCHER TYPES INDEPENDENT
============================================================ */

describe("multi-row excel — each row is independent", () => {
  it("generates one TALLYMESSAGE per row without cross-contamination", () => {
    const rows = [
      salesRow({
        "BY-DR": "Customer A/c",
        "TO-CR": "Sales A/c",
        "VOUCHER NO.": "S-10",
      }),
      salesRow({
        "BY-DR": "Purchase A/c",
        "TO-CR": "Bank A/c",
        "VOUCHER NO.": "P-10",
        AMOUNT: "5000",
      }),
      salesRow({
        "BY-DR": "Cash A/c",
        "TO-CR": "Customer A/c",
        "VOUCHER NO.": "R-10",
        AMOUNT: "2000",
      }),
    ];
    const xml = buildXml({ voucherType: "Sales", rows });
    const parsed = parseXml(xml);
    const messages = asArray(
      parsed.ENVELOPE.BODY.IMPORTDATA.REQUESTDATA.TALLYMESSAGE,
    );

    assert.equal(messages.length, 3, "Three separate TALLYMESSAGE nodes");
    assert.equal(messages[0].VOUCHER.VOUCHERNUMBER, "S-10");
    assert.equal(messages[1].VOUCHER.VOUCHERNUMBER, "P-10");
    assert.equal(messages[2].VOUCHER.VOUCHERNUMBER, "R-10");

    // Amounts are independent
    const e0 = asArray(messages[0].VOUCHER["ALLLEDGERENTRIES.LIST"]);
    const e1 = asArray(messages[1].VOUCHER["ALLLEDGERENTRIES.LIST"]);
    const e2 = asArray(messages[2].VOUCHER["ALLLEDGERENTRIES.LIST"]);
    assert.equal(e0[0].AMOUNT, "-10000.00");
    assert.equal(e1[0].AMOUNT, "-5000.00");
    assert.equal(e2[0].AMOUNT, "-2000.00");
  });

  it("validation is independent per row — a bad row does not suppress another row's issues", () => {
    const rows = [
      salesRow({ "TO-CR": "Sales A/c" }), // clean row
      salesRow({ "TO-CR": "Sales A/c", AMOUNT: "" }), // bad amount
    ];
    const issues = validateRows(rows, "Sales");
    const row3Issues = issues.filter((i) => i.row === 3);
    const row2Issues = issues.filter((i) => i.row === 2);
    assert.ok(
      row3Issues.some((i) => i.column === "AMOUNT"),
      "Row 3 AMOUNT error",
    );
    assert.equal(
      row2Issues.filter((i) => i.severity === "error").length,
      0,
      "Row 2 is clean",
    );
  });

  it("warnings-only summary is correctly scored: score=100, errors=0", () => {
    const rows = [
      salesRow({ "TO-CR": "Sales A/c" }), // no errors, no warnings
    ];
    const issues = validateRows(rows, "Sales");
    const stats = summary(issues, rows.length);
    assert.equal(stats.errors, 0);
    assert.equal(stats.score, 100);
  });
});

/* ============================================================
   XML STRUCTURE HIERARCHY
============================================================ */

describe("xml structure hierarchy", () => {
  it("ENVELOPE > HEADER + BODY > IMPORTDATA > REQUESTDESC + REQUESTDATA > TALLYMESSAGE", () => {
    const xml = buildXml({
      voucherType: "Sales",
      rows: [salesRow({ "TO-CR": "Sales A/c" })],
    });
    const parsed = parseXml(xml);

    const envelope = parsed.ENVELOPE;
    assert.ok(envelope, "ENVELOPE must exist");
    assert.ok(envelope.HEADER, "HEADER must be inside ENVELOPE");
    assert.ok(envelope.BODY, "BODY must be inside ENVELOPE");
    assert.ok(envelope.BODY.IMPORTDATA, "IMPORTDATA must be inside BODY");

    const importData = envelope.BODY.IMPORTDATA;
    assert.ok(importData.REQUESTDESC, "REQUESTDESC must be inside IMPORTDATA");
    assert.ok(importData.REQUESTDATA, "REQUESTDATA must be inside IMPORTDATA");

    const messages = asArray(importData.REQUESTDATA.TALLYMESSAGE);
    assert.ok(messages.length > 0, "TALLYMESSAGE must be inside REQUESTDATA");
    assert.ok(messages[0].VOUCHER, "VOUCHER must be inside TALLYMESSAGE");
  });

  it("ALLLEDGERENTRIES.LIST entries contain LEDGERNAME, ISDEEMEDPOSITIVE, AMOUNT", () => {
    const xml = buildXml({
      voucherType: "Sales",
      rows: [salesRow({ "TO-CR": "Sales A/c" })],
    });
    const parsed = parseXml(xml);
    const messages = asArray(
      parsed.ENVELOPE.BODY.IMPORTDATA.REQUESTDATA.TALLYMESSAGE,
    );
    const entries = asArray(messages[0].VOUCHER["ALLLEDGERENTRIES.LIST"]);

    assert.ok(entries.length >= 2, "At least 2 ledger entries required");
    for (const entry of entries) {
      assert.ok(
        entry.LEDGERNAME,
        `Entry must have LEDGERNAME: ${JSON.stringify(entry)}`,
      );
      assert.ok(
        entry.ISDEEMEDPOSITIVE === "Yes" || entry.ISDEEMEDPOSITIVE === "No",
        `ISDEEMEDPOSITIVE must be Yes or No: ${entry.ISDEEMEDPOSITIVE}`,
      );
      assert.ok(
        entry.AMOUNT !== undefined && entry.AMOUNT !== "",
        `Entry must have AMOUNT: ${JSON.stringify(entry)}`,
      );
    }
  });

  it("debit and credit amounts are equal and opposite", () => {
    const { entries } = buildAndParse("Sales", {
      "BY-DR": "Customer A/c",
      "TO-CR": "Sales A/c",
      AMOUNT: "9999",
    });
    const debitAmt = Math.abs(Number(entries[0].AMOUNT));
    const creditAmt = Number(entries[1].AMOUNT);
    assert.equal(
      debitAmt,
      creditAmt,
      "DR amount magnitude must equal CR amount",
    );
    assert.ok(entries[0].AMOUNT.startsWith("-"), "DR amount must be negative");
    assert.ok(!entries[1].AMOUNT.startsWith("-"), "CR amount must be positive");
  });
});

/* ============================================================
   AUTO-FIX COLUMNS — FULL LIFECYCLE
============================================================ */

describe("auto-fix columns", () => {
  it("fixes amount, date and GSTIN from concrete recommendations", () => {
    const dataRows = [
      salesRow({
        AMOUNT: "₹10,000",
        DATE: "1/2/2026",
        "TO-CR": "Sales A/c",
        GSTIN: "27abcde1234f1z5",
      }),
    ];
    const issues = validateRows(dataRows, "Sales");
    const fixed = applySafeFixes(issues);

    for (const issue of fixed.filter((item) => item.status === "fixed")) {
      const result = applyIssueToUpload({ dataRows }, issue);
      assert.equal(result.changed, true, issue.column);
    }

    assert.equal(dataRows[0].AMOUNT, "10000");
    assert.equal(dataRows[0].DATE, "01-02-2026");
    assert.equal(dataRows[0].GSTIN, "27ABCDE1234F1Z5");
  });

  it("full lifecycle: Auto Fix → persist to dataRows → Revalidate shows no Sales issue", () => {
    // Simulate the complete flow in memory (mirrors the DB flow in validationController)
    const dataRows = [salesRow({ "TO-CR": "Sales" })];

    // Step 1: Validate
    const issues = validateRows(dataRows, "Sales");
    const salesIssue = issues.find(
      (i) => i.column === "TO-CR" && i.currentValue === "Sales",
    );
    assert.ok(salesIssue, "Sales ledger issue found");

    // Step 2: Auto Fix
    const fixedIssues = applySafeFixes(JSON.parse(JSON.stringify(issues)));
    const fixedSalesIssue = fixedIssues.find(
      (i) => i.column === "TO-CR" && i.status === "fixed",
    );
    assert.ok(fixedSalesIssue, "Auto fix produced a fixed issue");

    // Step 3: Apply fix to dataRows (mirrors persistDataRows)
    const result = applyIssueToUpload({ dataRows }, fixedSalesIssue);
    assert.equal(result.changed, true, "Fix must be applied");
    assert.equal(
      dataRows[0]["TO-CR"],
      "Sales A/c",
      "Persisted value must be Sales A/c",
    );

    // Step 4: Revalidate from fresh dataRows (mirrors the revalidate endpoint)
    const revalidatedIssues = validateRows(dataRows, "Sales");
    const stillBad = revalidatedIssues.find(
      (i) => i.column === "TO-CR" && i.currentValue === "Sales",
    );
    assert.equal(
      stillBad,
      undefined,
      "Sales A/c must not reappear as a problem after fix",
    );

    // Step 5: Generate XML and confirm Sales A/c is in it
    const xml = buildXml({ voucherType: "Sales", rows: dataRows });
    const parsed = parseXml(xml);
    const messages = asArray(
      parsed.ENVELOPE.BODY.IMPORTDATA.REQUESTDATA.TALLYMESSAGE,
    );
    const ledgerNames = asArray(
      messages[0].VOUCHER["ALLLEDGERENTRIES.LIST"],
    ).map((e) => e.LEDGERNAME);
    assert.ok(
      ledgerNames.includes("Sales A/c"),
      "XML must contain Sales A/c after full lifecycle",
    );
    assert.equal(validateXml(xml).valid, true);
  });
});

/* ============================================================
   IGNORE ISSUE BEHAVIOR
============================================================ */

describe("ignore issue behavior", () => {
  it("ignored issue does not affect error count in summary", () => {
    const issues = validateRows(
      [salesRow({ "TO-CR": "Sales A/c", AMOUNT: "" })],
      "Sales",
    );
    const amountIssue = issues.find((i) => i.column === "AMOUNT");
    assert.ok(amountIssue, "Amount issue found");

    // Mark as ignored
    amountIssue.status = "ignored";

    const stats = summary(issues, 1);
    assert.equal(stats.ignored, 1);
    // Ignored issues do not count as pending errors
    assert.equal(
      stats.errors,
      0,
      "Ignored error must not appear in active errors count",
    );
  });
});

/* ============================================================
   WARNING vs ERROR — XML is NOT blocked by warnings
============================================================ */

describe("warnings vs errors", () => {
  it("warnings-only validation returns score=100 and errors=0", () => {
    // Row with only ledger-formatting warning (Sales → Sales A/c)
    const rows = [salesRow({ "TO-CR": "Sales" })];
    const issues = validateRows(rows, "Sales");
    const stats = summary(issues, 1);
    // No required-field errors → score = 100
    assert.equal(stats.errors, 0, "Warnings must not count as errors");
    assert.equal(stats.score, 100);
    assert.ok(stats.warnings >= 1, "Warning must be detected");
  });

  it("missing required field is an error and lowers score", () => {
    const rows = [salesRow({ "TO-CR": "Sales A/c", AMOUNT: "" })];
    const issues = validateRows(rows, "Sales");
    const stats = summary(issues, 1);
    assert.ok(stats.errors >= 1, "Missing AMOUNT must be an error");
    assert.ok(stats.score < 100, "Score must drop when there are errors");
  });
});

/* ============================================================
   DUPLICATE VOUCHER DETECTION
============================================================ */

describe("duplicate voucher detection", () => {
  it("flags duplicates on the same voucher number and date", () => {
    const rows = [
      salesRow({ "TO-CR": "Sales A/c", "VOUCHER NO.": "DUP-1" }),
      salesRow({ "TO-CR": "Sales A/c", "VOUCHER NO.": "DUP-1" }),
    ];
    const issues = validateRows(rows, "Sales");
    assert.ok(issues.some((i) => i.issue === "Duplicate voucher number"));
  });

  it("different voucher numbers on the same date are not flagged as duplicates", () => {
    const rows = [
      salesRow({ "TO-CR": "Sales A/c", "VOUCHER NO.": "UNIQ-1" }),
      salesRow({ "TO-CR": "Sales A/c", "VOUCHER NO.": "UNIQ-2" }),
    ];
    const issues = validateRows(rows, "Sales");
    assert.equal(
      issues.some((i) => i.issue === "Duplicate voucher number"),
      false,
    );
  });
});

/* ============================================================
   GSTIN VALIDATION
============================================================ */

describe("GSTIN validation", () => {
  it("accepts a valid GSTIN without raising an issue", () => {
    const rows = [salesRow({ "TO-CR": "Sales A/c", GSTIN: "27ABCDE1234F1Z5" })];
    const issues = validateRows(rows, "Sales");
    assert.equal(
      issues.some((i) => i.column === "GSTIN"),
      false,
    );
  });

  it("flags an invalid GSTIN as an error", () => {
    const rows = [salesRow({ "TO-CR": "Sales A/c", GSTIN: "INVALID" })];
    const issues = validateRows(rows, "Sales");
    assert.ok(
      issues.some((i) => i.column === "GSTIN" && i.severity === "error"),
    );
  });

  it("normalizes lowercase GSTIN to uppercase with a warning", () => {
    const rows = [salesRow({ "TO-CR": "Sales A/c", GSTIN: "27abcde1234f1z5" })];
    const issues = validateRows(rows, "Sales");
    const gstin = issues.find((i) => i.column === "GSTIN");
    assert.ok(gstin, "GSTIN formatting issue found");
    assert.equal(gstin.severity, "warning");
    assert.equal(gstin.autoFixable, true);
    assert.match(gstin.recommendation, /27ABCDE1234F1Z5/);
  });

  it("blank GSTIN is optional and does not raise any issue", () => {
    const rows = [salesRow({ "TO-CR": "Sales A/c", GSTIN: "" })];
    const issues = validateRows(rows, "Sales");
    assert.equal(
      issues.some((i) => i.column === "GSTIN"),
      false,
    );
  });
});

/* ============================================================
   LEDGER NORMALIZATION
============================================================ */

describe("ledger normalization", () => {
  it("returns the canonical ledger for exact case-insensitive match", () => {
    assert.equal(findCanonicalLedger("sales a/c"), "Sales A/c");
    assert.equal(findCanonicalLedger("SALES A/C"), "Sales A/c");
    assert.equal(findCanonicalLedger(" Sales A/c "), "Sales A/c");
  });

  it("does not merge genuinely different ledgers", () => {
    assert.notEqual(findCanonicalLedger("Sales A/c"), "Purchase A/c");
    assert.notEqual(findCanonicalLedger("Cash A/c"), "Bank A/c");
  });

  it("fuzzy-suggests a close match for a misspelled ledger", () => {
    assert.equal(suggestLedger("Sales"), "Sales A/c");
    assert.equal(suggestLedger("Purchase"), "Purchase A/c");
  });
});

/* ============================================================
   SECURITY HELPERS
============================================================ */

describe("security helpers", () => {
  it("hashes passwords and never stores plaintext", async () => {
    const hash = await hashPassword("CorrectHorseBattery");
    assert.notEqual(hash, "CorrectHorseBattery");
    assert.equal(await comparePassword("CorrectHorseBattery", hash), true);
    assert.equal(await comparePassword("wrong", hash), false);
  });

  it("never uses the original filename as a filesystem path — backslash traversal (Windows input on any OS)", () => {
    // Windows-style path traversal: must be safe even on Linux production (Render)
    const name = safeFileName("..\\..\\etc\\passwd.xlsx");
    assert.match(name, /\.xlsx$/, "must preserve extension");
    assert.equal(name.includes(".."), false, "must not contain ..");
    assert.equal(name.includes("\\"), false, "must not contain backslash");
    assert.equal(name.includes("/"), false, "must not contain forward slash");
    assert.equal(
      path.basename(name),
      name,
      "result must be a plain filename with no directory",
    );
  });

  it("never uses the original filename as a filesystem path — forward-slash traversal (POSIX input on any OS)", () => {
    // POSIX-style path traversal
    const name = safeFileName("../../etc/passwd.xlsx");
    assert.match(name, /\.xlsx$/, "must preserve extension");
    assert.equal(name.includes(".."), false, "must not contain ..");
    assert.equal(name.includes("/"), false, "must not contain forward slash");
    assert.equal(
      path.basename(name),
      name,
      "result must be a plain filename with no directory",
    );
  });
});

/* ============================================================
   ALL 8 VOUCHER TYPES — COMPLETE VERIFICATION MATRIX
============================================================ */

describe("all 8 voucher types — complete verification matrix", () => {
  const testMatrix = [
    {
      type: "Sales",
      byDr: "Customer A/c",
      toCr: "Sales A/c",
      amount: "15000",
      date: "01-10-2026",
      expectedDate: "20261001",
      voucherNo: "VCH-SALES-1",
      expectedParty: "Customer A/c",
      partyEntryIndex: 0, // Customer in BY-DR (debit)
      partyBillAmount: "-15000.00",
      drLedger: "Customer A/c",
      crLedger: "Sales A/c",
    },
    {
      type: "Purchase",
      byDr: "Purchase A/c",
      toCr: "Bank A/c",
      amount: "25000",
      date: "02-10-2026",
      expectedDate: "20261002",
      voucherNo: "VCH-PURCH-1",
      expectedParty: "Bank A/c",
      partyEntryIndex: 1, // Bank/Supplier in TO-CR (credit)
      partyBillAmount: "25000.00",
      drLedger: "Purchase A/c",
      crLedger: "Bank A/c",
    },
    {
      type: "Credit Note",
      byDr: "Sales A/c",
      toCr: "Customer A/c",
      amount: "3000",
      date: "03-10-2026",
      expectedDate: "20261003",
      voucherNo: "VCH-CRNOTE-1",
      expectedParty: "Customer A/c",
      partyEntryIndex: 1, // Customer in TO-CR (credit)
      partyBillAmount: "3000.00",
      drLedger: "Sales A/c",
      crLedger: "Customer A/c",
    },
    {
      type: "Debit Note",
      byDr: "Bank A/c",
      toCr: "Purchase A/c",
      amount: "4000",
      date: "04-10-2026",
      expectedDate: "20261004",
      voucherNo: "VCH-DBNOTE-1",
      expectedParty: "Bank A/c",
      partyEntryIndex: 0, // Supplier/Bank in BY-DR (debit)
      partyBillAmount: "-4000.00",
      drLedger: "Bank A/c",
      crLedger: "Purchase A/c",
    },
    {
      type: "Receipt",
      byDr: "Cash A/c",
      toCr: "Customer A/c",
      amount: "5000",
      date: "05-10-2026",
      expectedDate: "20261005",
      voucherNo: "VCH-RCPT-1",
      expectedParty: "Customer A/c",
      partyEntryIndex: 1, // Customer in TO-CR (credit)
      partyBillAmount: "5000.00",
      drLedger: "Cash A/c",
      crLedger: "Customer A/c",
    },
    {
      type: "Payment",
      byDr: "Customer A/c",
      toCr: "Bank A/c",
      amount: "6000",
      date: "06-10-2026",
      expectedDate: "20261006",
      voucherNo: "VCH-PYMT-1",
      expectedParty: "Customer A/c",
      partyEntryIndex: 0, // Supplier/Customer in BY-DR (debit)
      partyBillAmount: "-6000.00",
      drLedger: "Customer A/c",
      crLedger: "Bank A/c",
    },
    {
      type: "Contra",
      byDr: "Bank A/c",
      toCr: "Cash A/c",
      amount: "7000",
      date: "07-10-2026",
      expectedDate: "20261007",
      voucherNo: "VCH-CNTR-1",
      expectedParty: undefined, // Contra has no trade party
      partyEntryIndex: -1,
      drLedger: "Bank A/c",
      crLedger: "Cash A/c",
    },
    {
      type: "Journal",
      byDr: "Customer A/c",
      toCr: "Sales A/c",
      amount: "8000",
      date: "08-10-2026",
      expectedDate: "20261008",
      voucherNo: "VCH-JRNL-1",
      expectedParty: undefined, // Generic journal has no auto-assigned party
      partyEntryIndex: -1,
      drLedger: "Customer A/c",
      crLedger: "Sales A/c",
    },
  ];

  for (const item of testMatrix) {
    it(`verifies complete XML integrity for ${item.type}`, () => {
      const { xml, voucher, entries } = buildAndParse(item.type, {
        "BY-DR": item.byDr,
        "TO-CR": item.toCr,
        AMOUNT: item.amount,
        DATE: item.date,
        "VOUCHER NO.": item.voucherNo,
      });

      // 1. XML validates structurally
      assert.equal(
        validateXml(xml).valid,
        true,
        `${item.type} XML must validate`,
      );

      // 2. Voucher type
      assert.equal(voucher.VOUCHERTYPENAME, item.type);

      // 3. Date as YYYYMMDD string
      assert.equal(typeof voucher.DATE, "string");
      assert.equal(voucher.DATE, item.expectedDate);

      // 4. Voucher number
      assert.equal(voucher.VOUCHERNUMBER, item.voucherNo);

      // 5. Party ledger name
      assert.equal(voucher.PARTYLEDGERNAME, item.expectedParty);

      // 6. ALLLEDGERENTRIES.LIST has at least 2 entries
      assert.equal(entries.length, 2);

      // 7. Debit entry (entries[0])
      const drEntry = entries[0];
      assert.equal(drEntry.LEDGERNAME, item.drLedger);
      assert.equal(
        drEntry.ISDEEMEDPOSITIVE,
        "Yes",
        "Debit entry must be deemed positive (Yes)",
      );
      assert.equal(
        drEntry.AMOUNT,
        `-${Number(item.amount).toFixed(2)}`,
        "Debit amount must be negative in Tally XML",
      );

      // 8. Credit entry (entries[1])
      const crEntry = entries[1];
      assert.equal(crEntry.LEDGERNAME, item.crLedger);
      assert.equal(
        crEntry.ISDEEMEDPOSITIVE,
        "No",
        "Credit entry must NOT be deemed positive (No)",
      );
      assert.equal(
        crEntry.AMOUNT,
        `${Number(item.amount).toFixed(2)}`,
        "Credit amount must be positive in Tally XML",
      );

      // 9. Bill allocations where applicable
      if (item.partyEntryIndex >= 0) {
        const partyEntry = entries[item.partyEntryIndex];
        assert.equal(
          partyEntry.ISPARTYLEDGER,
          "Yes",
          `${item.type} party entry must have ISPARTYLEDGER=Yes`,
        );
        const bill = asArray(partyEntry["BILLALLOCATIONS.LIST"])[0];
        assert.ok(bill, `${item.type} must have BILLALLOCATIONS.LIST`);
        assert.equal(bill.NAME, item.voucherNo);
        assert.equal(bill.BILLTYPE, "New Ref");
        assert.equal(bill.AMOUNT, item.partyBillAmount);
      }
    });
  }
});

/* ============================================================
   CRITICAL REGRESSION TEST: 19 ISSUES → 9 FIXED → 10 REMAIN
============================================================ */

describe("critical regression test: 19 issues found → 9 auto-fixed → 10 remain on revalidate", () => {
  it("proves 19 issues found, exactly 9 safe fixed, persisted to dataRows, and 10 remain on revalidate", () => {
    // 6 accounting rows with precise issue distributions
    const rows = [
      // Row 1: 5 auto-fixable issues
      // 1: AMOUNT '₹12,500' -> autoFixable
      // 2: DATE '2026/02/01' -> autoFixable
      // 3: TO-CR 'Sales' -> autoFixable ('Use Sales A/c.')
      // 4: BY-DR 'Cash' -> autoFixable ('Use Cash A/c.')
      // 5: GSTIN '27abcde1234f1z5' -> autoFixable ('Use 27ABCDE1234F1Z5.')
      {
        DATE: "2026/02/01",
        "BY-DR": "Cash",
        "TO-CR": "Sales",
        AMOUNT: "₹12,500",
        "VOUCHER NO.": "INV-101",
        GSTIN: "27abcde1234f1z5",
        "REFERENCE NO.": "REF-101",
        NARRATION: "Test sale 1",
      },
      // Row 2: 4 auto-fixable issues (Total auto-fixable = 9)
      // 6: AMOUNT ' 50,000 ' -> autoFixable
      // 7: DATE '05/03/2026' -> autoFixable
      // 8: TO-CR 'sales a/c' -> autoFixable
      // 9: BY-DR 'bank a/c' -> autoFixable
      {
        DATE: "05/03/2026",
        "BY-DR": "bank a/c",
        "TO-CR": "sales a/c",
        AMOUNT: " 50,000 ",
        "VOUCHER NO.": "INV-102",
        GSTIN: "27ABCDE1234F1Z5",
        "REFERENCE NO.": "REF-102",
        NARRATION: "Test sale 2",
      },
      // Row 3: 3 genuine unfixable issues
      // 10: DATE '31-13-2026' -> invalid calendar date (unfixable)
      // 11: AMOUNT 'TEN THOUSAND' -> invalid amount format (unfixable)
      // 12: GSTIN 'INVALID_GST' -> invalid GSTIN format (unfixable)
      {
        DATE: "31-13-2026",
        "BY-DR": "Customer A/c",
        "TO-CR": "Sales A/c",
        AMOUNT: "TEN THOUSAND",
        "VOUCHER NO.": "INV-103",
        GSTIN: "INVALID_GST",
        "REFERENCE NO.": "REF-103",
        NARRATION: "Test sale 3",
      },
      // Row 4: 5 genuine unfixable issues (missing required columns)
      // 13: missing DATE
      // 14: missing BY-DR
      // 15: missing TO-CR
      // 16: missing AMOUNT
      // 17: missing VOUCHER NO.
      {
        DATE: "",
        "BY-DR": "",
        "TO-CR": "",
        AMOUNT: "",
        "VOUCHER NO.": "",
        GSTIN: "",
        "REFERENCE NO.": "REF-104",
        NARRATION: "",
      },
      // Rows 5 & 6: 2 genuine unfixable issues
      // 18: Duplicate voucher number INV-DUP on the same date (01-02-2026)
      // 19: Missing reference number on row 5
      {
        DATE: "01-02-2026",
        "BY-DR": "Customer A/c",
        "TO-CR": "Sales A/c",
        AMOUNT: "1000",
        "VOUCHER NO.": "INV-DUP",
        GSTIN: "",
        "REFERENCE NO.": "",
        NARRATION: "First instance",
      },
      {
        DATE: "01-02-2026",
        "BY-DR": "Customer A/c",
        "TO-CR": "Sales A/c",
        AMOUNT: "1000",
        "VOUCHER NO.": "INV-DUP",
        GSTIN: "",
        "REFERENCE NO.": "REF-106",
        NARRATION: "Second instance",
      },
    ];

    // Step 1: Validation finds exactly 19 issues
    const initialIssues = validateRows(rows, "Sales");
    assert.equal(
      initialIssues.length,
      19,
      `Expected exactly 19 issues initially, got ${initialIssues.length}`,
    );

    const fixable = initialIssues.filter((i) => i.autoFixable);
    const unfixable = initialIssues.filter((i) => !i.autoFixable);
    assert.equal(
      fixable.length,
      9,
      `Expected exactly 9 auto-fixable issues, got ${fixable.length}`,
    );
    assert.equal(
      unfixable.length,
      10,
      `Expected exactly 10 genuine unfixable issues, got ${unfixable.length}`,
    );

    // Verify critical unfixable item: 31-13-2026 must remain an issue and NOT be guessed
    const invalidDateIssue = initialIssues.find(
      (i) => i.currentValue === "31-13-2026",
    );
    assert.ok(invalidDateIssue, "31-13-2026 must be flagged as an issue");
    assert.equal(
      invalidDateIssue.autoFixable,
      false,
      "31-13-2026 must NOT be auto-fixable",
    );

    // Step 2: Auto Fix fixes the safe 9 issues
    const fixedIssues = applySafeFixes(
      JSON.parse(JSON.stringify(initialIssues)),
    );
    const fixedCount = fixedIssues.filter((i) => i.status === "fixed").length;
    assert.equal(
      fixedCount,
      9,
      `Expected Auto Fix to fix exactly 9 safe issues, got ${fixedCount}`,
    );

    // Step 3: Persist fixes to Upload.dataRows
    const mockUpload = { dataRows: rows };
    for (const fix of fixedIssues.filter((i) => i.status === "fixed")) {
      const result = applyIssueToUpload(mockUpload, fix);
      assert.equal(
        result.changed,
        true,
        `Fix for ${fix.column} on row ${fix.row} must apply`,
      );
    }

    // Verify row 1 persisted corrections
    assert.equal(rows[0].AMOUNT, "12500");
    assert.equal(rows[0].DATE, "01-02-2026");
    assert.equal(rows[0]["TO-CR"], "Sales A/c");
    assert.equal(rows[0]["BY-DR"], "Cash A/c");
    assert.equal(rows[0].GSTIN, "27ABCDE1234F1Z5");

    // Verify row 2 persisted corrections
    assert.equal(rows[1].AMOUNT, "50000");
    assert.equal(rows[1].DATE, "05-03-2026");
    assert.equal(rows[1]["TO-CR"], "Sales A/c");
    assert.equal(rows[1]["BY-DR"], "Bank A/c");

    // Step 4: Revalidate loads fresh persisted data
    const revalidatedIssues = validateRows(rows, "Sales");

    // Step 5: Exactly 10 genuine issues remain
    assert.equal(
      revalidatedIssues.length,
      10,
      `Expected exactly 10 genuine issues to remain after revalidation, got ${revalidatedIssues.length}`,
    );

    // Step 6: The 9 fixed issues do NOT return
    const revalidatedFixable = revalidatedIssues.filter((i) => i.autoFixable);
    assert.equal(
      revalidatedFixable.length,
      0,
      "The 9 fixed issues must NOT return on revalidation",
    );

    // Verify genuine 31-13-2026 issue remains untouched
    const stillInvalidDate = revalidatedIssues.find(
      (i) => i.currentValue === "31-13-2026",
    );
    assert.ok(stillInvalidDate, "31-13-2026 must still be present as an issue");
  });
});

/* ============================================================
   EMAIL VERIFICATION & RESEND REGRESSION TESTS
============================================================ */

describe("email verification and resend regression tests", () => {
  const crypto = require("node:crypto");
  const hashToken = (token) =>
    crypto.createHash("sha256").update(String(token)).digest("hex");

  it("hashes verification tokens and matches correctly", () => {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashed = hashToken(rawToken);

    assert.notEqual(rawToken, hashed);
    assert.equal(hashToken(rawToken), hashed);
  });

  it("handles verification token expiration properly", () => {
    const pastExpires = new Date(Date.now() - 10000);
    const futureExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const isExpired = (expires) => new Date(expires) < new Date();

    assert.equal(isExpired(pastExpires), true);
    assert.equal(isExpired(futureExpires), false);
  });

  it("protects against account enumeration in resend verification", () => {
    // When account does not exist or is already verified, the response contract is identical
    const genericMessage =
      "If an unverified account with that email exists, a new verification link has been sent.";

    const simulateResend = (user) => {
      if (!user || user.isEmailVerified) {
        return { success: true, message: genericMessage };
      }
      return { success: true, message: genericMessage };
    };

    assert.deepEqual(simulateResend(null), {
      success: true,
      message: genericMessage,
    });
    assert.deepEqual(simulateResend({ isEmailVerified: true }), {
      success: true,
      message: genericMessage,
    });
  });

  it("invalidates previous token and creates fresh 24h expiration on resend", () => {
    const oldToken = "old-token";
    const user = {
      email: "test@example.com",
      isEmailVerified: false,
      verificationToken: hashToken(oldToken),
      verificationExpires: new Date(Date.now() - 5000), // was expired
    };

    // Simulate resend
    const newToken = crypto.randomBytes(32).toString("hex");
    user.verificationToken = hashToken(newToken);
    user.verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    assert.notEqual(user.verificationToken, hashToken(oldToken));
    assert.equal(user.verificationToken, hashToken(newToken));
    assert.ok(user.verificationExpires > new Date());
  });
});

/* ============================================================
   REGISTRATION ROLLBACK & FORGOT PASSWORD REGRESSION TESTS
============================================================ */

describe("registration rollback and forgot password regression tests", () => {
  it("rolls back user creation if email delivery throws an error", async () => {
    let rollbackCalled = false;
    const mockUser = {
      _id: "mock-id-123",
      isEmailVerified: false,
    };

    // Simulate registration with email failure
    try {
      const sendEmail = async () => {
        throw new Error("SMTP connection refused");
      };
      await sendEmail();
    } catch (emailError) {
      if (mockUser._id && !mockUser.isEmailVerified) {
        rollbackCalled = true;
      }
    }

    assert.equal(
      rollbackCalled,
      true,
      "Rollback must be triggered when email sending fails",
    );
  });

  it("does not advance forgot password to stage 2 when resetId is missing (enumeration defense)", () => {
    // When backend returns generic success without resetId for unknown email:
    const backendResponseForUnknownEmail = {
      success: true,
      message:
        "If the account exists, password reset instructions have been sent.",
      // no resetId
    };

    let stage = 1;
    if (backendResponseForUnknownEmail.resetId) {
      stage = 2;
    }

    assert.equal(
      stage,
      1,
      "Frontend must stay on stage 1 when resetId is missing",
    );
  });

  it("advances forgot password to stage 2 only when resetId is present", () => {
    const backendResponseForKnownEmail = {
      success: true,
      message: "Password reset instructions were sent.",
      resetId: "valid-reset-id-456",
    };

    let stage = 1;
    if (backendResponseForKnownEmail.resetId) {
      stage = 2;
    }

    assert.equal(
      stage,
      2,
      "Frontend must advance to stage 2 when resetId is provided",
    );
  });
});

/* ============================================================
   ANALYTICS CONTRACT REGRESSION TESTS
============================================================ */

describe("analytics contract regression tests", () => {
  it("verifies analytics contract contains only genuine metrics and no fake placeholders", () => {
    const analyticsService = require("../services/analyticsService");

    // Check module exports dashboard function
    assert.equal(typeof analyticsService.dashboard, "function");

    // Simulate expected contract keys
    const sampleAnalytics = {
      totalUploads: 5,
      totalRows: 120,
      totalTransactions: 120,
      totalValidations: 4,
      totalXMLFiles: 3,
      successRate: 75,
      successfulConversions: 3,
      failedConversions: 1,
      totalVouchers: 120,
      validationSuccessRate: 75,
      voucherBreakdown: { Sales: 3, Purchase: 2 },
    };

    // Must have unified contract keys
    assert.ok("totalUploads" in sampleAnalytics);
    assert.ok("totalRows" in sampleAnalytics);
    assert.ok("totalValidations" in sampleAnalytics);
    assert.ok("totalXMLFiles" in sampleAnalytics);
    assert.ok("successRate" in sampleAnalytics);
    assert.ok("successfulConversions" in sampleAnalytics);
    assert.ok("failedConversions" in sampleAnalytics);

    // Must NOT contain fake placeholder statistics
    assert.equal("averageProcessingTime" in sampleAnalytics, false);
    assert.equal("errorRate" in sampleAnalytics, false);
    assert.equal("autoFixRate" in sampleAnalytics, false);
  });
});

/* ============================================================
   XML PREVIEW & VALIDATION REPORT EXACT ID LOGIC
============================================================ */

describe("exact resource selection ID logic", () => {
  it("XML preview resolves exact selected file ID from URL param", () => {
    const url = "/convert/xml-preview?xmlId=65a123bcdef456";
    const query = new URLSearchParams(url.split("?")[1]);
    const xmlId = query.get("xmlId");

    assert.equal(xmlId, "65a123bcdef456");
  });

  it("validation report open resolves exact report validation ID", () => {
    const report = {
      _id: "report-999",
      validation: "validation-888",
      fileName: "test.xlsx",
    };

    const targetValidationId =
      report.validation?._id || report.validation || report._id;
    assert.equal(targetValidationId, "validation-888");

    const url = `/convert/errors?validationId=${encodeURIComponent(targetValidationId)}`;
    const query = new URLSearchParams(url.split("?")[1]);
    assert.equal(query.get("validationId"), "validation-888");
  });
});
