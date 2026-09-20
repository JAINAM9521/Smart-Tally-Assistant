"use strict";

const { create } = require("xmlbuilder2");
const { XMLParser } = require("fast-xml-parser");

function normalizeDate(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const iso = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) {
    return toTallyDate(Number(iso[3]), Number(iso[2]), Number(iso[1]));
  }

  const separated = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (separated) {
    return toTallyDate(
      Number(separated[1]),
      Number(separated[2]),
      Number(separated[3]),
    );
  }

  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    return toTallyDate(
      Number(compact[3]),
      Number(compact[2]),
      Number(compact[1]),
    );
  }

  return "";
}

function toTallyDate(day, month, year) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "";
  }

  return `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
}

function normalizeAmount(value) {
  const raw = String(value ?? "")
    .trim()
    .replace(/[₹$€£,\s]/g, "");
  if (!raw || !/^\d+(?:\.\d+)?$/.test(raw)) return "";
  const number = Number(raw);
  return Number.isFinite(number) && number >= 0 ? number.toFixed(2) : "";
}

function getVoucherNumber(row) {
  return String(
    row?.["VOUCHER NO."] ??
      row?.["VOUCHER NO"] ??
      row?.VOUCHERNUMBER ??
      row?.["VOUCHER NUMBER"] ??
      "",
  ).trim();
}

function getDebitLedger(row) {
  return String(row?.["BY-DR"] ?? row?.BY_DR ?? "").trim();
}

function getCreditLedger(row) {
  return String(row?.["TO-CR"] ?? row?.TO_CR ?? "").trim();
}

function getNarration(row) {
  return String(row?.NARRATION ?? row?.Narration ?? "").trim();
}

function isInvoiceType(voucherType) {
  return ["Sales", "Purchase"].includes(voucherType);
}

function partyLedgerName(type, debitLedger, creditLedger) {
  if (type === "Sales" || type === "Debit Note" || type === "Payment")
    return debitLedger;
  if (type === "Purchase" || type === "Credit Note" || type === "Receipt")
    return creditLedger;
  return "";
}

function validateRowsForXml(rows, voucherType) {
  const issues = [];
  const type = String(voucherType ?? "").trim();

  if (!type) {
    return {
      valid: false,
      issues: [
        { row: 0, column: "VOUCHER TYPE", message: "Voucher type is missing." },
      ],
    };
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      valid: false,
      issues: [
        {
          row: 0,
          column: "DATA",
          message: "No accounting rows are available.",
        },
      ],
    };
  }

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const date = normalizeDate(row?.DATE);
    const amount = normalizeAmount(row?.AMOUNT);
    const voucherNumber = getVoucherNumber(row);
    const debitLedger = getDebitLedger(row);
    const creditLedger = getCreditLedger(row);

    if (!date)
      issues.push({
        row: rowNumber,
        column: "DATE",
        message: "Invalid or missing date.",
      });
    if (!amount || Number(amount) <= 0)
      issues.push({
        row: rowNumber,
        column: "AMOUNT",
        message: "Invalid or missing amount.",
      });
    if (!voucherNumber)
      issues.push({
        row: rowNumber,
        column: "VOUCHER NO.",
        message: "Missing voucher number.",
      });
    if (!debitLedger)
      issues.push({
        row: rowNumber,
        column: "BY-DR",
        message: "Missing debit ledger (BY-DR).",
      });
    if (!creditLedger)
      issues.push({
        row: rowNumber,
        column: "TO-CR",
        message: "Missing credit ledger (TO-CR).",
      });
    if (
      debitLedger &&
      creditLedger &&
      debitLedger.toLowerCase() === creditLedger.toLowerCase()
    ) {
      issues.push({
        row: rowNumber,
        column: "BY-DR / TO-CR",
        message: "Debit and credit ledgers cannot be the same.",
      });
    }
  });

  return { valid: issues.length === 0, issues };
}

function addLedgerEntry(
  voucher,
  ledgerName,
  amount,
  debit,
  party = false,
  voucherNumber = "",
) {
  const entry = voucher.ele("ALLLEDGERENTRIES.LIST");
  entry.ele("LEDGERNAME").txt(ledgerName).up();
  entry
    .ele("ISDEEMEDPOSITIVE")
    .txt(debit ? "Yes" : "No")
    .up();
  if (party) entry.ele("ISPARTYLEDGER").txt("Yes").up();
  if (party)
    entry
      .ele("ISLASTDEEMEDPOSITIVE")
      .txt(debit ? "Yes" : "No")
      .up();
  if (party && voucherNumber) {
    const bill = entry.ele("BILLALLOCATIONS.LIST");
    bill.ele("NAME").txt(voucherNumber).up();
    bill.ele("BILLTYPE").txt("New Ref").up();
    bill
      .ele("AMOUNT")
      .txt(debit ? `-${amount}` : amount)
      .up();
    bill.up();
  }
  entry
    .ele("AMOUNT")
    .txt(debit ? `-${amount}` : amount)
    .up();
  entry.up();
}

function buildXml({ voucherType, rows }) {
  const type = String(voucherType || "").trim();
  const cursor = create({ version: "1.0", encoding: "UTF-8" })
    .ele("ENVELOPE")
    .ele("HEADER")
    .ele("VERSION")
    .txt("1")
    .up()
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
    .ele("REQUESTDATA");

  rows.forEach((row) => {
    const date = normalizeDate(row?.DATE);
    const amount = normalizeAmount(row?.AMOUNT);
    const voucherNumber = getVoucherNumber(row);
    const debitLedger = getDebitLedger(row);
    const creditLedger = getCreditLedger(row);
    const narration = getNarration(row);
    const partyName = partyLedgerName(type, debitLedger, creditLedger);

    const message = cursor.ele("TALLYMESSAGE");
    const voucher = message.ele("VOUCHER", {
      VCHTYPE: type,
      ACTION: "Create",
      OBJVIEW: "Accounting Voucher View",
    });

    voucher.ele("DATE").txt(date).up();
    voucher.ele("VOUCHERTYPENAME").txt(type).up();
    voucher.ele("VOUCHERNUMBER").txt(voucherNumber).up();
    if (partyName) voucher.ele("PARTYLEDGERNAME").txt(partyName).up();
    voucher.ele("PERSISTEDVIEW").txt("Accounting Voucher View").up();
    voucher
      .ele("ISINVOICE")
      .txt(isInvoiceType(type) ? "Yes" : "No")
      .up();

    if (narration) voucher.ele("NARRATION").txt(narration).up();

    const partyIsDebit =
      type === "Sales" || type === "Debit Note" || type === "Payment";
    const partyIsCredit =
      type === "Purchase" || type === "Credit Note" || type === "Receipt";

    addLedgerEntry(
      voucher,
      debitLedger,
      amount,
      true,
      partyIsDebit,
      voucherNumber,
    );
    addLedgerEntry(
      voucher,
      creditLedger,
      amount,
      false,
      partyIsCredit,
      voucherNumber,
    );

    voucher.up();
    message.up();
  });

  return cursor.end({ prettyPrint: true });
}

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function parseXml(xml) {
  return new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    parseAttributeValue: false,
  }).parse(xml);
}

function validateXml(xml) {
  try {
    const parsed = parseXml(xml);
    const envelope = parsed?.ENVELOPE;
    const header = envelope?.HEADER;
    const requestData = envelope?.BODY?.IMPORTDATA?.REQUESTDATA;
    const messages = requestData?.TALLYMESSAGE;

    if (!header || !requestData || !messages) {
      return {
        valid: false,
        message: "XML is missing ENVELOPE, IMPORTDATA or TALLYMESSAGE.",
      };
    }

    const vouchers = asArray(messages);
    const ok = vouchers.every((message) => {
      const voucher = message?.VOUCHER;
      const entries = asArray(voucher?.["ALLLEDGERENTRIES.LIST"]);
      const date = String(voucher?.DATE ?? "");
      return (
        Boolean(voucher) &&
        entries.length >= 2 &&
        /^\d{8}$/.test(date) &&
        Boolean(voucher.VOUCHERTYPENAME) &&
        Boolean(voucher.VOUCHERNUMBER)
      );
    });

    return ok
      ? { valid: true }
      : {
          valid: false,
          message:
            "XML vouchers are missing required date, type, number or ledger entries.",
        };
  } catch {
    return {
      valid: false,
      message: "Generated XML could not be parsed.",
    };
  }
}

module.exports = {
  buildXml,
  validateXml,
  validateRowsForXml,
  normalizeDate,
  normalizeAmount,
  parseXml,
};
