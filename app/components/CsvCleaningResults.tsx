"use client";

import { useState } from "react";
import { cleaningLogToCsv, downloadTextFile, type CleaningReport, type PreviewCell } from "../lib/csvCleaning";
import { substitutionNotice } from "../lib/csvWorkflow";

// "CSV Data Cleaning Results": summary, Before/After comparison, modified-values
// log and downloads. Everything shown comes from the real CleaningReport that was
// built from the uploaded file — nothing here is sample data.

const CELL: Record<PreviewCell["kind"], React.CSSProperties> = {
  value: {},
  missing: { background: "#fee2e2", color: "#b91c1c", fontWeight: 700 }, // missing in the original
  generated: { background: "#dcfce7", color: "#15803d", fontWeight: 700, boxShadow: "inset 0 0 0 1px #86efac" }, // system-generated 0
  zero: { background: "#f3f4f6", color: "#4b5563", fontStyle: "italic" }, // a real 0 from the file
};

const th: React.CSSProperties = { textAlign: "left", padding: "5px 9px", fontWeight: 700, background: "#f9fafb", borderBottom: "1px solid #dde3ea", position: "sticky", top: 0, whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "4px 9px", borderBottom: "1px solid #f0f2f5", whiteSpace: "nowrap" };

export default function CsvCleaningResults({ report, onDiscard }: { report: CleaningReport; onDiscard: () => void }) {
  const [tab, setTab] = useState<"before" | "after">("before");
  const s = report.summary;
  const done = s.status === "Cleaning Completed";

  const stat = (label: string, value: string | number, color = "#111827") => (
    <div style={{ flex: "1 1 130px", border: "1px solid #dde3ea", borderRadius: 5, padding: "8px 10px", background: "#fff" }}>
      <div style={{ fontSize: 11, color: "#6b7280" }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color }}>{value}</div>
    </div>
  );

  return (
    <section aria-label="CSV Data Cleaning Results" style={{ marginTop: 16, border: "1px solid #dde3ea", borderRadius: 6, background: "#fff", overflow: "hidden", fontSize: 12.5 }}>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: "#222" }}>CSV Data Cleaning Results</span>
        <span style={{ fontSize: 11.5, color: "#6b7280" }}>Source: {report.sourceFileName} (unchanged)</span>
      </div>

      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Status + disclosure */}
        <div role="status" style={{ background: done ? "#f0fdf4" : "#fef2f2", border: `1px solid ${done ? "#bbf7d0" : "#fecaca"}`, borderRadius: 5, padding: "9px 11px", color: done ? "#14532d" : "#7f1d1d" }}>
          <div style={{ fontWeight: 700, color: done ? "#15803d" : "#b91c1c" }}>{done ? "✓ Data Cleaning Completed" : "✕ Data Cleaning Incomplete"}</div>
          <div style={{ marginTop: 3 }}>
            The dataset now contains <b>system-generated replacement values</b>, not verified measurements. {substitutionNotice(s.replaced)}
          </div>
        </div>

        {/* A. Summary */}
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6, color: "#374151" }}>Cleaning Summary</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {stat("Missing Values Detected", s.detected, "#b91c1c")}
            {stat("Values Replaced with 0", s.replaced, "#15803d")}
            {stat("Remaining Missing Values", s.remaining, s.remaining ? "#b91c1c" : "#111827")}
            {stat("Data Cleaning Status", s.status, done ? "#15803d" : "#b91c1c")}
          </div>
        </div>

        {/* B. Before / After */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
            <div role="tablist" style={{ display: "inline-flex", border: "1px solid #dde3ea", borderRadius: 5, overflow: "hidden" }}>
              {(["before", "after"] as const).map((t) => (
                <button
                  key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                  style={{ padding: "5px 14px", border: "none", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: tab === t ? "#003087" : "#fff", color: tab === t ? "#fff" : "#374151" }}
                >
                  {t === "before" ? "Before Cleaning" : "After Cleaning"}
                </button>
              ))}
            </div>
            <span style={{ fontSize: 11.5, color: "#6b7280", display: "inline-flex", gap: 10, flexWrap: "wrap" }}>
              {tab === "before"
                ? <span><b style={{ ...CELL.missing, padding: "0 5px" }}>Missing</b> missing in your file</span>
                : <>
                    <span><b style={{ ...CELL.generated, padding: "0 5px" }}>0</b> system-generated</span>
                    <span><b style={{ ...CELL.zero, padding: "0 5px" }}>0</b> original zero from the file</span>
                  </>}
            </span>
          </div>
          <div style={{ overflow: "auto", maxHeight: 320, border: "1px solid #dde3ea", borderRadius: 5 }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={th}>Row</th>
                  {report.header.map((h, i) => <th key={i} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.row}>
                    <td style={{ ...td, color: "#6b7280" }}>{r.row}</td>
                    {(tab === "before" ? r.before : r.after).map((c, i) => (
                      <td key={i} style={{ ...td, ...CELL[c.kind] }}>{c.text}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* C. Modified values log */}
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6, color: "#374151" }}>Modified Values Log</div>
          <div style={{ overflow: "auto", maxHeight: 240, border: "1px solid #dde3ea", borderRadius: 5 }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
              <thead>
                <tr>{["CSV Row Number", "Column Name", "Original Value", "New Value", "Action Performed"].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {report.log.map((e, i) => (
                  <tr key={i}>
                    <td style={td}>Row {e.row}</td>
                    <td style={td}>{e.column}</td>
                    <td style={{ ...td, color: "#b91c1c", fontWeight: 600 }}>{e.originalValue}</td>
                    <td style={{ ...td, color: "#15803d", fontWeight: 600 }}>{e.newValue}</td>
                    <td style={td}>{e.action}</td>
                  </tr>
                ))}
                {report.log.length === 0 && <tr><td style={td} colSpan={5}>No values were modified.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* D. Downloads */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={() => downloadTextFile(report.cleanedFileName, report.cleanedText)}
            style={{ background: "#003087", color: "#fff", border: "none", borderRadius: 4, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            Download Cleaned CSV
          </button>
          <button
            onClick={() => downloadTextFile(report.cleanedFileName.replace(/_cleaned\.csv$/i, "") + "_cleaning_log.csv", cleaningLogToCsv(report))}
            style={{ background: "#fff", color: "#003087", border: "1px solid #003087", borderRadius: 4, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            Download Cleaning Log
          </button>
          <button
            onClick={onDiscard}
            style={{ marginLeft: "auto", background: "none", border: "none", color: "#6b7280", fontSize: 12, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" }}
          >
            Discard cleaned copy &amp; withdraw consent
          </button>
        </div>
      </div>
    </section>
  );
}
