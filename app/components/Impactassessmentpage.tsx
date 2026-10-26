"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { logAudit } from "../lib/auditStore";
import AuditLogNav from "./AuditLogNav";
import { deleteRegionReport, getAllRegionReports, onRegionReportsChanged } from "../lib/reportStore";

// ── Types ──────────────────────────────────────────────────────────────
type Group = "Luzon" | "Visayas" | "Mindanao";

interface Region {
  id: number;
  name: string;
  date: string;
  group: Group;
}

// ── Data ───────────────────────────────────────────────────────────────
// ids stay the same because they are used in /regions/[id]/edit
const regions: Region[] = [
  // Luzon
  { id: 1,  group: "Luzon",    name: "Region 1 Ilocos Region",                                   date: "2018-05-03 10:57:45" },
  { id: 2,  group: "Luzon",    name: "Region 2 Cagayan Valley",                                  date: "2018-05-03 10:57:40" },
  { id: 3,  group: "Luzon",    name: "CAR (Cordillera Administrative Region)",                   date: "2018-05-03 10:57:36" },
  { id: 4,  group: "Luzon",    name: "Region 3 Central Luzon",                                   date: "2018-05-03 10:57:33" },
  { id: 5,  group: "Luzon",    name: "Region 4A CALABARZON",                                     date: "2018-05-03 10:57:20" },
  { id: 6,  group: "Luzon",    name: "Region 4B MIMAROPA",                                       date: "2018-05-03 10:57:10" },
  { id: 7,  group: "Luzon",    name: "Region 5 Bicol Region",                                    date: "2018-05-03 10:54:51" },
  // Visayas
  { id: 8,  group: "Visayas",  name: "Region 6 Western Visayas",                                 date: "2018-05-03 10:55:46" },
  { id: 9,  group: "Visayas",  name: "Region 7 Central Visayas",                                 date: "2018-05-03 10:55:32" },
  { id: 10, group: "Visayas",  name: "Region 8 Eastern Visayas",                                 date: "2018-05-03 10:56:02" },
  // Mindanao
  { id: 11, group: "Mindanao", name: "Region 9 Zamboanga Peninsula",                             date: "2018-05-03 10:56:12" },
  { id: 12, group: "Mindanao", name: "Region 10 Northern Mindanao",                              date: "2018-05-03 10:56:25" },
  { id: 13, group: "Mindanao", name: "Region 11 Davao Region",                                   date: "2018-05-03 10:56:36" },
  { id: 14, group: "Mindanao", name: "Region 12 SOCCSKSARGEN",                                   date: "2018-05-03 10:56:44" },
  { id: 15, group: "Mindanao", name: "Region 13 CARAGA",                                         date: "2018-05-03 10:56:58" },
  { id: 16, group: "Mindanao", name: "BARMM (Bangsamoro Autonomous Region in Muslim Mindanao)", date: "2018-05-03 10:57:33" },
];

const GROUPS: Group[] = ["Luzon", "Visayas", "Mindanao"];

// ── Component ──────────────────────────────────────────────────────────
export default function ImpactAssessmentPage({ username = "User" }: { username?: string }) {
  const router = useRouter();
  const displayName = username.charAt(0).toUpperCase() + username.slice(1);
  const [regionSearch, setRegionSearch] = useState("");
  const [activeNav, setActiveNav] = useState("Regions");
  const [impactOpen, setImpactOpen] = useState(true);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);

  async function handleDelete(id: number, name: string) {
    if (!window.confirm(`Delete the saved report for "${name}"?\n\nThis removes its summary, uploaded image and graph data. This can't be undone.`)) return;
    try {
      await deleteRegionReport(String(id), name);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Delete failed. Please try again.");
    }
  }

  // Regions that already have a saved report (only those have a summary to edit)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const refresh = () => setSavedIds(new Set(getAllRegionReports().map(r => r.id)));
    refresh();
    return onRegionReportsChanged(refresh);
  }, []);

  async function handleLogout() {
    await logAudit("LOGOUT", undefined, username);
    await fetch("/api/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const q = regionSearch.trim().toLowerCase();
  const visibleRegions = regions.filter(r => r.name.toLowerCase().includes(q) || r.group.toLowerCase().includes(q));

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
        .side-parent { display:flex; align-items:center; justify-content:space-between; padding:9px 14px; font-size:13px; font-weight:600; color:#444; cursor:pointer; transition:background .12s; }
        .side-parent:hover { background:#e8edf2; }
        .btn-edit { width:34px; height:34px; border-radius:4px; background:#2196f3; border:none; cursor:pointer; color:#fff; display:flex; align-items:center; justify-content:center; transition:background .15s; flex-shrink:0; }
        .btn-edit:hover { background:#1565c0; }
        .btn-summary { width:34px; height:34px; border-radius:4px; background:#00897b; border:none; cursor:pointer; color:#fff; display:flex; align-items:center; justify-content:center; transition:background .15s; flex-shrink:0; }
        .btn-summary:hover { background:#00695c; }
        .btn-summary:disabled { background:#cfd8dc; cursor:not-allowed; }
        .btn-delete { width:34px; height:34px; border-radius:4px; background:#e53935; border:none; cursor:pointer; color:#fff; display:flex; align-items:center; justify-content:center; transition:background .15s; flex-shrink:0; }
        .btn-delete:hover { background:#b71c1c; }
        .btn-delete:disabled { background:#cfd8dc; cursor:not-allowed; }
        .btn-add { width:34px; height:34px; border-radius:4px; background:#4caf50; border:none; cursor:pointer; color:#fff; display:flex; align-items:center; justifyContent:center; transition:background .15s; display:flex; align-items:center; justify-content:center; }
        .btn-add:hover { background:#2e7d32; }
        .region-grid { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:12px; padding:14px; }
        .region-card { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px 14px; border:1px solid #e3e8ee; border-radius:6px; background:#fff; transition:background .1s, border-color .1s, box-shadow .1s; }
        .region-card:hover { background:#f9fbfd; border-color:#c9d6e6; box-shadow:0 1px 4px rgba(0,48,135,.08); }
        @media (max-width: 1350px) { .region-grid { grid-template-columns:repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 800px)  { .region-grid { grid-template-columns:minmax(0, 1fr); } }
        .group-header { display:flex; align-items:center; justify-content:space-between; padding:8px 14px; background:#f8f9fa; border-bottom:1px solid #eee; font-size:11px; font-weight:700; color:#003087; text-transform:uppercase; letter-spacing:.06em; }
        .group-count { background:#dce8f5; color:#003087; border-radius:10px; padding:1px 8px; font-size:11px; }
        .region-row { display:flex; align-items:center; justify-content:space-between; padding:12px 14px; border-bottom:1px solid #eee; transition:background .1s; }
        .region-row:last-child { border-bottom:none; }
        .region-row:hover { background:#f9fbfd; }
        input[type=text], select { font-family:inherit; }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-thumb { background:#ccc; border-radius:3px; }
      `}</style>

      {/* ── Sidebar ── */}
      <div style={{ width: 200, background: "#fff", borderRight: "1px solid #dde3ea", display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto" }}>
        {/* Logo */}
        <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #eee" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#003087", letterSpacing: ".02em" }}>PAGASA</div>
          <div style={{ fontSize: 10, color: "#888", marginTop: 1 }}>Website Content Management System</div>
          <span style={{ display: "inline-block", marginTop: 4, fontSize: 10, padding: "1px 7px", borderRadius: 3, background: "#d32f2f", color: "#fff", fontWeight: 600 }}>Production</span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, paddingTop: 6 }}>
          {/* Maintenance */}
          <div
            className="side-parent"
            onClick={() => setMaintenanceOpen(p => !p)}
          >
            <span>Maintenance</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5" style={{ transform: maintenanceOpen ? "rotate(90deg)" : "none", transition: "transform .2s" }}>
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* Impact Assessment */}
          <div
            className="side-parent"
            onClick={() => setImpactOpen(p => !p)}
            style={{ marginTop: 2 }}
          >
            <span>Impact Assessment</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5" style={{ transform: impactOpen ? "rotate(90deg)" : "none", transition: "transform .2s" }}>
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          {impactOpen && ["Corn Crop Stage and Water Sufficiency", "Rice Crop Stage and Water Sufficiency", "Monthly Rainfall", "Tropical Cyclone", "Crop Condition and Drought Indicator", "Regions", "Cover Page", "About this Report", "Preface", "Overview"].map(label => (
            <div
              key={label}
              className={`side-link${activeNav === label ? " active" : ""}`}
              onClick={() => {
                setActiveNav(label);
                if (label === "Corn Crop Stage and Water Sufficiency") router.push("/corn-crop-stage/edit");
                if (label === "Rice Crop Stage and Water Sufficiency") router.push("/rice-crop-stage/edit");
                if (label === "Monthly Rainfall") router.push("/monthly-rainfall/edit");
                if (label === "Tropical Cyclone") router.push("/tropical-cyclone/edit");
                if (label === "Crop Condition and Drought Indicator") router.push("/crop-condition-drought/edit");
                if (label === "Cover Page") router.push("/cover-page/edit");
                if (label === "About this Report") router.push("/about-this-report/edit");
                if (label === "Preface") router.push("/preface/edit");
                if (label === "Overview") router.push("/overview/edit");
              }}
            >{label}</div>
          ))}

          {/* PAGASA AI link */}
          <AuditLogNav />
          <div style={{ marginTop: 8, borderTop: "1px solid #eee", paddingTop: 8 }}>
            <div style={{ padding: "4px 14px 6px", fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: ".06em" }}>AI Tools</div>
            <div
              className="side-link"
              style={{ paddingLeft: 16, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
              onClick={() => router.push("/chat")}
            >
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4caf50", flexShrink: 0 }} />
              PAGASA AI
            </div>
          </div>
        </nav>

        {/* User */}
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

        {/* Top bar */}
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

        {/* Page body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "28px 28px 32px" }}>

          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#222", margin: "0 0 4px" }}>Impact Assessment</h1>
          <div style={{ fontSize: 14, color: "#888", marginBottom: 24 }}>Regions</div>

          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

            {/* ── Regions List (all regions, grouped by island group) ── */}
            <div style={{ flex: "1 1 auto", minWidth: 0, background: "#fff", border: "1px solid #dde3ea", borderRadius: 6, overflow: "hidden" }}>
              {/* Card header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 14px", borderBottom: "1px solid #eee" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "#333" }}>List</span>
                  <span style={{ fontSize: 12, color: "#999" }}>{regions.length} regions</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="text"
                    placeholder="Search region..."
                    value={regionSearch}
                    onChange={e => setRegionSearch(e.target.value)}
                    style={{ border: "1px solid #dee2e6", borderRadius: 3, padding: "5px 10px", fontSize: 13, width: 200, outline: "none" }}
                  />
                  <button className="btn-add" title="Add region">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
                  </button>
                </div>
              </div>

              {/* Groups */}
              {GROUPS.map(g => {
                const rows = visibleRegions.filter(r => r.group === g);
                if (rows.length === 0) return null;
                return (
                  <div key={g}>
                    <div className="group-header">
                      <span>{g}</span>
                      <span className="group-count">{rows.length}</span>
                    </div>
                    <div className="region-grid">
                      {rows.map(r => (
                        <div key={r.id} className="region-card">
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: "#222", lineHeight: 1.25 }}>{r.name}</div>
                            <div style={{ fontSize: 11, color: "#aaa", marginTop: 3 }}>{r.date}</div>
                          </div>
                          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            <button
                              className="btn-summary"
                              disabled={!savedIds.has(String(r.id))}
                              title={savedIds.has(String(r.id)) ? "Edit summary" : "No summary yet: upload an image and generate one first"}
                              onClick={() => router.push(`/regions/${r.id}/summary`)}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 10h16M4 14h10" /><path d="M16 20l1-3 5-5 2 2-5 5-3 1z" strokeLinejoin="round" /></svg>
                            </button>
                            <button className="btn-edit" title="Upload image / regenerate summary" onClick={() => router.push(`/regions/${r.id}/edit`)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" strokeLinecap="round" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" /></svg>
                          </button>
                            <button
                              className="btn-delete"
                              disabled={!savedIds.has(String(r.id))}
                              title={savedIds.has(String(r.id)) ? "Delete saved report" : "Nothing to delete: no report saved yet"}
                              onClick={() => handleDelete(r.id, r.name)}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M6 6l1 14a2 2 0 002 2h6a2 2 0 002-2l1-14M10 11v6M14 11v6" /></svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {visibleRegions.length === 0 && (
                <div style={{ padding: "24px 14px", fontSize: 13, color: "#999", textAlign: "center" }}>No matching regions.</div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}