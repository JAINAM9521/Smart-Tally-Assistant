"use strict";

const { normalizeAmount, normalizeDate } = require("./validationService");

/* =========================================================
   EXTRACT SUGGESTED VALUE FROM RECOMMENDATION
========================================================= */

/*
 * Examples:
 *
 * "Use Sales A/c."
 *        ↓
 * "Sales A/c"
 *
 * "Use 12500."
 *        ↓
 * "12500"
 */

function getRecommendationValue(issue) {
  const recommendation = String(issue?.recommendation ?? "").trim();

  const match = recommendation.match(/^Use\s+(.+?)\.?$/i);

  if (!match) {
    return "";
  }

  return String(match[1]).trim();
}

/* =========================================================
   AUTO FIX
========================================================= */

exports.applySafeFixes = (issues) => {
  if (!Array.isArray(issues)) {
    return [];
  }

  return issues.map((issue) => {
    /*
     * Only pending issues that are explicitly marked
     * auto-fixable can be processed.
     */
    if (!issue?.autoFixable || issue.status !== "pending") {
      return issue;
    }

    const column = String(issue.column ?? "").trim();

    let value = issue.currentValue;

    /* =====================================================
       AMOUNT
    ===================================================== */

    if (column === "AMOUNT") {
      const normalized = normalizeAmount(value);

      if (!normalized) {
        return issue;
      }

      return {
        ...(issue.toObject?.() || issue),

        currentValue: normalized,

        /*
         * Controller uses suggestedValue to update
         * the actual Upload.dataRows value.
         */
        suggestedValue: normalized,

        status: "fixed",
      };
    }

    /* =====================================================
       DATE
    ===================================================== */

    if (column === "DATE") {
      const normalized = normalizeDate(value);

      if (!normalized) {
        return issue;
      }

      return {
        ...(issue.toObject?.() || issue),

        currentValue: normalized,

        /*
         * Controller uses this value to update
         * Upload.dataRows.
         */
        suggestedValue: normalized,

        status: "fixed",
      };
    }

    /* =====================================================
       TO-CR / LEDGER
    ===================================================== */

    if (column === "TO-CR" || column === "PARTYLEDGERNAME") {
      const suggestedValue = getRecommendationValue(issue);

      if (!suggestedValue) {
        return issue;
      }

      return {
        ...(issue.toObject?.() || issue),

        currentValue: suggestedValue,

        /*
         * Controller will use this value to update
         * the actual source row.
         */
        suggestedValue,

        status: "fixed",
      };
    }

    /* =====================================================
       OTHER SAFE RECOMMENDATIONS
    ===================================================== */

    const suggestedValue = getRecommendationValue(issue);

    if (suggestedValue) {
      return {
        ...(issue.toObject?.() || issue),

        currentValue: suggestedValue,

        suggestedValue,

        status: "fixed",
      };
    }

    /*
     * No concrete value available.
     * Keep issue pending.
     */
    return issue;
  });
};
