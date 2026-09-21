"use strict";

const ValidationReport = require("../models/ValidationReport");

exports.list = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Number(req.query.limit || 20));
    const filter = req.user.role === "admin" ? {} : { user: req.user._id };
    const [items, total] = await Promise.all([
      ValidationReport.find(filter)
        .sort("-createdAt")
        .skip((page - 1) * limit)
        .limit(limit),
      ValidationReport.countDocuments(filter),
    ]);
    res.json({
      success: true,
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (e) {
    next(e);
  }
};

exports.get = async (req, res, next) => {
  try {
    const filter = req.user.role === "admin" ? {} : { user: req.user._id };
    const report = await ValidationReport.findOne({
      $and: [
        filter,
        { $or: [{ _id: req.params.id }, { validation: req.params.id }] },
      ],
    });
    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Validation report not found",
        code: "NOT_FOUND",
      });
    }
    res.json({ success: true, report });
  } catch (e) {
    next(e);
  }
};
