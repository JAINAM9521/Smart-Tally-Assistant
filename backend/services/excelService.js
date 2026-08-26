const XLSX = require("xlsx");
const columns = ["DATE", "BY-DR", "TO-CR", "AMOUNT", "VOUCHER NO.", "GST DETAILS", "NARRATION", "REFERENCE NO."];
exports.templateColumns = columns;
exports.readWorkbook = filePath => { const workbook = XLSX.readFile(filePath, { cellDates: false }); const sheet = workbook.Sheets[workbook.SheetNames[0]]; const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" }); return { rows, columns: XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })[0] || columns }; };
exports.toCsv = () => { const rows = [[...columns], ["01-08-2026", "Customer A/c", "Sales A/c", "10000", "INV-101", "CGST 900 / SGST 900", "August sales transaction", "REF-101"]]; return rows.map(row => row.join(",")).join("\n"); };
