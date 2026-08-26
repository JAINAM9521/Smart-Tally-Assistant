const { z } = require("zod"); exports.voucherSchema = z.enum(["Sales", "Purchase", "Payment", "Receipt", "Contra", "Journal", "Credit Note", "Debit Note"]);
