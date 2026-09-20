"use strict";

const {
  normalizeAmount,
  normalizeDate,
} = require("./validationService");
const {
  getRecommendationValue,
  toPlainIssue,
} = require("./issueFixService");

exports.applySafeFixes = (issues) => {
  if (!Array.isArray(issues)) {
    return [];
  }

  return issues.map((rawIssue) => {
    const issue = toPlainIssue(rawIssue);

    if (!issue?.autoFixable || issue.status !== "pending") {
      return issue;
    }

    const column = String(issue.column ?? "").trim();
    let suggestedValue = "";

    if (column === "AMOUNT") {
      suggestedValue = normalizeAmount(issue.currentValue) || "";
    } else if (column === "DATE") {
      suggestedValue = normalizeDate(issue.currentValue) || "";
    } else {
      suggestedValue = getRecommendationValue(issue);
    }

    if (!suggestedValue) {
      suggestedValue = getRecommendationValue(issue);
    }

    if (!suggestedValue) {
      return issue;
    }

    return {
      ...issue,
      currentValue: suggestedValue,
      suggestedValue,
      status: "fixed",
    };
  });
};
