"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import AuditLogNav from "../../../components/AuditLogNav";
import { getRegionReport, refreshContent, saveRegionReport } from "../../../lib/reportStore";

export default function RegionsReviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();

  const id = params?.id as string;
  const regionName = searchParams.get("region") ?? "Unknown Region";
  const initialSummary = searchParams.get("summary") ?? "";
  const month = searchParams.get("month") ?? new Date().toLocaleString("default", { month: "long", year: "numeric" });

  const [summary, setSummary] = useState(initialSummary);
  const [saved, setSaved] = useState(false);
  const [impactOpen, setImpactOpen] = useState(true);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const editorRef = useRef<HTMLDivElement>(null);

  const impactChildren = ["Corn Crop Stage and Water Sufficiency", "Rice Crop Stage and Water Sufficiency", "Monthly Rainfall", "Tropical Cyclone", "Crop Condition and Drought Indicator", "Regions", "Cover Page", "About this Report", "Preface", "Overview"];

  useEffect(() => {
    const words = summary.trim().split(/\s+/).filter(Boolean).length;
    setWordCount(words);
  }, [summary]);

  useEffect(() => {
    if (editorRef.current && initialSummary) {
      editorRef.current.innerText = initialSummary;
    }
  }, []);

  const execFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    updateActiveFormats();
  };

  const updateActiveFormats = () => {
    const active = new Set<string>();
    if (document.queryCommandState("bold")) active.add("bold");
    if (document.queryCommandState("italic")) active.add("italic");
    if (document.queryCommandState("underline")) active.add("underline");
    if (document.queryCommandState("justifyLeft")) active.add("justifyLeft");
    if (document.queryCommandState("justifyCenter")) active.add("justifyCenter");
    if (document.queryCommandState("justifyRight")) active.add("justifyRight");
    setActiveFormats(active);
  };

  const handleEditorInput = () => {
    const text = editorRef.current?.innerText ?? "";
    setSummary(text);
    updateActiveFormats();
  };

  const handleSave = async () => {
    if (saved) return; // already saving
    setSaved(true);
    const currentSummary = (editorRef.current?.innerText ?? summary).trim();

    // Write the edited text to the saved report: that is what the public report page shows.
    // (Before, the edit only travelled to the print preview and the saved summary never changed.)
    try {
      let existing = getRegionReport(id);
      if (!existing) {
        await refreshContent();
        existing = getRegionReport(id);
      }
      if (!existing) {
        throw new Error("No saved report was found for this region. Go back to Upload, generate the summary and click Next first.");
      }
      await saveRegionReport({
        id: existing.id,
        name: existing.name,
        summary: currentSummary,
        images: existing.images,            // existing image URLs are kept as they are
        month: existing.month,
        // only sent when we have it, otherwise the server keeps the stored graph data
        ...(existing.chart ? { chart: existing.chart } : {}),
      });
    } catch (e) {
      setSaved(false);
      window.alert(`Could not save the summary: ${e instanceof Error ? e.message : "unknown error"}`);
      return;
    }

    router.push(
      `/regions/${id}/print?summary=${encodeURIComponent(currentSummary)}&region=${encodeURIComponent(regionName)}&month=${encodeURIComponent(month)}`
    );
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(summary);
  };

  const btnStyle = (active: boolean): React.CSSProperties => ({
    background: active ? "#003087" : "none",
    color: active ? "#fff" : "#374151",
    border: "1px solid #dde3ea",
    borderRadius: 3,
    padding: "3px 8px",
    fontSize: 13,
    cursor: "pointer",
    transition: "all .12s",
    minWidth: 28,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  });

  return (
    <div style={{
      display: "flex", height: "100vh",
      background: "#f4f6f8",
      fontFamily: "'Source Sans Pro', 'Segoe UI', sans-serif",
      color: "#333", overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@300;400;600;700&display=swap');
        * { box-sizing: border-box; }
        .side-link { display:block; padding:8px 16px 8px 28px; font-size:13px; color:#555; cursor:pointer; text-decoration:none; transition:background .12s,color .12s; border-left:3px solid transparent; border-right:none; background:transparent; width:100%; text-align:left; font-family:inherit; }
        .side-link:hover { background:#e8edf2; color:#003087; }
        .side-link.active { background:#dce8f5; color:#003087; border-left:3px solid #003087; font-weight:600; }
        .side-parent { display:flex; align-items:center; justify-content:space-between; padding:9px 14px; font-size:13px; font-weight:600; color:#444; cursor:pointer; transition:background .12s; user-select:none; }
        .side-parent:hover { background:#e8edf2; }
        .toolbar-btn:hover { background:#e8edf2 !important; color:#003087 !important; }
        .btn-save:hover { background:#1565c0 !important; }
        .btn-back:hover { background:#e5e7eb !important; }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-thumb { background:#ccc; border-radius:3px; }
        [contenteditable]:focus { outline: none; }
        [contenteditable]:empty:before { content: attr(data-placeholder); color: #aaa; pointer-events: none; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none} }
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
          {maintenanceOpen && ["Dashboard", "Users", "Settings"].map(label => (
            <button key={label} className="side-link" onClick={() => {}}>{label}</button>
          ))}

          <div className="side-parent" onClick={() => setImpactOpen(p => !p)} style={{ marginTop: 2 }}>
            <span>Impact Assessment</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5" style={{ transform: impactOpen ? "rotate(90deg)" : "none", transition: "transform .2s" }}>
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          {impactOpen && impactChildren.map(label => (
            <button key={label} className={`side-link${label === "Regions" ? " active" : ""}`} onClick={() => router.push("/")}>{label}</button>
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
          <div style={{ marginLeft: "auto", width: 8, height: 8, borderRadius: "50%", background: "#4caf50" }} title="Online" />
        </div>
      </div>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Top bar */}
        <div style={{ background: "#fff", borderBottom: "1px solid #dde3ea", padding: "10px 24px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 13, color: "#003087", fontWeight: 700 }}>PAGASA</span>
          <span style={{ fontSize: 13, color: "#888" }}>Website Content Management System</span>
          <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 3, background: "#d32f2f", color: "#fff", fontWeight: 600 }}>Production</span>
         
        </div>

        {/* Page body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "28px 28px 32px" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#222", margin: "0 0 4px" }}>Impact Assessment</h1>
          <div style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>Region — Review & Edit Summary</div>

          {/* Region badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#003087", background: "#e8f0fb", padding: "4px 12px", borderRadius: 4, border: "1px solid #c7d9f5" }}>
              {regionName}
            </div>
            <span style={{ fontSize: 12, color: "#aaa" }}>Review the AI-generated summary below. You can edit, reformat, or revise before saving.</span>
          </div>

          {/* ── Editor Card ── */}
          <div style={{ background: "#fff", borderRadius: 6, border: "1px solid #dde3ea", overflow: "hidden", animation: "fadeIn .25s ease" }}>

            {/* Card header */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#003087" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                <span style={{ fontWeight: 600, fontSize: 14, color: "#222" }}>Edit Summary</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleCopy}
                  className="btn-back"
                  style={{ background: "#fff", border: "1px solid #dde3ea", color: "#555", borderRadius: 4, padding: "6px 14px", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "background .15s" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                  Copy
                </button>
                <button
                  onClick={handleSave}
                  className="btn-save"
                  style={{ background: saved ? "#16a34a" : "#003087", color: "#fff", border: "none", borderRadius: 4, padding: "6px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "background .15s" }}
                >
                  {saved
                    ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>Redirecting...</>
                    : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>Save &amp; Publish</>
                  }
                </button>
              </div>
            </div>

            {/* Toolbar */}
            <div style={{ padding: "8px 12px", borderBottom: "1px solid #eee", background: "#fafbfc", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 3, marginRight: 6 }}>
                <button className="toolbar-btn" style={btnStyle(activeFormats.has("bold"))} onClick={() => execFormat("bold")} title="Bold"><b>B</b></button>
                <button className="toolbar-btn" style={btnStyle(activeFormats.has("italic"))} onClick={() => execFormat("italic")} title="Italic"><i>I</i></button>
                <button className="toolbar-btn" style={btnStyle(activeFormats.has("underline"))} onClick={() => execFormat("underline")} title="Underline"><u>U</u></button>
              </div>

              <div style={{ width: 1, height: 20, background: "#dde3ea", margin: "0 4px" }} />

              <div style={{ display: "flex", gap: 3, marginRight: 6 }}>
                <button className="toolbar-btn" style={btnStyle(activeFormats.has("justifyLeft"))} onClick={() => execFormat("justifyLeft")} title="Align Left">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
                </button>
                <button className="toolbar-btn" style={btnStyle(activeFormats.has("justifyCenter"))} onClick={() => execFormat("justifyCenter")} title="Center">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
                </button>
                <button className="toolbar-btn" style={btnStyle(activeFormats.has("justifyRight"))} onClick={() => execFormat("justifyRight")} title="Align Right">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>
                </button>
              </div>

              <div style={{ width: 1, height: 20, background: "#dde3ea", margin: "0 4px" }} />

              <select
                onChange={e => execFormat("fontSize", e.target.value)}
                style={{ border: "1px solid #dde3ea", borderRadius: 3, padding: "2px 6px", fontSize: 12, color: "#374151", background: "#fff", cursor: "pointer" }}
                defaultValue=""
              >
                <option value="" disabled>Size</option>
                {[1,2,3,4,5,6,7].map(s => <option key={s} value={String(s)}>Size {s}</option>)}
              </select>

              <div style={{ width: 1, height: 20, background: "#dde3ea", margin: "0 4px" }} />

              <div style={{ display: "flex", gap: 3 }}>
                <button className="toolbar-btn" style={btnStyle(false)} onClick={() => execFormat("undo")} title="Undo">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></svg>
                </button>
                <button className="toolbar-btn" style={btnStyle(false)} onClick={() => execFormat("redo")} title="Redo">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 019-9 9 9 0 016 2.3L21 13"/></svg>
                </button>
              </div>

              <div style={{ width: 1, height: 20, background: "#dde3ea", margin: "0 4px" }} />

              <button
                className="toolbar-btn"
                style={{ ...btnStyle(false), fontSize: 11, padding: "3px 8px", gap: 4, display: "flex", alignItems: "center" }}
                onClick={() => execFormat("removeFormat")}
                title="Clear formatting"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7l4-4 10 10-4 4L4 7z"/><path d="M14 14l-4 7h9"/><line x1="3" y1="21" x2="7" y2="17"/></svg>
                Clear
              </button>

              <span style={{ marginLeft: "auto", fontSize: 11, color: "#aaa" }}>{wordCount} words</span>
            </div>

            {/* Content-editable editor */}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              data-placeholder="Start typing your summary here..."
              onInput={handleEditorInput}
              onKeyUp={updateActiveFormats}
              onMouseUp={updateActiveFormats}
              style={{
                minHeight: 320,
                padding: "20px 24px",
                fontSize: 14,
                lineHeight: 1.85,
                color: "#1f2937",
                outline: "none",
                fontFamily: "'Source Sans Pro', 'Segoe UI', sans-serif",
                whiteSpace: "pre-wrap",
              }}
            />

            {/* Footer */}
            <div style={{ padding: "10px 16px", borderTop: "1px solid #eee", background: "#fafbfc", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, color: "#aaa" }}>
                {wordCount} words · {summary.length} characters
              </span>
              <span style={{ fontSize: 11, color: "#aaa", fontStyle: "italic" }}>
                Powered by PAGASA Climate Model v2.4 · AI can make mistakes. Verify important data.
              </span>
            </div>
          </div>

          {/* Back button */}
          <div style={{ marginTop: 14 }}>
            <button
              className="btn-back"
              onClick={() => router.back()}
              style={{ background: "#fff", border: "1px solid #dde3ea", color: "#374151", borderRadius: 4, padding: "6px 14px", fontSize: 13, cursor: "pointer", transition: "background .15s" }}
            >
              ← Back to Upload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}