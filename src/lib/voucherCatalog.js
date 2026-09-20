export const voucherTypes = [
  { name: "Sales", color: "teal", note: "Customer invoices and sales entries" },
  {
    name: "Purchase",
    color: "blue",
    note: "Supplier invoices and purchase entries",
  },
  { name: "Payment", color: "purple", note: "Outgoing payment vouchers" },
  { name: "Receipt", color: "green", note: "Incoming receipt vouchers" },
  { name: "Contra", color: "amber", note: "Cash and bank transfers" },
  { name: "Journal", color: "red", note: "Adjustment journal entries" },
  {
    name: "Credit Note",
    color: "teal",
    note: "Sales return and credit adjustments",
  },
  {
    name: "Debit Note",
    color: "blue",
    note: "Purchase return and debit adjustments",
  },
];

export const templateColumns = [
  "DATE",
  "BY-DR",
  "TO-CR",
  "AMOUNT",
  "VOUCHER NO.",
  "GSTIN",
  "NARRATION",
  "REFERENCE NO.",
];
