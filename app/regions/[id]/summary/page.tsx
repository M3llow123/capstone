"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import RegionReportDocument from "../../../components/RegionReportDocument";
import {
  getRegionReport,
  onRegionReportsChanged,
  saveRegionReport,
  type RegionReport,
} from "../../../lib/reportStore";

/**
 * Edit the summary of a region that already has a saved report.
 * Nothing is regenerated: the saved image, graph data and month are kept, only the text changes.
 */
export default function EditSummaryPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [report, setReport] = useState<RegionReport | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialised = useRef(false);

  // Load the saved report. The text box is filled once, so later refreshes never overwrite your edits.
  useEffect(() => {
    const refresh = () => {
      const r = getRegionReport(id);
      setReport(r);
      if (r && !initialised.current) {
        initialised.current = true;
        setText(r.summary);
      }
    };
    refresh();
    const t = setTimeout(() => setLoaded(true), 1500); // give the first load from the server a moment
    const off = onRegionReportsChanged(refresh);
    return () => { clearTimeout(t); off(); };
  }, [id]);

  const dirty = report !== null && text !== report.summary;
  const words = useMemo(() => text.trim().split(/\s+/).filter(Boolean).length, [text]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const back = () => {
    if (dirty && !window.confirm("You have unsaved changes. Leave without saving?")) return;
    router.push("/uploader");
  };

  const save = async () => {
    if (!report) return;
    if (!text.trim()) { setError("The summary can't be empty."); return; }
    setSaving(true);
    setError(null);
    try {
      await saveRegionReport({
        id: report.id,
        name: report.name,
        summary: text.trim(),
        images: report.images,   // existing image URLs are kept as they are
        month: report.month,
        ...(report.chart ? { chart: report.chart } : {}), // omitted -> the server keeps the stored graph data
      });
      initialised.current = true;
      router.push("/uploader");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saving failed. Please try again.");
      setSaving(false);
    }
  };

  const font = "'Source Sans Pro', 'Segoe UI', sans-serif";

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6f8", fontFamily: font, color: "#333" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@400;600;700&display=swap');`}</style>

      {/* top bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "12px 28px", display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ fontWeight: 700, color: "#003087" }}>PAGASA</span>
        <span style={{ fontSize: 13, color: "#64748b" }}>Website Content Management System</span>
        <span style={{ background: "#d32f2f", color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 3 }}>Production</span>
      </div>

      <div style={{ maxWidth: 1500, margin: "0 auto", padding: "26px 28px 40px" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Edit Summary</h1>
        <div style={{ fontSize: 14, color: "#64748b", margin: "4px 0 20px" }}>{report ? report.name : "Region"}</div>

        {!report ? (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, padding: 28, fontSize: 14 }}>
            {loaded ? (
              <>
                <p style={{ marginTop: 0 }}>This region doesn&rsquo;t have a saved report yet, so there is no summary to edit.</p>
                <button onClick={() => router.push(`/regions/${id}/edit`)} style={btn("#2196f3")}>Upload image &amp; generate a summary</button>
                <button onClick={() => router.push("/uploader")} style={{ ...btn("#fff", "#475569"), marginLeft: 8, border: "1px solid #cbd5e1" }}>Back to regions</button>
              </>
            ) : "Loading…"}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 22, alignItems: "flex-start", flexWrap: "wrap" }}>
            {/* editor */}
            <div style={{ flex: "1 1 420px", minWidth: 320, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <label htmlFor="summary" style={{ fontWeight: 600, fontSize: 14 }}>Regional Summary</label>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>{words} words</span>
              </div>
              <textarea
                id="summary"
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck
                style={{ width: "100%", boxSizing: "border-box", minHeight: 460, resize: "vertical", padding: 12, fontFamily: font, fontSize: 14.5, lineHeight: 1.6, border: "1px solid #cbd5e1", borderRadius: 4, outline: "none" }}
              />
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
                Leave a blank line between paragraphs. The preview on the right updates as you type.
              </div>

              {error && <div style={{ marginTop: 12, color: "#b91c1c", fontSize: 13 }}>{error}</div>}

              <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                <button onClick={save} disabled={saving || !dirty} style={{ ...btn("#4caf50"), opacity: saving || !dirty ? 0.55 : 1, cursor: saving || !dirty ? "not-allowed" : "pointer" }}>
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button onClick={() => setText(report.summary)} disabled={!dirty || saving} style={{ ...btn("#fff", "#475569"), border: "1px solid #cbd5e1", opacity: !dirty ? 0.55 : 1 }}>
                  Undo all changes
                </button>
                <button onClick={back} disabled={saving} style={{ ...btn("#fff", "#475569"), border: "1px solid #cbd5e1" }}>Cancel</button>
              </div>
            </div>

            {/* live preview */}
            <div style={{ flex: "0 0 auto", width: 794 * 0.72 + 2, maxWidth: "100%" }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Preview</div>
              <div style={{ width: 794 * 0.72, overflow: "hidden" }}>
                <div style={{ width: 794, zoom: 0.72 } as React.CSSProperties}>
                  <RegionReportDocument
                    regionName={report.name}
                    summary={text}
                    month={report.month}
                    mapImage={report.images?.[0] ?? null}
                    chart={report.chart ?? null}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function btn(bg: string, color = "#fff"): React.CSSProperties {
  return { background: bg, color, border: "none", borderRadius: 4, padding: "9px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
}
