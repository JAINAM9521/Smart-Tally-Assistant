"use strict";

const Upload = require("../models/Upload");
const {
  readWorkbook,
  templateColumns,
  toCsv,
} = require("../services/excelService");
const { voucherSchema } = require("../validators/uploadValidator");
const { removeFile } = require("../utils/fileUtils");

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

exports.template = (req, res) => {
  res.json({
    success: true,
    voucherType: req.params.voucherType,
    columns: templateColumns,
  });
};

exports.templateDownload = (req, res) => {
  const voucherType = String(req.params.voucherType || "template");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${voucherType
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")}_template.csv`,
  );
  res.send(toCsv());
};

exports.create = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Excel file is required",
        code: "VALIDATION_ERROR",
      });
    }

    const voucherType = voucherSchema.safeParse(req.body.voucherType);
    if (!voucherType.success) {
      removeFile(req.file.path);
      return res.status(400).json({
        success: false,
        message: "A supported voucher type is required.",
        code: "VALIDATION_ERROR",
      });
    }

    const workbook = readWorkbook(req.file.path);

    const upload = await Upload.create({
      user: req.user._id,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      voucherType: voucherType.data,
      rows: workbook.rows.length,
      columns: workbook.columns.length,
      previewRows: workbook.rows.slice(0, 100),
      dataRows: workbook.rows,
      totalRows: workbook.rows.length,
      processedRows: workbook.rows.length,
      progress: 100,
      status: "uploaded",
    });

    const payload = upload.toObject();
    delete payload.path;

    // Clean up temporary uploaded file from disk now that dataRows are in MongoDB
    removeFile(req.file.path);

    res.status(201).json({ success: true, upload: payload });
  } catch (error) {
    if (req.file?.path) {
      removeFile(req.file.path);
    }
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        code: error.code || "VALIDATION_ERROR",
      });
    }
    next(error);
  }
};

exports.preview = async (req, res, next) => {
  try {
    const upload = await Upload.findOne({
      _id: req.params.uploadId,
      ...(req.user.role === "admin" ? {} : { user: req.user._id }),
    });

    if (!upload) {
      return res.status(404).json({
        success: false,
        message: "Upload not found",
        code: "NOT_FOUND",
      });
    }

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
    const totalRows = upload.rows || upload.dataRows.length;
    const rows = upload.dataRows.slice((page - 1) * limit, page * limit);

    res.json({
      success: true,
      columns: templateColumns,
      rows,
      totalRows,
      totalColumns: upload.columns,
      page,
      limit,
      totalPages: Math.ceil(totalRows / limit),
    });
  } catch (error) {
    next(error);
  }
};

exports.list = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Number(req.query.limit || 20));
    const filter = req.user.role === "admin" ? {} : { user: req.user._id };

    if (req.query.search) {
      const search = new RegExp(escapeRegex(req.query.search), "i");
      filter.$or = [
        { fileName: search },
        { voucherType: search },
        { status: search },
      ];
    }

    if (req.query.status) filter.status = req.query.status;
    if (req.query.voucherType) filter.voucherType = req.query.voucherType;

    const sortField = (req.query.sort || "").replace("-", "");
    const sort = ["createdAt", "fileName", "voucherType", "status"].includes(
      sortField,
    )
      ? req.query.sort
      : "-createdAt";

    const [items, total] = await Promise.all([
      Upload.find(filter)
        .select("-path")
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit),
      Upload.countDocuments(filter),
    ]);

    res.json({
      success: true,
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};

exports.status = async (req, res, next) => {
  try {
    const upload = await Upload.findOne({
      _id: req.params.conversionId,
      ...(req.user.role === "admin" ? {} : { user: req.user._id }),
    });

    if (!upload) {
      return res.status(404).json({
        success: false,
        message: "Conversion not found",
        code: "NOT_FOUND",
      });
    }

    res.json({
      success: true,
      status: upload.status,
      progress: upload.progress,
      processedRows: upload.processedRows,
      totalRows: upload.totalRows,
      errors: upload.errors,
      warnings: upload.warnings,
    });
  } catch (error) {
    next(error);
  }
};
