"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Database,
  Download,
  Eye,
  FileCode2,
  FileSpreadsheet,
  ShieldCheck,
  Sparkles,
  Upload,
  WandSparkles,
} from "lucide-react";

import { voucherTypes, templateColumns } from "../../lib/voucherCatalog";

import {
  autoFixErrors,
  applyRecommendation,
  downloadTemplate,
  downloadXML,
  fixIssue,
  generateXML,
  getXML,
  getUploadPreview,
  ignoreIssue,
  revalidateData,
  uploadExcel,
  validateExcel,
} from "../../lib/api";

import { read, save } from "../../lib/utils";

import { Badge, PageTitle, Stat } from "../dashboard/DashboardPage";

import AnimatedIcon from "../ui/AnimatedIcon";
import Toast from "../ui/Toast";

/* =========================================================
   MAIN CONVERSION COMPONENT
========================================================= */

function Conversion() {
  const path = usePathname();
  const router = useRouter();

  const [selected, setSelected] = useState(() =>
    read("selectedVoucher", "Sales"),
  );

  const [file, setFile] = useState(null);
  const [upload, setUpload] = useState(null);
  const [preview, setPreview] = useState(null);
  const [validation, setValidation] = useState(null);

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [recommendationStatus, setRecommendationStatus] = useState("pending");

  const step = path.includes("select")
    ? 1
    : path.includes("template")
      ? 2
      : path.includes("upload")
        ? 3
        : path.includes("validation") || path.includes("errors")
          ? 4
          : path.includes("xml-preview")
            ? 6
            : 5;

  /* =========================================================
     HELPERS
  ========================================================= */

  const notify = (message) => {
    setNotice(message);

    window.setTimeout(() => {
      setNotice("");
    }, 2600);
  };

  const go = (route) => {
    router.push(route);
  };

  /* =========================================================
     RESTORE UPLOAD STATE AFTER REFRESH
  ========================================================= */

  useEffect(() => {
    const uploadId = read("backendUploadId", null);

    if (!uploadId) {
      return;
    }

    const restorePreview = async () => {
      try {
        const result = await getUploadPreview(uploadId);

        if (result) {
          setPreview(result);

          setUpload({
            _id: uploadId,
          });
        }
      } catch {
        // Previous upload may no longer exist.
      }
    };

    restorePreview();
  }, []);

  /* =========================================================
     RESTORE VALIDATION STATE AFTER OPEN / REFRESH
  ========================================================= */

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const queryValidationId = params.get("validationId");

    const validationId = queryValidationId || read("backendValidationId", null);

    if (!validationId) {
      return;
    }

    save("backendValidationId", validationId);

    const storedValidation = read(
      `backendValidationResult:${validationId}`,
      null,
    );

    if (storedValidation) {
      setValidation(storedValidation);
    }
  }, []);

  /* =========================================================
     UPLOAD EXCEL
  ========================================================= */

  const doUpload = async () => {
    if (!file) {
      notify("Select an Excel file first.");
      return;
    }

    setBusy(true);

    try {
      const result = await uploadExcel(file, selected);

      if (!result?._id) {
        throw new Error("Backend did not return a valid upload ID.");
      }

      setUpload(result);

      save("backendUploadId", result._id);

      const previewResult = await getUploadPreview(result._id);

      setPreview(previewResult);

      go("/convert/validation");
    } catch (error) {
      notify(error?.message || "Unable to upload the Excel file.");
    } finally {
      setBusy(false);
    }
  };

  /* =========================================================
     VALIDATE EXCEL
  ========================================================= */

  const doValidate = async () => {
    const uploadId = upload?._id || read("backendUploadId", null);

    if (!uploadId) {
      notify("Upload an Excel file before validation.");
      return;
    }

    setBusy(true);

    try {
      const result = await validateExcel(uploadId);

      if (!result) {
        throw new Error("Backend returned an empty validation result.");
      }

      setValidation(result);

      const validationId = result.validationId || result._id || null;

      if (validationId) {
        save("backendValidationId", validationId);
        save(`backendValidationResult:${validationId}`, result);
      }

      go("/convert/errors");
    } catch (error) {
      notify(error?.message || "Validation failed.");
    } finally {
      setBusy(false);
    }
  };

  /* =========================================================
     AUTO FIX
  ========================================================= */

  const doAutoFix = async () => {
    setBusy(true);

    try {
      const result = await autoFixErrors();

      if (result) {
        setValidation(result);

        const validationId =
          result.validationId ||
          result._id ||
          read("backendValidationId", null);

        if (validationId) {
          save("backendValidationId", validationId);
          save(`backendValidationResult:${validationId}`, result);
        }
      }

      notify("Safe issues were auto-fixed. Revalidate before XML generation.");
    } catch (error) {
      notify(error?.message || "Auto Fix failed.");
    } finally {
      setBusy(false);
    }
  };

  /* =========================================================
     FIX INDIVIDUAL ISSUE
  ========================================================= */

  const doFix = async (issueId) => {
    if (!issueId) {
      notify("Invalid issue selected.");
      return;
    }

    setBusy(true);

    try {
      const result = await fixIssue(issueId);

      if (!result) {
        throw new Error("Backend did not return a fix result.");
      }

      setValidation((current) => {
        const updated = {
          ...current,
          ...result.summary,

          issues: (current?.issues || []).map((issue) =>
            String(issue.id) === String(issueId) ? result.updatedIssue : issue,
          ),
        };

        const validationId =
          current?.validationId || read("backendValidationId", null);

        if (validationId) {
          save(`backendValidationResult:${validationId}`, updated);
        }

        return updated;
      });
    } catch (error) {
      notify(error?.message || "Unable to fix this issue.");
    } finally {
      setBusy(false);
    }
  };

  /* =========================================================
     APPLY RECOMMENDATION
  ========================================================= */

  const doApply = async (issueId) => {
    if (!issueId) {
      notify("No recommendation is available.");
      return;
    }

    setBusy(true);

    try {
      const result = await applyRecommendation(issueId);

      setValidation((current) => {
        const updated = {
          ...current,
          ...result.summary,

          issues: (current?.issues || []).map((issue) =>
            String(issue.id) === String(issueId) ? result.updatedIssue : issue,
          ),
        };

        const validationId =
          current?.validationId || read("backendValidationId", null);

        if (validationId) {
          save(`backendValidationResult:${validationId}`, updated);
        }

        return updated;
      });

      setRecommendationStatus("applied");

      notify("Recommendation applied successfully.");
    } catch (error) {
      notify(error?.message || "Unable to apply recommendation.");
    } finally {
      setBusy(false);
    }
  };

  /* =========================================================
     IGNORE ISSUE
  ========================================================= */

  const doIgnore = async (issueId) => {
    if (!issueId) {
      notify("No issue selected to ignore.");
      return;
    }

    setBusy(true);

    try {
      const result = await ignoreIssue(issueId);

      setValidation((current) => {
        const updated = {
          ...current,
          ...result.summary,

          issues: (current?.issues || []).map((issue) =>
            String(issue.id) === String(issueId) ? result.updatedIssue : issue,
          ),
        };

        const validationId =
          current?.validationId || read("backendValidationId", null);

        if (validationId) {
          save(`backendValidationResult:${validationId}`, updated);
        }

        return updated;
      });

      setRecommendationStatus("ignored");

      notify("Issue marked as ignored.");
    } catch (error) {
      notify(error?.message || "Unable to ignore this issue.");
    } finally {
      setBusy(false);
    }
  };

  /* =========================================================
     REVALIDATE
  ========================================================= */

  const doRevalidate = async () => {
    setBusy(true);

    try {
      const result = await revalidateData();

      if (!result) {
        throw new Error("Backend returned no revalidation result.");
      }

      setValidation(result);

      const validationId =
        result.validationId || result._id || read("backendValidationId", null);

      if (validationId) {
        save("backendValidationId", validationId);
        save(`backendValidationResult:${validationId}`, result);
      }

      const valid =
        result.errors === 0 &&
        result.score === 100 &&
        result.status === "validated";

      notify(
        valid
          ? "Validation successful — 100% valid."
          : `${result.errors || 0} blocking errors remain.`,
      );
    } catch (error) {
      notify(error?.message || "Revalidation failed.");
    } finally {
      setBusy(false);
    }
  };

  /* =========================================================
     GENERATE XML
  ========================================================= */

  const doGenerate = async () => {
    const valid =
      validation &&
      validation.errors === 0 &&
      validation.score === 100 &&
      validation.status === "validated";

    if (!valid) {
      notify("Fix all blocking errors and revalidate before generating XML.");
      return;
    }

    setBusy(true);

    try {
      const xml = await generateXML();

      if (!xml?._id) {
        throw new Error("Backend did not return a valid XML file.");
      }

      save("backendXmlId", xml._id);

      go("/convert/xml-preview");
    } catch (error) {
      notify(error?.message || "XML generation failed.");
    } finally {
      setBusy(false);
    }
  };

  /* =========================================================
     RESET
  ========================================================= */

  const reset = () => {
    const validationId = read("backendValidationId", null);

    if (validationId) {
      localStorage.removeItem(`backendValidationResult:${validationId}`);
    }

    [
      "selectedVoucher",
      "backendUploadId",
      "backendValidationId",
      "backendXmlId",
    ].forEach((key) => {
      localStorage.removeItem(key);
    });

    setFile(null);
    setUpload(null);
    setPreview(null);
    setValidation(null);

    router.push("/convert/select-voucher");
  };

  /* =========================================================
     SUCCESS
  ========================================================= */

  if (path.includes("success")) {
    return <SuccessView onReset={reset} />;
  }

  /* =========================================================
     PAGE
  ========================================================= */

  return (
    <>
      <Toast message={notice} onClose={() => setNotice("")} />

      <ConversionStepper current={step} />

      <PageTitle
        eyebrow={`STEP 0${step} OF 06`}
        title={
          path.includes("select")
            ? "Select voucher type"
            : path.includes("template")
              ? "Start with the right template"
              : path.includes("upload")
                ? "Upload your completed Excel"
                : path.includes("validation")
                  ? "Validate before you generate"
                  : path.includes("errors")
                    ? "Review validation issues"
                    : path.includes("xml-preview")
                      ? "Your XML is ready to review"
                      : "Conversion complete"
        }
        description="All accounting data is processed by the real backend."
      />

      {/* STEP 1 — SELECT VOUCHER */}

      {path.includes("select") && (
        <>
          <div className="voucher-grid">
            {voucherTypes.map((voucher) => (
              <button
                type="button"
                onClick={() => {
                  setSelected(voucher.name);

                  save("selectedVoucher", voucher.name);
                }}
                className={`voucher-card ${
                  selected === voucher.name ? "selected" : ""
                }`}
                key={voucher.name}
              >
                <span className={`voucher-letter ${voucher.color}`}>
                  {voucher.name.charAt(0)}
                </span>

                <b>{voucher.name}</b>

                <small>{voucher.note}</small>

                {selected === voucher.name && (
                  <CheckCircle2 className="selected-check" size={18} />
                )}
              </button>
            ))}
          </div>

          <div className="step-footer">
            <span>
              Selected: <b>{selected}</b>
            </span>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => go("/convert/template")}
            >
              Continue
              <ArrowRight size={16} />
            </button>
          </div>
        </>
      )}

      {/* STEP 2 — TEMPLATE */}

      {path.includes("template") && (
        <TemplateView
          voucherType={selected}
          onContinue={() => go("/convert/upload")}
        />
      )}

      {/* STEP 3 — UPLOAD */}

      {path.includes("upload") && (
        <UploadView
          file={file}
          setFile={setFile}
          preview={preview}
          onContinue={doUpload}
          busy={busy}
        />
      )}

      {/* STEP 4 — VALIDATION */}

      {path.includes("validation") && (
        <ValidationView
          busy={busy}
          score={validation?.score}
          onContinue={doValidate}
        />
      )}

      {/* STEP 5 — ERRORS */}

      {path.includes("errors") && (
        <ErrorView
          validation={validation}
          busy={busy}
          recommendationStatus={recommendationStatus}
          onFixIssue={doFix}
          onApplySuggestion={doApply}
          onIgnoreSuggestion={doIgnore}
          onAutoFix={doAutoFix}
          onRevalidate={doRevalidate}
          onGenerate={doGenerate}
        />
      )}

      {/* STEP 6 — XML */}

      {path.includes("xml-preview") && <XmlView />}
    </>
  );
}

/* =========================================================
   CONVERSION STEPPER
========================================================= */

function ConversionStepper({ current }) {
  const labels = ["Voucher", "Template", "Upload", "Validate", "Fix", "XML"];

  return (
    <div className="conversion-stepper">
      {labels.map((label, index) => {
        const number = index + 1;

        return (
          <div className={number <= current ? "active" : ""} key={label}>
            <span>{number < current ? <Check size={13} /> : number}</span>

            {label}

            {index < labels.length - 1 && <i />}
          </div>
        );
      })}
    </div>
  );
}

/* =========================================================
   TEMPLATE VIEW
========================================================= */

function TemplateView({ voucherType, onContinue }) {
  const [notice, setNotice] = useState("");

  const handleDownload = async () => {
    try {
      await downloadTemplate(voucherType);
    } catch (error) {
      setNotice(error?.message || "Unable to download template.");
    }
  };

  const instructions = [
    "Use exact Tally ledger names",
    "Use valid DD-MM-YYYY dates",
    "Keep amounts numeric — no symbols",
    "Add GSTIN, HSN/SAC where needed",
    "Do not leave mandatory cells blank",
  ];

  return (
    <div className="conversion-split">
      <section className="panel template-panel">
        <div className="template-file">
          <span className="file-icon">
            <FileSpreadsheet />
          </span>

          <div>
            <b>{voucherType} voucher template</b>

            <small>
              Download the real backend template before entering accounting
              data.
            </small>
          </div>

          <button type="button" className="icon-btn" onClick={handleDownload}>
            <Download size={17} />
          </button>
        </div>

        <div className="app-table">
          <div className="table-row head">
            {templateColumns.map((column) => (
              <span key={column}>{column}</span>
            ))}
          </div>

          <div className="empty-state">
            <FileSpreadsheet size={22} />

            <b>No sample accounting rows</b>

            <small>
              The template download above is generated by the backend.
            </small>
          </div>
        </div>

        <Toast message={notice} onClose={() => setNotice("")} />
      </section>

      <aside className="panel instruction-panel">
        <span className="eyebrow">FILL IT RIGHT</span>

        <h3>Small details make a clean import.</h3>

        {instructions.map((instruction) => (
          <p key={instruction}>
            <Check size={14} />

            {instruction}
          </p>
        ))}

        <button
          type="button"
          className="btn btn-primary full"
          onClick={onContinue}
        >
          I&apos;ve filled the template
          <ArrowRight size={15} />
        </button>
      </aside>
    </div>
  );
}

/* =========================================================
   UPLOAD VIEW
========================================================= */

function UploadView({ file, setFile, preview, onContinue, busy }) {
  const [notice, setNotice] = useState("");

  const handleFileChange = (event) => {
    const nextFile = event.target.files?.[0];

    if (!nextFile) {
      return;
    }

    setFile(nextFile);

    setNotice("File selected. Upload it to the backend to continue.");
  };

  return (
    <div className="upload-layout">
      <Toast message={notice} onClose={() => setNotice("")} />

      <label className="upload-zone">
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
        />

        <span className="upload-icon">
          <AnimatedIcon icon={Upload} animation="float" />
        </span>

        <h3>{file ? file.name : "Drop your Excel file here"}</h3>

        <p>
          {file
            ? "Ready to upload and parse"
            : "or click to browse from your computer"}
        </p>

        <small>
          .XLSX · .XLS · .CSV <b>up to 25 MB</b>
        </small>
      </label>

      {file && (
        <div className="panel file-ready">
          <CheckCircle2 size={28} />

          <div>
            <b>{file.name}</b>

            <span>
              {(file.size / 1024).toFixed(0)} KB · backend determines row count
              after upload
            </span>
          </div>

          <Badge>Ready to upload</Badge>

          <button
            type="button"
            className="btn btn-primary"
            onClick={onContinue}
            disabled={busy}
          >
            {busy ? "Uploading..." : "Upload & preview"}

            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {preview && (
        <div className="panel upload-preview-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">EXCEL PREVIEW</span>

              <h3>Backend preview</h3>
            </div>

            <Badge>{preview.totalRows || 0} rows</Badge>
          </div>

          <div className="app-table preview-table">
            <div className="table-row head">
              {(preview.columns || []).map((column) => (
                <span key={column}>{column}</span>
              ))}
            </div>

            {(preview.rows || []).map((row, index) => (
              <div className="table-row" key={index}>
                {Object.values(row).map((cell, cellIndex) => (
                  <span key={cellIndex}>{String(cell ?? "")}</span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   VALIDATION VIEW
========================================================= */

function ValidationView({ busy, score, onContinue }) {
  const checks = [
    "Reading Excel",
    "Checking columns",
    "Checking dates",
    "Checking amounts",
    "Checking ledgers",
    "Checking GST details",
    "Checking duplicates",
    "Checking debit / credit",
    "Checking XML compatibility",
  ];

  return (
    <div className="validation-layout">
      <section className="panel validation-progress">
        <div className="progress-circle">
          <b>{score == null ? "—" : `${score}%`}</b>

          <small>validation score</small>
        </div>

        <h3>{busy ? "Running checks..." : "Ready to validate"}</h3>

        <p>
          The backend validates the complete uploaded dataset before XML
          generation.
        </p>

        <button
          type="button"
          className="btn btn-primary"
          onClick={onContinue}
          disabled={busy}
        >
          {busy ? "Validating..." : "Run validation"}

          <ShieldCheck size={16} />
        </button>
      </section>

      <section className="panel check-panel">
        <div className="panel-head">
          <h3>Validation checklist</h3>

          <Badge tone={busy ? "amber" : "success"}>
            {busy ? "Processing" : "Ready"}
          </Badge>
        </div>

        {checks.map((check, index) => (
          <div className="check-row" key={check}>
            <span>{index + 1}</span>

            {check}

            <small>{busy ? "Processing" : "Ready"}</small>
          </div>
        ))}
      </section>
    </div>
  );
}

/* =========================================================
   ERROR VIEW
========================================================= */

function ErrorView({
  validation,
  busy,
  recommendationStatus,
  onFixIssue,
  onApplySuggestion,
  onIgnoreSuggestion,
  onAutoFix,
  onRevalidate,
  onGenerate,
}) {
  const [filter, setFilter] = useState("All");

  const issues = validation?.issues || [];

  const pending = issues.filter((issue) => issue.status === "pending");

  const fixed = issues.filter((issue) => issue.status === "fixed");

  const ignored = issues.filter((issue) => issue.status === "ignored");

  const filtered = issues.filter(
    (issue) => filter === "All" || issue.status === filter.toLowerCase(),
  );

  const valid =
    validation?.status === "validated" &&
    validation?.errors === 0 &&
    validation?.score === 100;

  const recommendedIssue = issues.find(
    (issue) => issue.status === "pending" && issue.recommendation,
  );

  const firstPending = pending[0];

  return (
    <>
      <div className="summary-grid">
        <Stat
          value={issues.length}
          label="Total issues"
          note="Real validation run"
        />

        <Stat value={fixed.length} label="Fixed" note="Resolved" tone="green" />

        <Stat
          value={pending.length}
          label="Pending"
          note="Blocking/manual review"
          tone="red"
        />

        <Stat
          value={ignored.length}
          label="Ignored"
          note="Still reviewable"
          tone="amber"
        />
      </div>

      <div className="error-layout">
        <section className="panel error-panel">
          <div className="panel-head">
            <div>
              <h2>Validation issues</h2>

              <p>
                {pending.length
                  ? `${pending.length} issue${
                      pending.length > 1 ? "s" : ""
                    } still require attention.`
                  : valid
                    ? "All validation errors have been resolved."
                    : "Revalidate after fixing issues."}
              </p>
            </div>

            <div className="validation-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onRevalidate}
                disabled={busy}
              >
                <ShieldCheck size={16} />
                {busy ? "Revalidating..." : "Revalidate"}
              </button>

              {pending.length > 0 && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onAutoFix}
                  disabled={busy}
                >
                  <WandSparkles size={16} />
                  {busy ? "Processing..." : "Auto Fix Safe Errors"}
                </button>
              )}
            </div>
          </div>

          <div className="issue-filters">
            {[
              ["All", issues.length],
              ["Pending", pending.length],
              ["Fixed", fixed.length],
              ["Ignored", ignored.length],
            ].map(([label, count]) => (
              <button
                type="button"
                className={filter === label ? "active" : ""}
                key={label}
                onClick={() => setFilter(label)}
              >
                {label}

                <b>{count}</b>
              </button>
            ))}
          </div>

          {filtered.length > 0 ? (
            <div className="app-table errors-table">
              <div className="table-row head">
                {[
                  "ROW",
                  "COLUMN",
                  "CURRENT VALUE",
                  "PROBLEM",
                  "SEVERITY",
                  "RECOMMENDATION",
                  "ACTION",
                ].map((heading) => (
                  <span key={heading}>{heading}</span>
                ))}
              </div>

              {filtered.map((issue) => (
                <div
                  className={`table-row ${
                    issue.status === "fixed" ? "issue-fixed" : ""
                  }`}
                  key={issue.id}
                >
                  <span>#{issue.row}</span>

                  <b>{issue.column}</b>

                  <span className="mono">
                    {String(issue.currentValue ?? "")}
                  </span>

                  <span>
                    {issue.status === "fixed"
                      ? "Issue fixed"
                      : issue.issue || issue.message || "Validation issue"}
                  </span>

                  <Badge
                    tone={
                      issue.status === "fixed"
                        ? "success"
                        : String(issue.severity).toLowerCase() === "error"
                          ? "danger"
                          : "amber"
                    }
                  >
                    {issue.status === "fixed"
                      ? "Fixed"
                      : issue.status === "ignored"
                        ? "Ignored"
                        : issue.severity || "Warning"}
                  </Badge>

                  <small>
                    {issue.recommendation || "Manual review required"}
                  </small>

                  <button
                    type="button"
                    className="table-fix"
                    onClick={() => onFixIssue(issue.id)}
                    disabled={issue.status !== "pending"}
                  >
                    {issue.status === "fixed"
                      ? "Fixed"
                      : issue.status === "ignored"
                        ? "Ignored"
                        : "Fix"}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="success-empty">
              <CheckCircle2 size={42} />

              <h3>No issues in this view</h3>

              <p>Run validation to load real issues from the backend.</p>
            </div>
          )}

          {valid && (
            <div className="revalidation-bar">
              <span>
                <CheckCircle2 size={17} />
                Validation successful
              </span>

              <b>100% valid · 0 blocking errors</b>

              <button
                type="button"
                className="btn btn-primary"
                onClick={onGenerate}
              >
                Generate XML
                <FileCode2 size={15} />
              </button>
            </div>
          )}
        </section>

        {pending.length > 0 && (
          <aside className="panel rec-side">
            <div className="ai-icon">
              <Sparkles size={19} />
            </div>

            <span className="eyebrow">SMART RECOMMENDATION</span>

            <h3>Review the suggested fix</h3>

            <p>
              Apply recommendations returned by the backend only when they match
              your accounting configuration.
            </p>

            {recommendedIssue && (
              <div className="rec-mini">
                <small>Current</small>

                <b>{String(recommendedIssue.currentValue ?? "")}</b>

                <ArrowRight size={14} />

                <small>Suggested</small>

                <strong>
                  {recommendedIssue.suggestedValue ||
                    recommendedIssue.recommendation}
                </strong>
              </div>
            )}

            <div className="rec-actions">
              {recommendedIssue && (
                <button
                  type="button"
                  className="text-link"
                  onClick={() => onApplySuggestion(recommendedIssue.id)}
                  disabled={busy || recommendationStatus === "applied"}
                >
                  Apply suggestion
                  <ArrowRight size={14} />
                </button>
              )}

              {firstPending && (
                <button
                  type="button"
                  className="text-link muted"
                  onClick={() => onIgnoreSuggestion(firstPending.id)}
                  disabled={busy}
                >
                  Ignore
                </button>
              )}
            </div>
          </aside>
        )}
      </div>
    </>
  );
}

/* =========================================================
   SUCCESS VIEW
========================================================= */

function SuccessView({ onReset }) {
  const router = useRouter();

  const handleDownload = async () => {
    const xmlId = read("backendXmlId", null);

    if (!xmlId) {
      alert("No generated XML is available.");
      return;
    }

    try {
      await downloadXML(xmlId);
    } catch (error) {
      alert(error?.message || "Unable to download XML.");
    }
  };

  return (
    <div className="success-screen">
      <div className="success-big">
        <Check size={44} />
      </div>

      <span className="eyebrow">CONVERSION COMPLETE</span>

      <h2>
        XML generated
        <br />
        <em>successfully.</em>
      </h2>

      <p>Your validated XML is ready to import into Tally Prime.</p>

      <div className="success-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleDownload}
        >
          <Download size={16} />
          Download XML
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => router.push("/convert/xml-preview")}
        >
          <Eye size={16} />
          View XML
        </button>

        <button type="button" className="btn btn-secondary" onClick={onReset}>
          Start new conversion
          <ArrowRight size={15} />
        </button>
      </div>

      <div className="success-tip">
        <Database size={16} />

        <span>
          <b>Next step: Import this XML file into Tally Prime.</b>

          <small>
            Always verify imported accounting entries before finalizing
            accounts.
          </small>
        </span>
      </div>
    </div>
  );
}

/* =========================================================
   XML PREVIEW
========================================================= */

function XmlView() {
  const [copied, setCopied] = useState(false);

  const [file, setFile] = useState(null);

  const [error, setError] = useState("");

  useEffect(() => {
    const id = read("backendXmlId", null);

    if (!id) {
      setError("No generated XML is available.");
      return;
    }

    let mounted = true;

    getXML(id)
      .then((result) => {
        if (!mounted) {
          return;
        }

        if (!result?.file) {
          throw new Error("XML file was not returned by the backend.");
        }

        setFile(result.file);
      })
      .catch((fetchError) => {
        if (mounted) {
          setError(fetchError?.message || "Unable to load XML.");
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (error) {
    return <div className="empty-state panel">{error}</div>;
  }

  if (!file) {
    return <div className="empty-state panel">Loading XML...</div>;
  }

  const content = file.xmlContent || "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      setCopied(false);
    }
  };

  const handleDownload = async () => {
    try {
      await downloadXML(file._id);
    } catch (downloadError) {
      alert(downloadError?.message || "Unable to download XML.");
    }
  };

  const summary = [
    ["Total vouchers", String(file.totalVouchers || 0)],
    ["Transactions", String(file.totalTransactions || 0)],
    ["Total amount", String(file.totalAmount || 0)],
    ["Validation", "100%"],
    ["Compatibility", "Ready"],
  ];

  return (
    <>
      <div className="xml-ready">
        <CheckCircle2 size={20} />

        <div>
          <b>Data validated successfully</b>

          <span>{file.fileName} is ready to import into Tally Prime.</span>
        </div>

        <Badge>Validated</Badge>
      </div>

      <div className="xml-layout">
        <section className="panel code-panel">
          <div className="code-head">
            <b>{file.fileName}</b>

            <button type="button" onClick={handleCopy}>
              <Copy size={15} />

              {copied ? "XML copied" : "Copy XML"}
            </button>
          </div>

          <pre>{content}</pre>
        </section>

        <aside className="panel xml-summary">
          <span className="eyebrow">XML SUMMARY</span>

          <h3>{file.voucherType}</h3>

          {summary.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>

              <b>{value}</b>
            </div>
          ))}

          <button
            type="button"
            className="btn btn-primary full"
            onClick={handleDownload}
          >
            <Download size={16} />
            Download XML
          </button>
        </aside>
      </div>
    </>
  );
}

/* =========================================================
   EXPORT
========================================================= */

export { Conversion };
