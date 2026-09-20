"use strict";

const { ledgers, suggestLedger } = require("./validationService");

exports.suggestLedger = (currentValue) => {
  const suggestedValue = suggestLedger(currentValue);
  if (!suggestedValue) return null;

  return {
    currentValue,
    suggestedValue,
    reason: "Closest configured Tally ledger match.",
    catalog: ledgers,
  };
};
