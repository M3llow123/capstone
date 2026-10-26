"use client";

import { useRef, useState } from "react";
import type { MissingCell } from "../lib/csvValidation";

// Building blocks of the two-stage missing-data workflow. Same inline-style /
// PAGASA palette as CsvValidationPanel:
//   red    MissingDataError      – 1st upload has missing values (blocking)
//   yellow MissingDataWarning    – updated upload still has missing values (consent)
//   green  UpdatedCsvPassed      – updated upload is complete

const RED = { bg: "#fef2f2", border: "#fecaca", title: "#b91c1c", text: "#7f1d1d" };
const AMBER = { bg: "#fffbeb", border: "#fde68a", title: "#b45309", text: "#78350f" };
const GREEN = { bg: "#f0fdf4", border: "#bbf7d0", title: "#15803d", text: "#14532d" };

const box = (t: typeof RED): React.CSSProperties => ({
  background: t.bg, border: `1px solid ${t.border}`, borderRadius: 5,
  padding: "9px 11px", fontSize: 12, lineHeight: 1.5, color: t.text,
});

const VISIBLE = 8;

/** Exact rows and columns that contain missing values. Row = line number in the CSV (row 1 is the header). */
function MissingList({ cells, tone }: { cells: MissingCell[]; tone: typeof RED }) {
  const [all, setAll] = useState(false);
  const shown = all ? cells : cells.slice(0, VISIBLE);
  const th: React.CSSProperties = { textAlign: "left", padding: "3px 8px", fontWeight: 700, color: tone.title, borderBottom: `1px solid ${tone.border}`, whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "3px 8px", borderBottom: `1px solid ${tone.border}`, color: "#374151" };
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ overflowX: "auto", background: "#fff", border: `1px solid ${tone.border}`, borderRadius: 4 }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11.5 }}>
          <thead>
            <tr><th style={th}>CSV row</th><th style={th}>Column</th><th style={th}>Date</th></tr>
          </thead>
          <tbody>
            {shown.map((c, i) => (
              <tr key={`${c.row}-${c.colIndex}-${i}`}>
                <td style={td}>Row {c.row}</td>
                <td style={td}>{c.column}</td>
                <td style={td}>{c.date ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 3, fontSize: 11, color: "#6b7280" }}>Row numbers match the CSV file (row 1 is the header).</div>
      {cells.length > VISIBLE && (
        <button
          onClick={() => setAll((v) => !v)}
          style={{ background: "none", border: "none", padding: "3px 0 0", color: tone.title, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
        >
          {all ? "Show fewer" : `Show all ${cells.length} missing values`}
        </button>
      )}
    </div>
  );
}

/** RED — 1st upload. The second uploader is rendered directly below this by the page. */
export function MissingDataError({ cells }: { cells: MissingCell[] }) {
  const n = cells.length;
  return (
    <div role="alert" style={box(RED)}>
      <div style={{ display: "flex", gap: 7, fontWeight: 700, color: RED.title }}>
        <span aria-hidden>✕</span>
        <span>ERROR: Missing Data Detected</span>
      </div>
      <p style={{ margin: "5px 0 0" }}>
        We detected {n} missing value{n === 1 ? "" : "s"} in your uploaded CSV file. Since this dataset contains official government data,
        the missing values must first be verified by the responsible department.
      </p>
      <MissingList cells={cells} tone={RED} />
    </div>
  );
}

/** The second uploader. Shown only while the first upload has missing values. */
export function UpdatedCsvUploader({
  current, onPick, onRemove,
}: {
  current: { name: string } | null;
  onPick: (file: File) => void;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div style={{ background: "#fff", border: "1px dashed #9ca3af", borderRadius: 5, padding: "10px 11px" }}>
      <label htmlFor="updated-csv" style={{ display: "block", fontWeight: 600, fontSize: 13, color: "#374151", marginBottom: 2 }}>
        Upload Updated CSV File
      </label>
      <div style={{ fontSize: 11.5, color: "#6b7280", marginBottom: 6, lineHeight: 1.45 }}>
        Please upload the updated CSV file provided by the responsible department after data verification.
      </div>
      <input
        id="updated-csv" ref={ref} type="file" accept=".csv,text/csv"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (ref.current) ref.current.value = ""; // lets the same file be picked again
          if (f) onPick(f);
        }}
        style={{ width: "100%", border: "1px solid #dde3ea", borderRadius: 4, padding: "5px 8px", background: "#fff", fontSize: 13 }}
      />
      {current && (
        <div style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "#374151" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Updated file: <b>{current.name}</b></span>
          <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", color: "#d32f2f", fontSize: 12, padding: "0 2px", fontWeight: 600 }}>✕ Remove</button>
        </div>
      )}
    </div>
  );
}

/** GREEN — updated file is complete. */
export function UpdatedCsvPassed({ fileName }: { fileName: string }) {
  return (
    <div role="status" style={box(GREEN)}>
      <div style={{ display: "flex", gap: 7, fontWeight: 700, color: GREEN.title }}>
        <span aria-hidden>✓</span>
        <span><span style={{ fontWeight: 400, color: "#555" }}>{fileName} · </span>Updated CSV Validation Successful.</span>
      </div>
      <p style={{ margin: "5px 0 0" }}>The updated CSV file is now complete. Data processing can continue.</p>
    </div>
  );
}

/** YELLOW/ORANGE — updated file still has missing values. Nothing is replaced until the box is ticked AND the button is pressed. */
export function MissingDataWarning({
  fileName, cells, consent, onConsent, onProceed,
}: {
  fileName: string;
  cells: MissingCell[];
  consent: boolean;
  onConsent: (v: boolean) => void;
  onProceed: () => void;
}) {
  const n = cells.length;
  return (
    <div role="status" style={box(AMBER)}>
      <div style={{ display: "flex", gap: 7, fontWeight: 700, color: AMBER.title }}>
        <span aria-hidden>⚠</span>
        <span><span style={{ fontWeight: 400, color: "#555" }}>{fileName} · </span>WARNING: Missing Data Still Detected</span>
      </div>
      <p style={{ margin: "5px 0 0" }}>
        The updated CSV file still contains {n} missing value{n === 1 ? "" : "s"}, so it is still incomplete. You may choose to proceed by allowing
        Agri-Vision to automatically replace the remaining missing numeric values with 0 for processing purposes.
      </p>
      <MissingList cells={cells} tone={AMBER} />

      <label style={{ display: "flex", alignItems: "flex-start", gap: 7, marginTop: 10, cursor: "pointer" }}>
        <input type="checkbox" checked={consent} onChange={(e) => onConsent(e.target.checked)} style={{ marginTop: 3 }} />
        <span style={{ fontWeight: 600 }}>
          I understand and agree that the system will automatically replace all remaining missing numeric values with 0 for data processing purposes.
          I acknowledge that these values are system-generated replacements and do not represent actual government measurements.
        </span>
      </label>

      <button
        onClick={onProceed}
        disabled={!consent}
        style={{
          marginTop: 9, background: "#b45309", color: "#fff", border: "none", borderRadius: 4,
          padding: "6px 14px", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
          cursor: consent ? "pointer" : "not-allowed", opacity: consent ? 1 : 0.4,
        }}
      >
        Proceed with Missing Values Set to 0
      </button>
      <div style={{ marginTop: 6, fontSize: 11.5, color: "#6b7280" }}>
        Don&apos;t agree? Upload another updated CSV file above instead.
      </div>
    </div>
  );
}
