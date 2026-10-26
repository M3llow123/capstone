"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuditLog, onAuditChanged, logAudit, type AuditEntry } from "../lib/auditStore";
import AuditLogNav from "./AuditLogNav";

const impactChildren = [
  "Corn Crop Stage and Water Sufficiency",
  "Rice Crop Stage and Water Sufficiency",
  "Monthly Rainfall",
  "Tropical Cyclone",
  "Crop Condition and Drought Indicator",
  "Regions",
  "Cover Page",
  "About this Report",
  "Preface",
  "Overview",
];

const impactRoutes: Record<string, string> = {
  "Corn Crop Stage and Water Sufficiency": "/corn-crop-stage/edit",
  "Rice Crop Stage and Water Sufficiency": "/rice-crop-stage/edit",
  "Monthly Rainfall": "/monthly-rainfall/edit",
  "Tropical Cyclone": "/tropical-cyclone/edit",
  "Crop Condition and Drought Indicator": "/crop-condition-drought/edit",
  "Regions": "/uploader",
  "Cover Page": "/cover-page/edit",
  "About this Report": "/about-this-report/edit",
  "Preface": "/preface/edit",
  "Overview": "/overview/edit",
};

// "2026-09-29T13:05:09.000Z" -> "2026-09-29 21:05:09" (local time)
function formatAuditDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export default function AuditLogPage({ username = "User" }: { username?: string }) {
  const router = useRouter();
  const displayName = username.charAt(0).toUpperCase() + username.slice(1);
  const [impactOpen, setImpactOpen] = useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showEntries, setShowEntries] = useState(10);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [auditPage, setAuditPage] = useState(1);

  useEffect(() => {
    const load = () => setAuditLog(getAuditLog());
    load();
    return onAuditChanged(load);
  }, []);

  // Back to page 1 whenever the search or page size changes
  useEffect(() => { setAuditPage(1); }, [search, showEntries]);

  async function handleLogout() {
    await logAudit("LOGOUT", undefined, username);
    await fetch("/api/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const q = search.toLowerCase();
  const filteredAudit = auditLog.filter(
    a =>
      a.name.toLowerCase().includes(q) ||
      a.action.toLowerCase().includes(q) ||
      (a.detail ?? "").toLowerCase().includes(q)
  );

  const totalPages = Math.max(1, Math.ceil(filteredAudit.length / showEntries));
  const safePage = Math.min(auditPage, totalPages);
  const startIdx = (safePage - 1) * showEntries;
  const pageRows = filteredAudit.slice(startIdx, startIdx + showEntries);

  // Page numbers to show: first, last, and a window around the current page
  const pageNumbers: (number | "...")[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - safePage) <= 1) pageNumbers.push(p);
    else if (pageNumbers[pageNumbers.length - 1] !== "...") pageNumbers.push("...");
  }

  return (
    <div style={{
      display: "flex", height: "100vh", background: "#f4f6f8",
      fontFamily: "'Source Sans Pro', 'Segoe UI', sans-serif", color: "#333", overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@300;400;600;700&display=swap');
        * { box-sizing: border-box; }
        .side-link { display:block; padding:8px 16px 8px 28px; font-size:13px; color:#555; cursor:pointer; text-decoration:none; transition:background .12s,color .12s; border-left:3px solid transparent; }
        .side-link:hover { background:#e8edf2; color:#003087; }
        .side-link.active { background:#dce8f5; color:#003087; border-left:3px solid #003087; font-weight:600; }
        .side-parent { display:flex; align-items:center; justify-content:space-between; padding:9px 14px; font-size:13px; font-weight:600; color:#444; cursor:pointer; transition:background .12s; user-select:none; }
        .side-parent:hover { background:#e8edf2; }
        .page-btn { min-width:32px; height:32px; border-radius:3px; border:1px solid #dee2e6; background:#fff; color:#555; font-size:13px; cursor:pointer; padding:0 10px; transition:all .12s; }
        .page-btn:hover:not(:disabled) { background:#e9ecef; }
        .page-btn:disabled { opacity:.5; cursor:default; }
        .page-btn.active { background:#003087; color:#fff; border-color:#003087; }
        .audit-row { display:grid; grid-template-columns:1fr 1.8fr 1fr; padding:8px 14px; border-bottom:1px solid #f0f0f0; font-size:13px; }
        .audit-row:hover { background:#f9fbfd; }
        .audit-header { display:grid; grid-template-columns:1fr 1.8fr 1fr; padding:9px 14px; background:#f8f9fa; border-bottom:1px solid #dee2e6; font-size:12px; font-weight:700; color:#555; text-transform:uppercase; letter-spacing:.04em; }
        input[type=text], select { font-family:inherit; }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-thumb { background:#ccc; border-radius:3px; }
      `}</style>

      {/* ── Sidebar ── */}
      <div style={{ width: 200, background: "#fff", borderRight: "1px solid #dde3ea", display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto" }}>
        <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #eee" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#003087", letterSpacing: ".02em" }}>PAGASA</div>
          <div style={{ fontSize: 10, color: "#888", marginTop: 1 }}>Website Content Management System</div>
          <span style={{ display: "inline-block", marginTop: 4, fontSize: 10, padding: "1px 7px", borderRadius: 3, background: "#d32f2f", color: "#fff", fontWeight: 600 }}>Production</span>
        </div>

        <nav style={{ flex: 1, paddingTop: 6 }}>
          <div className="side-parent" onClick={() => setMaintenanceOpen(p => !p)}>
            <span>Maintenance</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5" style={{ transform: maintenanceOpen ? "rotate(90deg)" : "none", transition: "transform .2s" }}>
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div className="side-parent" onClick={() => setImpactOpen(p => !p)} style={{ marginTop: 2 }}>
            <span>Impact Assessment</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5" style={{ transform: impactOpen ? "rotate(90deg)" : "none", transition: "transform .2s" }}>
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          {impactOpen && impactChildren.map(label => (
            <div key={label} className="side-link" onClick={() => router.push(impactRoutes[label])}>{label}</div>
          ))}

          <AuditLogNav />

          <div style={{ marginTop: 8, borderTop: "1px solid #eee", paddingTop: 8 }}>
            <div style={{ padding: "4px 14px 6px", fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: ".06em" }}>AI Tools</div>
            <div className="side-link" style={{ paddingLeft: 16, display: "flex", alignItems: "center", gap: 8 }} onClick={() => router.push("/chat")}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4caf50", flexShrink: 0 }} />
              PAGASA AI
            </div>
          </div>
        </nav>

        <div style={{ padding: "10px 14px", borderTop: "1px solid #eee", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#003087", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{displayName.charAt(0)}</div>
          <div>
            <div style={{ fontWeight: 600, color: "#333" }}>Hi, {displayName}</div>
            <div style={{ fontSize: 10, color: "#888" }}>Admin</div>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ background: "#fff", borderBottom: "1px solid #dde3ea", padding: "10px 24px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 13, color: "#003087", fontWeight: 700 }}>PAGASA</span>
          <span style={{ fontSize: 13, color: "#888" }}>Website Content Management System</span>
          <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 3, background: "#d32f2f", color: "#fff", fontWeight: 600 }}>Production</span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, color: "#555" }}>Hi {displayName}</span>
            <button
              onClick={handleLogout}
              style={{
                padding: "4px 12px", fontSize: 12, background: "#fff", border: "1px solid #ced4da",
                borderRadius: 3, color: "#555", cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Logout
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "28px 28px 32px" }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#222", margin: "0 0 4px" }}>Audit Log</h1>
          <div style={{ fontSize: 14, color: "#888", marginBottom: 24 }}>Everything that was done in the system</div>

          <div style={{ background: "#fff", border: "1px solid #dde3ea", borderRadius: 6, overflow: "hidden" }}>
            {/* Controls */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid #f0f0f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#555" }}>
                Show&nbsp;
                <select value={showEntries} onChange={e => setShowEntries(+e.target.value)}
                  style={{ border: "1px solid #dee2e6", borderRadius: 3, padding: "2px 6px", fontSize: 13, color: "#333", background: "#fff" }}>
                  {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                &nbsp;entries
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#555" }}>
                Search:&nbsp;
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  style={{ border: "1px solid #dee2e6", borderRadius: 3, padding: "3px 8px", fontSize: 13, width: 200, outline: "none" }} />
              </div>
            </div>

            {/* Table header */}
            <div className="audit-header">
              <div>Name ↕</div>
              <div>Action ↕</div>
              <div>Date Created ↕</div>
            </div>

            {/* Table rows */}
            {pageRows.length === 0 ? (
              <div style={{ padding: "24px 14px", fontSize: 13, color: "#999", textAlign: "center" }}>
                {auditLog.length === 0 ? "No activity recorded yet." : "No matching entries."}
              </div>
            ) : (
              pageRows.map(a => (
                <div key={a.id} className="audit-row">
                  <div style={{ color: "#333" }}>{a.name.charAt(0).toUpperCase() + a.name.slice(1)}</div>
                  <div style={{ color: "#555" }}>
                    {a.action}
                    {a.detail && <span style={{ color: "#999" }}> — {a.detail}</span>}
                  </div>
                  <div style={{ color: "#888" }}>{formatAuditDate(a.date)}</div>
                </div>
              ))
            )}

            {/* Footer */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderTop: "1px solid #eee", fontSize: 13, color: "#888" }}>
              <span>
                {filteredAudit.length === 0
                  ? "Showing 0 entries"
                  : `Showing ${startIdx + 1} to ${startIdx + pageRows.length} of ${filteredAudit.length.toLocaleString()} entries`}
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                <button className="page-btn" style={{ fontSize: 12 }} disabled={safePage === 1}
                  onClick={() => setAuditPage(safePage - 1)}>Previous</button>
                {pageNumbers.map((p, i) =>
                  p === "..." ? (
                    <span key={`e${i}`} style={{ alignSelf: "center", padding: "0 4px" }}>…</span>
                  ) : (
                    <button key={p} className={`page-btn${p === safePage ? " active" : ""}`}
                      style={{ fontSize: 12 }} onClick={() => setAuditPage(p)}>{p}</button>
                  )
                )}
                <button className="page-btn" style={{ fontSize: 12 }} disabled={safePage === totalPages}
                  onClick={() => setAuditPage(safePage + 1)}>Next</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}