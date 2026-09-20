const path = require("path");
const fs = require("fs");

const Validation = require("../models/Validation");
const XMLFile = require("../models/XMLFile");
const Upload = require("../models/Upload");

const {
  buildXml,
  validateXml,
  validateRowsForXml,
} = require("../services/xmlService");

const { ensureDirectories } = require("../utils/fileUtils");

const { xmlDir } = require("../config/env");

/* =========================================================
   GENERATE XML
========================================================= */

exports.generate = async (req, res, next) => {
  try {
    const validation = await Validation.findOne({
      _id: req.params.validationId,
      ...(req.user.role === "admin"
        ? {}
        : {
            user: req.user._id,
          }),
    });

    if (!validation) {
      return res.status(404).json({
        success: false,
        message: "Validation run not found.",
        code: "NOT_FOUND",
      });
    }

    if (
      validation.status !== "validated" ||
      Number(validation.errors || 0) !== 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please fix all validation errors and revalidate before generating XML.",
        code: "VALIDATION_ERROR",
      });
    }

    const upload = await Upload.findOne({
      _id: validation.upload,
      ...(req.user.role === "admin" ? {} : { user: req.user._id }),
    });

    if (!upload) {
      return res.status(404).json({
        success: false,
        message: "Original upload not found.",
        code: "UPLOAD_NOT_FOUND",
      });
    }

    const rows = Array.isArray(upload.dataRows) ? upload.dataRows : [];

    if (!rows.length) {
      return res.status(400).json({
        success: false,
        message: "No accounting rows are available for XML generation.",
        code: "NO_DATA",
      });
    }

    /*
     * IMPORTANT:
     * Do not generate XML from invalid/raw rows.
     *
     * This check prevents the application from claiming
     * "100% valid" while producing invalid accounting XML.
     */
    const rowValidation = validateRowsForXml(rows, upload.voucherType);

    if (!rowValidation.valid) {
      return res.status(400).json({
        success: false,
        message:
          "The validated record does not match the source rows used for XML generation.",
        code: "SOURCE_DATA_MISMATCH",
        issues: rowValidation.issues,
      });
    }

    const xmlContent = buildXml({
      voucherType: upload.voucherType,
      rows,
    });

    const xmlCheck = validateXml(xmlContent);

    if (!xmlCheck.valid) {
      return res.status(400).json({
        success: false,
        message: xmlCheck.message || "Generated XML failed structural validation.",
        code: "XML_VALIDATION_ERROR",
      });
    }

    const originalName = String(upload.originalName || "tally");

    const baseName = originalName.replace(/\.[^.]+$/, "");

    const fileName = `${baseName}_${Date.now()}.xml`;

    const totalAmount = rows.reduce(
      (sum, row) =>
        sum +
        (Number(
          String(row?.AMOUNT ?? row?.amount ?? 0).replace(/[₹$€£,\s]/g, ""),
        ) || 0),
      0,
    );

    const file = await XMLFile.create({
      user: validation.user,

      validation: validation._id,

      fileName,

      voucherType: upload.voucherType,

      totalVouchers: rows.length,

      totalTransactions: rows.length,

      totalAmount,

      size: `${Buffer.byteLength(xmlContent, "utf8")} bytes`,

      status: "Ready",

      xmlContent,
    });

    try {
      const outputDirectory = path.resolve(__dirname, "..", xmlDir);
      ensureDirectories(outputDirectory);
      fs.writeFileSync(path.join(outputDirectory, fileName), xmlContent, "utf8");
    } catch (diskError) {
      console.warn(
        "XML was saved in the database, but the local file copy could not be written:",
        diskError?.message || diskError,
      );
    }

    return res.status(201).json({
      success: true,
      xml: file,
    });
  } catch (error) {
    return next(error);
  }
};

/* =========================================================
   LIST XML FILES
========================================================= */

exports.list = async (req, res, next) => {
  try {
    const filter =
      req.user.role === "admin"
        ? {}
        : {
            user: req.user._id,
          };

    const page = Math.max(1, Number(req.query.page || 1));

    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      XMLFile.find(filter)
        .select("-xmlContent")
        .sort("-createdAt")
        .skip(skip)
        .limit(limit),

      XMLFile.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return next(error);
  }
};

/* =========================================================
   GET ONE XML FILE
========================================================= */

exports.get = async (req, res, next) => {
  try {
    const file = await XMLFile.findOne({
      _id: req.params.xmlId,

      ...(req.user.role === "admin"
        ? {}
        : {
            user: req.user._id,
          }),
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "XML file not found",
        code: "NOT_FOUND",
      });
    }

    return res.json({
      success: true,
      file,
    });
  } catch (error) {
    return next(error);
  }
};

/* =========================================================
   DOWNLOAD XML
========================================================= */

exports.download = async (req, res, next) => {
  try {
    const file = await XMLFile.findOne({
      _id: req.params.xmlId,

      ...(req.user.role === "admin"
        ? {}
        : {
            user: req.user._id,
          }),
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "XML file not found",
        code: "NOT_FOUND",
      });
    }

    res.setHeader("Content-Type", "application/xml; charset=utf-8");

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.fileName}"`,
    );

    return res.send(file.xmlContent);
  } catch (error) {
    return next(error);
  }
};

/* =========================================================
   DELETE XML
========================================================= */

exports.remove = async (req, res, next) => {
  try {
    const file = await XMLFile.findOneAndDelete({
      _id: req.params.xmlId,

      ...(req.user.role === "admin"
        ? {}
        : {
            user: req.user._id,
          }),
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "XML file not found",
        code: "NOT_FOUND",
      });
    }

    return res.json({
      success: true,
      message: "XML file deleted",
    });
  } catch (error) {
    return next(error);
  }
};
