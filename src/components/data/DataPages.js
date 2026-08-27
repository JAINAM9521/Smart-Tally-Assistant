"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Database,
  Download,
  Eye,
  FileSpreadsheet,
  Moon,
  Search,
  ShieldCheck,
  Sun,
} from "lucide-react";
import {
  downloadTemplate,
  getAnalyticsDashboard,
  getProfile,
  getUploadHistory,
  getValidationReports,
  getXMLFiles,
  updateProfile,
  downloadXML,
} from "../../lib/api";
import { read, save } from "../../lib/utils";
import { Badge, PageTitle, Stat } from "../dashboard/DashboardPage";
import Toast from "../ui/Toast";

const pages = {
  "/templates": [
    "TEMPLATES",
    "Standardize before you start",
    "Download clean, voucher-specific Excel formats for every accounting flow.",
  ],
  "/validation-reports": [
    "VALIDATION HEALTH",
    "Know what needs attention",
    "Track quality across every real validation run.",
  ],
  "/upload-history": [
    "FILE HISTORY",
    "Every upload, accounted for",
    "Search and review your team's real conversion activity.",
  ],
  "/xml-files": [
    "GENERATED OUTPUT",
    "Your Tally XML files",
    "Download and revisit compatible XML files.",
  ],
  "/analytics": [
    "OPERATIONS",
    "A clearer view of performance",
    "Understand throughput and quality from MongoDB.",
  ],
  "/help": [
    "HELP & GUIDE",
    "A smoother path to Tally",
    "Follow the complete workflow from a blank template to verified vouchers.",
  ],
  "/settings": [
    "PREFERENCES",
    "Make the workspace yours",
    "Control appearance and validation preferences.",
  ],
  "/profile": [
    "YOUR PROFILE",
    "Your profile",
    "Manage your account information.",
  ],
};

function GenericTable({ type }) {
  const router = useRouter();
  const xml = type === "/xml-files";
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState([]);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const load = async () => {
      try {
        const response = xml ? await getXMLFiles() : await getUploadHistory();
        setRecords(response.items || []);
      } catch (error) {
        setNotice(error.message);
      }
    };
    load();
  }, [xml]);
  const visible = records.filter((record) =>
    `${record.fileName || record.originalName || ""} ${record.voucherType || ""} ${record.status || ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <section className="panel full-panel">
      <Toast message={notice} onClose={() => setNotice("")} />
      <div className="toolbar">
        <div className="search">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files, vouchers, status..."
          />
        </div>
      </div>
      <div className="app-table">
        <div className="table-row head">
          <span>FILE NAME</span>
          <span>VOUCHER TYPE</span>
          <span>CREATED DATE</span>
          <span>{xml ? "VOUCHERS" : "ROWS"}</span>
          <span>STATUS</span>
          <span>ACTIONS</span>
        </div>
        {visible.length ? (
          visible.map((record) => (
            <div className="table-row" key={record._id}>
              <b>
                <FileSpreadsheet size={16} />
                {record.fileName || record.originalName}
              </b>
              <span>{record.voucherType || "—"}</span>
              <span>
                {record.createdAt
                  ? new Date(record.createdAt).toLocaleDateString()
                  : "—"}
              </span>
              <span>
                {record.totalVouchers || record.totalRows || record.rows || 0}
              </span>
              <Badge
                tone={
                  record.status === "validated" || record.status === "Ready"
                    ? "success"
                    : "amber"
                }
              >
                {record.status || "—"}
              </Badge>
              <span className="row-actions">
                {xml && (
                  <>
                    <button
                      aria-label="Preview XML"
                      onClick={() => {
                        save("selectedXmlFileId", record._id);
                        router.push("/convert/xml-preview");
                      }}
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      aria-label="Download XML"
                      onClick={async () => {
                        try {
                          await downloadXML(record._id);
                        } catch (e) {
                          setNotice(e.message);
                        }
                      }}
                    >
                      <Download size={16} />
                    </button>
                  </>
                )}
              </span>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <Search size={24} />
            <b>No records yet</b>
            <small>
              Real MongoDB-backed records will appear here after you use the
              conversion workflow.
            </small>
          </div>
        )}
      </div>
    </section>
  );
}

function ReportContent() {
  const router = useRouter();

  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getValidationReports()
      .then((r) => setReports(r.items || []))
      .catch((e) => setError(e.message));
  }, []);

  const openReport = () => {
    const validationId = read(
      "backendValidationId",
      null,
    );

    if (!validationId) {
      setError(
        "No active validation run is available. Run validation again to open the detailed issues.",
      );
      return;
    }

    const storedValidation = read(
      `backendValidationResult:${validationId}`,
      null,
    );

    if (!storedValidation) {
      setError(
        "The detailed validation result is not available in this browser session. Run validation again to reopen its issues.",
      );
      return;
    }

    router.push(
      `/convert/errors?validationId=${encodeURIComponent(
        validationId,
      )}`,
    );
  };

  return reports.length ? (
    <div className="panel full-panel">
      <div className="panel-head">
        <div>
          <span className="eyebrow">VALIDATION REPORTS</span>
          <h2>Real validation history</h2>
        </div>
      </div>

      {error && (
        <div className="toast" role="status">
          {error}
        </div>
      )}

      <div className="app-table">
        <div className="table-row head">
          <span>FILE</span>
          <span>SCORE</span>
          <span>ERRORS</span>
          <span>WARNINGS</span>
          <span>STATUS</span>
          <span>ACTIONS</span>
        </div>

        {reports.map((r) => (
          <div className="table-row" key={r._id}>
            <b>{r.fileName || "Upload"}</b>
            <span>{r.score ?? 0}%</span>
            <span>{r.errors ?? 0}</span>
            <span>{r.warnings ?? 0}</span>
            <Badge tone={r.errors ? "danger" : "success"}>
              {r.status}
            </Badge>
            <span className="row-actions">
              <button
                type="button"
                className="table-fix"
                onClick={openReport}
              >
                Open
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  ) : (
    <div className="empty-state panel">
      <ShieldCheck size={24} />
      <b>{error || "No validation reports yet"}</b>
      <small>Complete a real conversion to generate reports.</small>
    </div>
  );
}

function AnalyticsContent() {
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    getAnalyticsDashboard()
      .then((r) => setAnalytics(r.analytics))
      .catch((e) => setError(e.message));
  }, []);
  if (!analytics)
    return (
      <div className="empty-state panel">{error || "Loading analytics..."}</div>
    );
  return (
    <div className="stat-grid">
      <Stat
        value={analytics.totalUploads ?? "—"}
        label="Files processed"
        note="MongoDB"
      />
      <Stat
        value={analytics.successfulConversions ?? "—"}
        label="Successful conversions"
        note="MongoDB"
        tone="green"
      />
      <Stat
        value={analytics.totalVouchers ?? "—"}
        label="Total vouchers"
        note="MongoDB"
        tone="purple"
      />
      <Stat
        value={
          analytics.validationSuccessRate != null
            ? `${analytics.validationSuccessRate}%`
            : "—"
        }
        label="Validation success rate"
        note="Calculated"
        tone="green"
      />
    </div>
  );
}

function Help() {
  return (
    <>
      <PageTitle
        eyebrow="HELP & GUIDE"
        title="A smoother path to Tally"
        description="Follow the complete real workflow."
      />
      <div className="guide-layout">
        <div className="guide-list">
          {[
            "Login",
            "Select voucher",
            "Download template",
            "Fill Excel",
            "Upload Excel",
            "Validate",
            "Fix errors",
            "Revalidate",
            "Generate XML",
            "Preview & download",
            "Import into Tally",
          ].map((x, i) => (
            <div key={x}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <b>{x}</b>
              <CheckCircle2 size={16} />
            </div>
          ))}
        </div>
        <div className="panel tally-guide">
          <div className="tally-guide-icon">
            <Database />
          </div>
          <span className="eyebrow">TALLY PRIME IMPORT</span>
          <h2>
            Verified data,
            <br />
            <em>right where it belongs.</em>
          </h2>
          <div className="tally-flow">
            {["Smart Tally", "XML file", "Tally Prime", "Verify vouchers"].map(
              (x, i) => (
                <div key={x}>
                  <span>{i + 1}</span>
                  {x}
                  {i < 3 && <ArrowRight size={15} />}
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function SettingsPage() {
  const [dark, setDark] = useState(() => read("theme", "light") === "dark");
  const [settings, setSettings] = useState(() =>
    read("settings", {
      strictValidation: true,
      duplicateDetection: true,
      gstValidation: true,
      ledgerMatching: true,
    }),
  );
  const toggle = (key) =>
    setSettings((previous) => {
      const next = { ...previous, [key]: !previous[key] };
      save("settings", next);
      return next;
    });
  const fields = [
    ["Strict Validation", "strictValidation"],
    ["Duplicate Detection", "duplicateDetection"],
    ["GST Validation", "gstValidation"],
    ["Ledger Matching", "ledgerMatching"],
  ];
  return (
    <>
      <PageTitle
        eyebrow="PREFERENCES"
        title="Make the workspace yours"
        description="Appearance and UI preferences are stored locally; accounting data is not."
      />
      <div className="settings-grid">
        <section className="panel settings-card">
          <span className="eyebrow">APPEARANCE</span>
          <h3>Choose your mode</h3>
          <div className="theme-choice">
            <button
              className={!dark ? "chosen" : ""}
              onClick={() => {
                setDark(false);
                document.documentElement.dataset.theme = "light";
                save("theme", "light");
              }}
            >
              <Sun size={17} />
              Light
            </button>
            <button
              className={dark ? "chosen" : ""}
              onClick={() => {
                setDark(true);
                document.documentElement.dataset.theme = "dark";
                save("theme", "dark");
              }}
            >
              <Moon size={17} />
              Dark
            </button>
          </div>
        </section>
        <section className="panel settings-card">
          <span className="eyebrow">VALIDATION PREFERENCES</span>
          <h3>Keep checks thorough</h3>
          {fields.map(([label, key]) => (
            <label className="toggle-row" key={key}>
              {label}
              <input
                type="checkbox"
                checked={Boolean(settings[key])}
                onChange={() => toggle(key)}
              />
              <span />
            </label>
          ))}
        </section>
      </div>
    </>
  );
}

function Profile() {
  const [user, setUser] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", organization: "" });
  const [notice, setNotice] = useState("");
  useEffect(() => {
    getProfile()
      .then((r) => {
        setUser(r.user);
        setForm({
          name: r.user.name || "",
          organization: r.user.organization || "",
        });
      })
      .catch((e) => setNotice(e.message));
  }, []);
  const saveProfile = async () => {
    try {
      const r = await updateProfile(form);
      setUser(r.user);
      setEditing(false);
      setNotice("Profile updated successfully.");
    } catch (e) {
      setNotice(e.message);
    }
  };
  if (!user)
    return (
      <div className="empty-state panel">{notice || "Loading profile..."}</div>
    );
  return (
    <>
      <PageTitle
        eyebrow="YOUR PROFILE"
        title={user.name}
        description={`${user.role} at ${user.organization || "your organization"}`}
      />
      <div className="profile-card panel">
        <div className="profile-avatar">
          {user.name?.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          <Badge>{user.role}</Badge>
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => setEditing(!editing)}
        >
          {editing ? "Close editor" : "Edit profile"} <ArrowRight size={15} />
        </button>
      </div>
      {editing && (
        <div className="panel profile-editor">
          <label>
            Name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            Organization
            <input
              value={form.organization}
              onChange={(e) =>
                setForm({ ...form, organization: e.target.value })
              }
            />
          </label>
          <button className="btn btn-primary" onClick={saveProfile}>
            Save profile <CheckCircle2 size={15} />
          </button>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </>
  );
}

function DataPage({ type }) {
  const [ey, title, desc] = pages[type] || pages["/templates"];
  if (type === "/help") return <Help />;
  if (type === "/settings") return <SettingsPage />;
  if (type === "/profile") return <Profile />;
  if (type === "/validation-reports")
    return (
      <>
        <PageTitle eyebrow={ey} title={title} description={desc} />
        <ReportContent />
      </>
    );
  if (type === "/analytics")
    return (
      <>
        <PageTitle eyebrow={ey} title={title} description={desc} />
        <AnalyticsContent />
      </>
    );
  return (
    <>
      <PageTitle
        eyebrow={ey}
        title={title}
        description={desc}
        action={
          type === "/templates" ? (
            <div className="voucher-template-actions">
              {[
                "Sales",
                "Purchase",
                "Payment",
                "Receipt",
                "Contra",
                "Journal",
                "Credit Note",
                "Debit Note",
              ].map((v) => (
                <button
                  key={v}
                  className="btn btn-secondary"
                  onClick={() => downloadTemplate(v)}
                >
                  <Download size={15} />
                  {v}
                </button>
              ))}
            </div>
          ) : null
        }
      />
      <GenericTable type={type} />
    </>
  );
}
export { DataPage };
