"use client";

import { useState } from "react";
import type { ValidationResult } from "../lib/csvValidation";

// Shows the outcome of validating ONE csv file:
//   red    = Critical error  → file is blocked, nothing can be saved or generated
//   yellow = Warning         → admin must tick "Override & Confirm" to continue
//   green  = Passed          → ready
// Colours follow the rest of the upload page (inline styles, PAGASA palette).

const TONE = {
  rejected: { bg: "#fef2f2", border: "#fecaca", title: "#b91c1c", text: "#7f1d1d", icon: "✕" },
  warning:  { bg: "#fffbeb", border: "#fde68a", title: "#b45309", text: "#78350f", icon: "⚠" },
  passed:   { bg: "#f0fdf4", border: "#bbf7d0", title: "#15803d", text: "#14532d", icon: "✓" },
  incomplete: { bg: "#fffbeb", border: "#fde68a", title: "#b45309", text: "#78350f", icon: "⚠" }, // normally shown by MissingDataWarning instead
} as const;

const CHECK_ICON = { passed: "✓", warning: "⚠", failed: "✕", skipped: "–" } as const;
const CHECK_COLOR = { passed: "#16a34a", warning: "#d97706", failed: "#dc2626", skipped: "#9ca3af" } as const;

const VISIBLE_ISSUES = 8;

export default function CsvValidationPanel({
  result,
  confirmed,
  onConfirmChange,
}: {
  result: ValidationResult;
  confirmed: boolean;
  onConfirmChange: (v: boolean) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [showChecks, setShowChecks] = useState(false);
  const tone = TONE[result.status];
  // Empty cells are listed by the missing-data block (with the updated-CSV uploader), so they are not repeated here.
  const listed = result.issues.filter((i) => !i.missing);
  const issues = showAll ? listed : listed.slice(0, VISIBLE_ISSUES);
  const hasMissing = result.missingCount > 0;

  const title =
    result.status === "rejected"
      ? `File rejected — ${result.otherErrorCount} ${hasMissing ? "other " : ""}error${result.otherErrorCount === 1 ? "" : "s"} found. Nothing was saved.`
      : result.status === "warning"
        ? `Warning — ${result.warningCount} item${result.warningCount === 1 ? "" : "s"} need your review before publishing.`
        : `CSV Validation Successful. Validated for ${result.regionName} (${result.recordsPassed}/${result.recordsTotal} records passed${result.monthLabel ? `, ${result.monthLabel}` : ""}). Graph ready.`;

  return (
    <div
      role={result.status === "rejected" ? "alert" : "status"}
      style={{ background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: 5, padding: "9px 11px", fontSize: 12, lineHeight: 1.5, color: tone.text }}
    >
      <div style={{ display: "flex", gap: 7, fontWeight: 700, color: tone.title }}>
        <span aria-hidden>{tone.icon}</span>
        <span>
          <span style={{ fontWeight: 400, color: "#555" }}>{result.fileName} · </span>
          {title}
        </span>
      </div>

      {issues.length > 0 && (
        <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
          {issues.map((it, i) => (
            <li key={i} style={{ marginBottom: 2 }}>{it.message}</li>
          ))}
        </ul>
      )}
      {listed.length > VISIBLE_ISSUES && (
        <button
          onClick={() => setShowAll((v) => !v)}
          style={{ background: "none", border: "none", padding: "4px 0 0 18px", color: tone.title, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
        >
          {showAll ? "Show fewer" : `Show all ${listed.length} messages`}
        </button>
      )}

      {result.status === "rejected" && (
        <div style={{ marginTop: 6, fontWeight: 600 }}>
          {hasMissing
            ? "Besides the missing values, this file has other errors. Make sure the updated CSV fixes them too."
            : "Fix the file upstream, then remove this one and upload the corrected CSV."}
        </div>
      )}

      {result.status === "warning" && (
        <label style={{ display: "flex", alignItems: "flex-start", gap: 7, marginTop: 8, cursor: "pointer", fontWeight: 600 }}>
          <input type="checkbox" checked={confirmed} onChange={(e) => onConfirmChange(e.target.checked)} style={{ marginTop: 3 }} />
          <span>Override &amp; Confirm — I reviewed these warnings with the data engineering team and want to proceed.</span>
        </label>
      )}

      <button
        onClick={() => setShowChecks((v) => !v)}
        style={{ background: "none", border: "none", padding: "6px 0 0", color: "#555", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}
      >
        {showChecks ? "Hide checks" : "View all checks"}
      </button>
      {showChecks && (
        <div style={{ marginTop: 4, display: "grid", gridTemplateColumns: "auto 1fr auto", columnGap: 8, rowGap: 2, fontSize: 11.5, color: "#374151" }}>
          {result.checks.map((c) => (
            <div key={c.id} style={{ display: "contents" }}>
              <span style={{ color: CHECK_COLOR[c.status], fontWeight: 700 }}>{CHECK_ICON[c.status]}</span>
              <span>{c.label}</span>
              <span style={{ color: "#6b7280" }}>{c.detail}</span>
            </div>
          ))}
          {result.provinceSums.length > 0 && (
            <div style={{ gridColumn: "1 / -1", marginTop: 4, color: "#6b7280" }}>
              Monthly totals: {result.provinceSums.map((p) => `${p.name} ${p.sum.toFixed(1)}%`).join(" · ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
