// ── Agri-Vision CSV cleaning (missing values → 0, only with the user's consent) ──
// The uploaded file is NEVER modified. This file builds a SEPARATE processing
// copy of its text in which only the missing province cells are set to 0, and
// records exactly which cells were changed so the user can see and download it.
//
// What is replaced:   empty / "N/A"-style cells in the province (numeric) columns.
// What is never touched: the Date column, headers, and every value that was
//   already present (including real zeros). Real zeros and system-generated
//   zeros stay distinguishable: each replaced cell is listed in the log and
//   tagged "generated" in the preview.
//
// No browser-only imports here, so it is easy to unit-test from Node.

import { splitCsvLine, detectDelimiter, type MissingCell } from "./csvValidation";

/** Decodes uploaded bytes the same way the validator does (UTF-8, BOM stripped). */
export function csvTextFromBytes(bytes: ArrayBuffer | Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes).replace(/^﻿/, "");
}

// ── Cell positions inside one line (so we can replace text without re-quoting anything) ──
function cellSpans(line: string, delim: string): [number, number][] {
  const spans: [number, number][] = [];
  let start = 0;
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') i++;
      else q = !q;
    } else if (ch === delim && !q) {
      spans.push([start, i]);
      start = i + 1;
    }
  }
  spans.push([start, line.length]);
  return spans;
}

/**
 * Returns a copy of `text` in which exactly the listed cells are "0".
 * Line endings, quoting, spacing and every other cell are kept byte-for-byte.
 * Row numbers in `cells` are file line numbers (header = 1), as produced by the validator.
 */
export function replaceMissingWithZero(text: string, cells: MissingCell[], delimiter: string): { text: string; replaced: number } {
  const byRow = new Map<number, MissingCell[]>();
  for (const c of cells) byRow.set(c.row, [...(byRow.get(c.row) ?? []), c]);

  const parts = text.split(/(\r\n|\n|\r)/); // text, separator, text, separator …
  let replaced = 0;
  for (let p = 0; p < parts.length; p += 2) {
    const lineNo = p / 2 + 1;
    const todo = byRow.get(lineNo);
    if (!todo) continue;
    let line = parts[p];
    const spans = cellSpans(line, delimiter);
    // right-to-left so earlier offsets stay valid
    for (const c of [...todo].sort((a, b) => b.colIndex - a.colIndex)) {
      const sp = spans[c.colIndex];
      if (!sp) continue; // short row: not a missing cell we can address (validator rejects those anyway)
      line = line.slice(0, sp[0]) + "0" + line.slice(sp[1]);
      replaced++;
    }
    parts[p] = line;
  }
  return { text: parts.join(""), replaced };
}

// ── What the "CSV Data Cleaning Results" section shows ──────────────────
export type PreviewKind = "value" | "missing" | "generated" | "zero";
export interface PreviewCell { text: string; kind: PreviewKind }
export interface PreviewRow { row: number; before: PreviewCell[]; after: PreviewCell[] }

export interface LogEntry {
  row: number;
  column: string;
  date: string;
  originalValue: string; // always "Missing" (what was in the file is in `note` when it was not just blank)
  newValue: number;
  action: "Replaced";
  note: string;
}

export interface CleaningReport {
  sourceFileName: string; // the file the user uploaded (never changed)
  cleanedFileName: string;
  cleanedText: string; // the processing copy
  header: string[];
  rows: PreviewRow[];
  log: LogEntry[];
  substitutedProvinces: string[];
  summary: { detected: number; replaced: number; remaining: number; status: "Cleaning Completed" | "Cleaning Incomplete" };
  createdAt: string; // ISO
}

const NOTE = "System-generated replacement. Not an official measurement.";

export function buildCleaningReport(input: {
  sourceFileName: string;
  originalText: string;
  cleanedText: string;
  cells: MissingCell[];
  delimiter: string;
  remaining: number; // missing values still left in the cleaned copy (re-validated by the caller)
}): CleaningReport {
  const { sourceFileName, originalText, cleanedText, cells, delimiter, remaining } = input;
  const missingAt = new Set(cells.map((c) => `${c.row}:${c.colIndex}`));

  // original rows with their real line numbers
  const lines: { no: number; text: string }[] = [];
  originalText.split(/\r\n|\n|\r/).forEach((t, i) => { if (t.trim() !== "") lines.push({ no: i + 1, text: t }); });
  const delim = delimiter || detectDelimiter(lines[0]?.text ?? "") || ",";
  const header = lines.length ? splitCsvLine(lines[0].text, delim).map((h) => h.trim()) : [];

  const rows: PreviewRow[] = [];
  for (const l of lines.slice(1)) {
    const raw = splitCsvLine(l.text, delim).map((x) => x.trim());
    if (!raw.some((x) => x !== "")) continue;
    const before: PreviewCell[] = [];
    const after: PreviewCell[] = [];
    raw.forEach((v, ci) => {
      if (missingAt.has(`${l.no}:${ci}`)) {
        before.push({ text: "Missing", kind: "missing" });
        after.push({ text: "0", kind: "generated" });
      } else {
        const isRealZero = ci > 0 && v !== "" && /^[+-]?0*\.?0*%?$/.test(v) && /\d/.test(v) && parseFloat(v.replace("%", "")) === 0;
        before.push({ text: v, kind: isRealZero ? "zero" : "value" });
        after.push({ text: v, kind: isRealZero ? "zero" : "value" });
      }
    });
    rows.push({ row: l.no, before, after });
  }

  const log: LogEntry[] = [...cells]
    .sort((a, b) => a.row - b.row || a.colIndex - b.colIndex)
    .map((c) => ({
      row: c.row,
      column: c.column,
      date: c.date ?? "",
      originalValue: "Missing",
      newValue: 0,
      action: "Replaced" as const,
      note: c.raw.trim() === "" ? NOTE : `The file contained "${c.raw.trim()}". ${NOTE}`,
    }));

  return {
    sourceFileName,
    cleanedFileName: sourceFileName.replace(/\.csv$/i, "") + "_cleaned.csv",
    cleanedText,
    header,
    rows,
    log,
    substitutedProvinces: [...new Set(cells.map((c) => c.province))],
    summary: {
      detected: cells.length,
      replaced: log.length,
      remaining,
      status: remaining === 0 ? "Cleaning Completed" : "Cleaning Incomplete",
    },
    createdAt: new Date().toISOString(),
  };
}

// ── Downloads ───────────────────────────────────────────────────────────
const q = (v: string | number) => {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** The cleaning log as CSV text (one line per modified cell). */
export function cleaningLogToCsv(r: CleaningReport): string {
  const head = ["Row", "Column", "Date", "Original Value", "New Value", "Action", "Note"];
  const body = r.log.map((e) => [e.row, e.column, e.date, e.originalValue, e.newValue, e.action, e.note].map(q).join(","));
  return [head.join(","), ...body].join("\r\n") + "\r\n";
}

/** Saves text as a file in the browser. (Leading BOM so Excel reads UTF-8 correctly.) */
export function downloadTextFile(fileName: string, text: string) {
  const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
