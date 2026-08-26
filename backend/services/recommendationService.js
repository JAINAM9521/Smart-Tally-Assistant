const Fuse = require("fuse.js");
const ledgers = ["Sales A/c", "Purchase A/c", "Cash A/c", "Bank A/c", "Customer A/c"];
exports.suggestLedger = currentValue => { const match = new Fuse(ledgers, { includeScore: true }).search(currentValue)[0]; if (!match) return null; return { currentValue, suggestedValue: match.item, confidence: Math.round((1 - (match.score || 0)) * 100), reason: "Closest configured Tally ledger match." }; };
