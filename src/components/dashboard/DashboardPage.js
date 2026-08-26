"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, BarChart3, Download, FileCode2, FileSpreadsheet, MoreHorizontal, Plus, ShieldCheck, Upload } from "lucide-react";
import { getUploadHistory } from "../../lib/api";
import { useEffect, useState } from "react";

function Badge({ children, tone = "success" }) { return <span className={`badge ${tone}`}>{children}</span> }
function Stat({ value, label, note, tone = "teal" }) { return <div className="stat-card"><div className={`stat-icon ${tone}`}><BarChart3 size={17} /></div><strong>{value}</strong><span>{label}</span><small>{note}</small></div> }
function PageTitle({ eyebrow, title, description, action }) { return <div className="page-title"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div> }
function Dashboard() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState(null);
  const [recent, setRecent] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getUploadHistory("limit=5"), import("../../lib/api").then(m => m.getAnalyticsDashboard())])
      .then(([history, stats]) => {
        setRecent(history.items || []);
        setAnalytics(stats.analytics || {});
      })
      .catch(err => setError(err.message));
  }, []);

  const stat = analytics || {};
  return <><PageTitle eyebrow="WORKSPACE" title="Smart Tally dashboard" description="Manage your real Excel-to-Tally conversion workflow from one place." action={<button className="btn btn-primary" onClick={() => router.push("/convert/select-voucher")}><Plus size={16} />Start new conversion</button>} />
    {error && <div className="toast" role="alert">{error}</div>}
    <div className="stat-grid">
      <Stat value={stat.totalUploads ?? "—"} label="Files processed" note="From MongoDB" />
      <Stat value={stat.successfulConversions ?? "—"} label="Successful conversions" note="From MongoDB" tone="green" />
      <Stat value={stat.failedConversions ?? "—"} label="Failed conversions" note="Requires review" tone="amber" />
      <Stat value={stat.totalXML ?? "—"} label="XML files generated" note="From MongoDB" tone="blue" />
      <Stat value={stat.totalVouchers ?? "—"} label="Total vouchers" note="All uploaded data" tone="purple" />
      <Stat value={stat.validationSuccessRate != null ? `${stat.validationSuccessRate}%` : "—"} label="Validation success rate" note="Calculated from reports" tone="green" />
      <Stat value={stat.averageProcessingTime ?? "—"} label="Average processing time" note="Calculated from conversions" tone="blue" />
    </div>
    <div className="dashboard-grid">
      <section className="panel quick-panel"><div className="panel-head"><div><span className="eyebrow">SHORTCUTS</span><h2>Quick actions</h2></div></div>
        <div className="quick-grid">{[["Start conversion","Upload a new Excel file",Upload,"/convert/select-voucher"],["Download template","Use a clean voucher format",Download,"/templates"],["View reports","Review validation health",ShieldCheck,"/validation-reports"],["XML files","Browse generated files",FileCode2,"/xml-files"]].map(([a,b,I,href])=><Link href={href} className="quick-action" key={a}><span><I size={18}/></span><b>{a}</b><small>{b}</small><ArrowUpRight size={15}/></Link>)}</div>
      </section>
      <section className="panel activity-panel"><div className="panel-head"><div><span className="eyebrow">LATEST</span><h2>Recent activity</h2></div><Link href="/upload-history">View all <ArrowRight size={14}/></Link></div>
        <div className="activity-list">{recent.length ? recent.map(file=><div className="activity-row" key={file._id}><span className="file-icon"><FileSpreadsheet size={17}/></span><div><b>{file.originalName || file.fileName}</b><small>{file.voucherType} · {file.totalRows || file.rows || 0} rows</small></div><Badge tone={file.status === "validated" ? "success" : "amber"}>{file.status}</Badge><MoreHorizontal size={18}/></div>) : <div className="empty-state"><FileSpreadsheet size={24}/><b>No uploads yet</b><small>Upload an Excel file to see real activity here.</small></div>}</div>
      </section>
    </div>
  </>;
}
export { Badge, Stat, PageTitle, Dashboard };
