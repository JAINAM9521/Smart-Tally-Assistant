"use client";
import { ChevronDown } from "lucide-react";

const faqItems = [
  {
    q: "What is Smart Tally XML Assistant?",
    a: "Smart Tally XML Assistant is a specialized accounting workspace that prepares, validates, and converts spreadsheet transaction data into clean, Tally-compatible XML ready for direct import into Tally Prime.",
  },
  {
    q: "Which file formats are supported?",
    a: "We support CSV, XLS, and XLSX spreadsheet files across all standard voucher types including Sales, Purchase, Payment, Receipt, Contra, Journal, Debit Note, and Credit Note.",
  },
  {
    q: "What does validation check?",
    a: "Our validation engine verifies required accounting fields, date formats, ledger name consistency against Tally standards, GSTIN formatting, voucher numbering uniqueness, and balanced debit and credit amounts.",
  },
  {
    q: "Can common errors be fixed automatically?",
    a: "Yes. Safe discrepancies such as currency symbols, comma separations, date formatting variations, and canonical ledger name casing are automatically resolved with Auto Fix, while ambiguous accounting records remain flagged for review.",
  },
  {
    q: "Can I preview XML before downloading?",
    a: "Yes. You can inspect the complete Tally-compatible XML structure, voucher counts, and totals in the interactive XML preview before downloading the final file.",
  },
  {
    q: "How do I import XML into Tally?",
    a: "Download the generated XML file, open your company in Tally Prime, navigate to Import > Transactions, and select the XML file to import your records directly.",
  },
];

export default function FaqSection({ open, setOpen }) {
  return (
    <section className="section faq" id="faq">
      <div className="section-heading">
        <div>
          <div className="eyebrow">NEED TO KNOW</div>
          <h2>
            Answers before
            <br />
            <em>you begin.</em>
          </h2>
        </div>
        <p>
          A safer conversion starts with clear expectations. Here are common
          questions from finance teams.
        </p>
      </div>
      <div className="faq-list">
        {faqItems.map((item, i) => (
          <button
            key={item.q}
            type="button"
            onClick={() => setOpen(open === i ? null : i)}
          >
            <span>
              <b>0{i + 1}</b>
              {item.q}
            </span>
            <ChevronDown className={open === i ? "rotate" : ""} />
            {open === i && <p>{item.a}</p>}
          </button>
        ))}
      </div>
    </section>
  );
}
