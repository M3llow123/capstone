"use client";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import RegionReportDocument from "../../../components/RegionReportDocument";
import AuditLogNav from "../../../components/AuditLogNav";
import { getRegionReport, onRegionReportsChanged, type RegionReport } from "../../../lib/reportStore";

export default function RegionsPrintPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);

  const id = params?.id as string;
  const summary = searchParams?.get("summary") ?? "";
  const regionName = searchParams?.get("region") ?? `Region ${id}`;
  const month = searchParams?.get("month") ?? new Date().toLocaleString("default", { month: "long", year: "numeric" });

  // The saved report holds the uploaded image + chart data (the URL only carries the summary text).
  const [saved, setSaved] = useState<RegionReport | null>(null);
  useEffect(() => {
    const refresh = () => setSaved(getRegionReport(id));
    refresh();
    return onRegionReportsChanged(refresh);
  }, [id]);

  const [impactOpen, setImpactOpen] = useState(true);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);

  const impactChildren = ["Corn Crop Stage and Water Sufficiency", "Rice Crop Stage and Water Sufficiency", "Monthly Rainfall", "Tropical Cyclone", "Crop Condition and Drought Indicator", "Regions", "Cover Page", "About this Report", "Preface", "Overview"];


  return (
    <div style={{ display: "flex", height: "100vh", background: "#f4f6f8", fontFamily: "'Source Sans Pro', 'Segoe UI', sans-serif", color: "#333", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@300;400;600;700&display=swap');
        * { box-sizing: border-box; }
        .side-link { display:block; padding:8px 16px 8px 28px; font-size:13px; color:#555; cursor:pointer; text-decoration:none; transition:background .12s,color .12s; border-left:3px solid transparent; background:transparent; width:100%; text-align:left; font-family:inherit; border-right:none; }
        .side-link:hover { background:#e8edf2; color:#003087; }
        .side-link.active { background:#dce8f5; color:#003087; border-left:3px solid #003087; font-weight:600; }
        .side-parent { display:flex; align-items:center; justify-content:space-between; padding:9px 14px; font-size:13px; font-weight:600; color:#444; cursor:pointer; transition:background .12s; user-select:none; }
        .side-parent:hover { background:#e8edf2; }
        .print-btn:hover { background:#1565c0 !important; }
        .back-btn:hover { background:#e5e7eb !important; }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-thumb { background:#ccc; border-radius:3px; }

        /* ── A4 Document Styles ── */
        .a4-title { font-size: 28px; font-weight: 900; font-family: 'Times New Roman', Times, serif; color: #000; margin: 0 0 2px; line-height: 1.1; }
        .a4-subtitle-map { font-size: 8px; font-weight: 700; color: #222; margin: 0 0 2px; }
        .a4-map-stage { font-size: 7.5px; color: #333; margin: 0 0 6px; }
        .prov-table { width: 100%; border-collapse: collapse; font-size: 7.5px; font-family: Arial, sans-serif; }
        .prov-table th { border: 1px solid #999; padding: 2px 4px; text-align: center; font-weight: 700; background: #fff; font-size: 7px; }
        .prov-table td { border: 1px solid #999; padding: 2px 4px; text-align: center; font-size: 7.5px; }
        .section-heading { font-size: 15px; font-weight: 900; font-family: 'Times New Roman', Times, serif; text-align: center; margin: 0 0 8px; color: #000; border-bottom: 1.5px solid #000; padding-bottom: 3px; }
        .map-label { font-size: 10px; font-weight: 900; font-family: 'Times New Roman', Times, serif; text-align: center; margin: 0 0 3px; color: #000; }
        .map-sublabel { font-size: 8px; text-align: center; color: #333; margin: 0 0 4px; font-style: italic; }

        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: #fff; }
          .a4-page {
            box-shadow: none !important;
            border: none !important;
            width: 794px !important;
            margin: 0 !important;
            border-radius: 0 !important;
          }
          @page { size: A4 portrait; margin: 10mm 12mm; }
        }
      `}</style>

      {/* ── Sidebar ── */}
      <div className="no-print" style={{ width: 200, background: "#fff", borderRight: "1px solid #dde3ea", display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto" }}>
        <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #eee" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#003087", letterSpacing: ".02em" }}>PAGASA</div>
          <div style={{ fontSize: 10, color: "#888", marginTop: 1 }}>Website Content Management System</div>
          <span style={{ display: "inline-block", marginTop: 4, fontSize: 10, padding: "1px 7px", borderRadius: 3, background: "#d32f2f", color: "#fff", fontWeight: 600 }}>Production</span>
        </div>
        <nav style={{ flex: 1, paddingTop: 6 }}>
          <div className="side-parent" onClick={() => setMaintenanceOpen(p => !p)}>
            <span>Maintenance</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5" style={{ transform: maintenanceOpen ? "rotate(90deg)" : "none", transition: "transform .2s" }}><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          {maintenanceOpen && ["Dashboard","Users","Settings"].map(l => (
            <button key={l} className="side-link">{l}</button>
          ))}
          <div className="side-parent" onClick={() => setImpactOpen(p => !p)} style={{ marginTop: 2 }}>
            <span>Impact Assessment</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5" style={{ transform: impactOpen ? "rotate(90deg)" : "none", transition: "transform .2s" }}><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          {impactOpen && impactChildren.map(l => (
            <button key={l} className={`side-link${l === "Regions" ? " active" : ""}`} onClick={() => router.push("/")}>{l}</button>
          ))}
          <AuditLogNav />
          <div style={{ marginTop: 8, borderTop: "1px solid #eee", paddingTop: 8 }}>
            <div style={{ padding: "4px 14px 6px", fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: ".06em" }}>AI Tools</div>
            <button className="side-link" style={{ paddingLeft: 16, display: "flex", alignItems: "center", gap: 8 }} onClick={() => router.push("/chat")}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4caf50", flexShrink: 0 }} />
              PAGASA AI
            </button>
          </div>
        </nav>
        <div style={{ padding: "10px 14px", borderTop: "1px solid #eee", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#003087", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>M</div>
          <div>
            <div style={{ fontWeight: 600, color: "#333" }}>Hi, Admin</div>
            <div style={{ fontSize: 10, color: "#888" }}>Admin</div>
          </div>
          <div style={{ marginLeft: "auto", width: 8, height: 8, borderRadius: "50%", background: "#4caf50" }} />
        </div>
      </div>

      {/* ── Main Area ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Top bar */}
        <div className="no-print" style={{ background: "#fff", borderBottom: "1px solid #dde3ea", padding: "10px 24px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 13, color: "#003087", fontWeight: 700 }}>PAGASA</span>
          <span style={{ fontSize: 13, color: "#888" }}>Website Content Management System</span>
          <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 3, background: "#d32f2f", color: "#fff", fontWeight: 600 }}>Production</span>
          
        </div>

        {/* Page body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 32px" }}>

          {/* CMS action header */}
          <div className="no-print">
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#222", margin: "0 0 4px" }}>Impact Assessment</h1>
            <div style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>Region — Print Preview</div>
            <div style={{ background: "#fff", border: "1px solid #dde3ea", borderRadius: 6, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#003087", background: "#e8f0fb", padding: "4px 12px", borderRadius: 4, border: "1px solid #c7d9f5" }}>{regionName}</div>
                <span style={{ fontSize: 12, color: "#aaa" }}>Review the A4 document below, then print or save as PDF.</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="back-btn" onClick={() => router.back()}
                  style={{ background: "#fff", border: "1px solid #dde3ea", color: "#374151", borderRadius: 4, padding: "6px 14px", fontSize: 13, cursor: "pointer", transition: "background .15s" }}>
                  ← Back
                </button>
                <button className="print-btn" onClick={() => window.print()}
                  style={{ background: "#003087", color: "#fff", border: "none", borderRadius: 4, padding: "6px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "background .15s" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  Print / Save as PDF
                </button>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════
              A4 DOCUMENT — shared component (also used on the public report page)
          ═══════════════════════════════════════════ */}
          <div ref={printRef}>
            <RegionReportDocument regionName={regionName} summary={summary} month={month} mapImage={saved?.images?.[0] ?? null} chart={saved?.chart ?? null} />
          </div>

                    {/* Bottom back button */}
          <div className="no-print" style={{ marginTop: 16 }}>
            <button className="back-btn" onClick={() => router.back()}
              style={{ background: "#fff", border: "1px solid #dde3ea", color: "#374151", borderRadius: 4, padding: "6px 14px", fontSize: 13, cursor: "pointer", transition: "background .15s" }}>
              ← Back to Review
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
