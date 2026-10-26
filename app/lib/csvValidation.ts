// ── Agri-Vision CSV validation ──────────────────────────────────────────
// Audits an uploaded "% of monthly rainfall total" CSV BEFORE it is used for
// the AI summary or the interactive graph. It never fixes or imputes data —
// it only checks it and reports exactly where a problem is. (Replacing missing
// values with 0 is a separate, consent-gated step: see csvCleaning.ts.)
//
// Expected layout (one row per day, one column per province of the region):
//   Date,Ilocos Norte,Ilocos Sur,La Union,Pangasinan
//   2026-08-01,0.5,1.2,0.0,3.4          (or 01/08/2026 — DD/MM/YYYY)
//
// Checks (numbers match the validation spec):
//   1 schema      headers match the selected region                → Hard reject
//   2 range       every value is between 0 and 100                 → Hard reject
//   3 sum         each province adds up to ~100% for the month    → Warning (override allowed)
//   4 dates       valid, sequential, complete month                → Hard reject
//   5 outliers    extreme spikes (robust Z-score / IQR)            → Warning (override allowed)
//   6 file/clean  encoding, hidden characters, non-numeric cells   → Hard reject
//
// This file has no browser or Node-only imports, so the exact same code runs in
// the upload page (instant feedback) and on the server (double check on save).

import { REGION_PROVINCES, canonicalProvince, regionOfProvince } from "./regionProvinces";

// ── Tunable limits ──────────────────────────────────────────────────────
export const LIMITS = {
  maxBytes: 5 * 1024 * 1024, // reject files bigger than 5 MB
  minPct: 0,
  maxPct: 100,
  sumMin: 99.5, // a month's daily % should add up to 100 ± rounding
  sumMax: 100.5,
  zThreshold: 3.5, // modified Z-score above this = statistical outlier
  extremeMinPct: 30, // …but only flag it if the day also holds ≥ 30% of the month's rain
  maxIssuesPerCheck: 100, // keep the UI readable if a file is badly broken
} as const;

// ── Types ───────────────────────────────────────────────────────────────
export type Severity = "error" | "warning";
export type CheckId = "file" | "schema" | "cleanliness" | "range" | "dates" | "sum" | "outliers";
export type CheckStatus = "passed" | "warning" | "failed" | "skipped";
// "incomplete" only occurs in missing:"collect" mode (second/updated upload):
// the file is otherwise valid but still has empty cells, so the user decides what to do.
export type ValidationStatus = "passed" | "warning" | "rejected" | "incomplete";

/** An empty (or "N/A"-style) cell in a province column. Row = line number in the file (header = row 1). */
export interface MissingCell {
  row: number;
  colIndex: number; // 0-based column index in the file
  column: string; // e.g. "Ilocos Norte (B)"
  province: string; // canonical province name
  date: string | null; // raw date text of that row, if any
  raw: string; // what the file actually contained ("" or e.g. "N/A")
}

export interface ValidateOptions {
  /**
   * "error"   (default, 1st upload) missing cells are blocking errors.
   * "collect" (2nd upload) missing cells are only recorded; the status becomes "incomplete".
   */
  missing?: "error" | "collect";
  /** Provinces whose cells were replaced with 0 by the system: their "adds up to 100%" check is skipped (it cannot hold). */
  substituted?: string[];
}

export interface ValidationIssue {
  check: CheckId;
  severity: Severity;
  message: string;
  row?: number; // line number in the file (header = row 1, like Excel)
  column?: string; // e.g. "Ilocos Norte (B)"
  missing?: boolean; // true when the issue is an empty cell (not any other kind of bad data)
}

export interface CheckSummary {
  id: CheckId;
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface ValidatedTable {
  dates: string[]; // ISO yyyy-mm-dd, in file order
  provinces: string[]; // canonical province names, header order
  values: number[][]; // values[province][day] = % of the month's total
}

export interface ValidationResult {
  fileName: string;
  regionId: string;
  regionName: string;
  status: ValidationStatus;
  monthLabel: string | null; // "August 2026"
  recordsTotal: number; // data rows found
  recordsPassed: number; // data rows without any error
  errorCount: number;
  warningCount: number;
  issues: ValidationIssue[];
  checks: CheckSummary[];
  provinceSums: { name: string; sum: number }[];
  table: ValidatedTable | null; // only when status is passed / warning
  missingCells: MissingCell[]; // every empty cell found in the province columns
  missingCount: number;
  otherErrorCount: number; // blocking errors that are NOT empty cells (wrong columns, bad dates, text in cells …)
  delimiter: string | null; // detected column separator (needed to build the cleaned copy)
}

const CHECK_LABELS: Record<CheckId, string> = {
  file: "File type & encoding",
  schema: "Region columns & headers",
  cleanliness: "Clean numeric data",
  range: "Value range (0–100%)",
  dates: "Dates & month continuity",
  sum: "Monthly total ≈ 100%",
  outliers: "Extreme-value scan",
};
const CHECK_ORDER: CheckId[] = ["file", "schema", "cleanliness", "range", "dates", "sum", "outliers"];

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ── Small helpers ───────────────────────────────────────────────────────
const colLetter = (i: number): string => {
  let n = i, s = "";
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
};
const colLabel = (header: string, i: number) => `${header || "(blank)"} (${colLetter(i)})`;
const pad2 = (n: number) => String(n).padStart(2, "0");
const fmtDMY = (y: number, m: number, d: number) => `${pad2(d)}/${pad2(m)}/${y}`;
const dayNum = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) / 86_400_000;
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const fmtDayNum = (n: number) => {
  const dt = new Date(n * 86_400_000);
  return fmtDMY(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
};
const round = (n: number, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp;
const show = (s: string) => (s.length > 24 ? s.slice(0, 24) + "…" : s) || "(empty)";

// invisible / control characters that crash parsers or silently break numbers
// Cells that mean "no measurement" in spreadsheets / government exports (compared in lowercase).
const MISSING_TOKENS = new Set(["na", "n/a", "nan", "null", "none", "-", "--"]);
const HIDDEN_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u00A0\u200B-\u200F\u2028\u2029\u202F\u2060\uFEFF]/;
// a plain number, optional sign, optional % sign. (No "N/A", "#VALUE!", "1e5", "1,5" …)
const NUMBER = /^[+-]?(\d+(\.\d*)?|\.\d+)%?$/;

export function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q;
    } else if (c === delim && !q) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

export function detectDelimiter(headerLine: string): string | null {
  const best = [",", ";", "\t"]
    .map((d) => ({ d, n: splitCsvLine(headerLine, d).length - 1 }))
    .sort((a, b) => b.n - a.n)[0];
  return best.n > 0 ? best.d : null;
}

type ParsedDate = { ok: true; y: number; m: number; d: number } | { ok: false; reason: "format" | "calendar" };
/** Accepts YYYY-MM-DD or DD/MM/YYYY only, and rejects impossible dates like 31/02/2026. */
function parseDateStrict(raw: string): ParsedDate {
  const s = raw.trim();
  let y: number, m: number, d: number;
  let mt: RegExpMatchArray | null;
  if ((mt = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) { y = +mt[1]; m = +mt[2]; d = +mt[3]; }
  else if ((mt = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) { d = +mt[1]; m = +mt[2]; y = +mt[3]; }
  else return { ok: false, reason: "format" };
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (y < 1900 || y > 2100 || dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return { ok: false, reason: "calendar" };
  }
  return { ok: true, y, m, d };
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// ── Issue collector (counts everything, stores a readable amount) ───────
class Collector {
  issues: ValidationIssue[] = [];
  errors: Record<CheckId, number> = { file: 0, schema: 0, cleanliness: 0, range: 0, dates: 0, sum: 0, outliers: 0 };
  warnings: Record<CheckId, number> = { file: 0, schema: 0, cleanliness: 0, range: 0, dates: 0, sum: 0, outliers: 0 };
  private stored: Record<CheckId, number> = { file: 0, schema: 0, cleanliness: 0, range: 0, dates: 0, sum: 0, outliers: 0 };
  errorRows = new Set<number>();
  missingErrors = 0; // how many of the errors are plain empty cells

  add(i: ValidationIssue) {
    if (i.severity === "error") { this.errors[i.check]++; if (i.missing) this.missingErrors++; if (i.row != null && i.row > 1) this.errorRows.add(i.row); } // row 1 is the header, not a record
    else this.warnings[i.check]++;
    if (this.stored[i.check] < LIMITS.maxIssuesPerCheck) { this.stored[i.check]++; this.issues.push(i); }
  }
  /** Adds a "…and N more" line for any check whose list was cut short. */
  finish() {
    for (const id of CHECK_ORDER) {
      const total = this.errors[id] + this.warnings[id];
      if (total > this.stored[id]) {
        this.issues.push({
          check: id,
          severity: this.errors[id] ? "error" : "warning",
          message: `…and ${total - this.stored[id]} more ${CHECK_LABELS[id].toLowerCase()} issue(s) not shown. Fix the ones above and upload again.`,
        });
      }
    }
  }
  hasErrors(id?: CheckId) { return id ? this.errors[id] > 0 : Object.values(this.errors).some((n) => n > 0); }
}

// ── Main entry point ────────────────────────────────────────────────────
export function validateRainfallCsv(input: {
  fileName: string;
  bytes: ArrayBuffer | Uint8Array | string;
  regionId: string;
}, options: ValidateOptions = {}): ValidationResult {
  const { fileName, regionId } = input;
  const collectMissing = options.missing === "collect";
  const substituted = new Set(options.substituted ?? []);
  const missingCells: MissingCell[] = [];
  let delimiter: string | null = null;
  const region = REGION_PROVINCES[regionId];
  const regionName = region?.name ?? "Unknown Region";
  const c = new Collector();
  const skipped = new Set<CheckId>();
  let monthLabel: string | null = null;
  let recordsTotal = 0;
  let table: ValidatedTable | null = null;
  const provinceSums: { name: string; sum: number }[] = [];

  const finish = (): ValidationResult => {
    c.finish();
    const errorCount = CHECK_ORDER.reduce((n, id) => n + c.errors[id], 0);
    const warningCount = CHECK_ORDER.reduce((n, id) => n + c.warnings[id], 0);
    const status: ValidationStatus = errorCount ? "rejected" : missingCells.length ? "incomplete" : warningCount ? "warning" : "passed";
    const checks: CheckSummary[] = CHECK_ORDER.map((id) => {
      if (skipped.has(id)) return { id, label: CHECK_LABELS[id], status: "skipped", detail: "Not run — resolve the issues above first." };
      if (id === "cleanliness" && !c.errors[id] && missingCells.length) return { id, label: CHECK_LABELS[id], status: "warning", detail: `${missingCells.length} missing value(s)` };
      if (c.errors[id]) return { id, label: CHECK_LABELS[id], status: "failed", detail: `${c.errors[id]} error(s)` };
      if (c.warnings[id]) return { id, label: CHECK_LABELS[id], status: "warning", detail: `${c.warnings[id]} warning(s)` };
      return { id, label: CHECK_LABELS[id], status: "passed", detail: "Passed" };
    });
    return {
      fileName, regionId, regionName, status, monthLabel,
      recordsTotal,
      recordsPassed: c.errors.file || c.errors.schema ? 0 : Math.max(0, recordsTotal - new Set([...c.errorRows, ...missingCells.map((m) => m.row)]).size),
      errorCount, warningCount,
      issues: c.issues, checks, provinceSums,
      table: status === "passed" || status === "warning" ? table : null,
      missingCells,
      missingCount: missingCells.length,
      otherErrorCount: errorCount - c.missingErrors,
      delimiter,
    };
  };
  const skipFrom = (...ids: CheckId[]) => ids.forEach((id) => skipped.add(id));
  const ALL_AFTER_FILE: CheckId[] = ["schema", "cleanliness", "range", "dates", "sum", "outliers"];

  if (!region) {
    c.add({ check: "schema", severity: "error", message: "Unknown region selected — cannot check the columns." });
    skipFrom("cleanliness", "range", "dates", "sum", "outliers");
    return finish();
  }

  // ── 6a. File type, size & encoding ────────────────────────────────────
  if (!/\.csv$/i.test(fileName)) {
    c.add({ check: "file", severity: "error", message: `"${fileName}" is not a .csv file. Only CSV files are accepted.` });
  }

  let text: string;
  if (typeof input.bytes === "string") {
    text = input.bytes.replace(/^\uFEFF/, "");
  } else {
    const u8 = input.bytes instanceof Uint8Array ? input.bytes : new Uint8Array(input.bytes);
    if (u8.length === 0) {
      c.add({ check: "file", severity: "error", message: "The file is empty." });
      skipFrom(...ALL_AFTER_FILE);
      return finish();
    }
    if (u8.length > LIMITS.maxBytes) {
      c.add({ check: "file", severity: "error", message: `The file is ${round(u8.length / 1048576, 1)} MB; the limit is ${LIMITS.maxBytes / 1048576} MB.` });
      skipFrom(...ALL_AFTER_FILE);
      return finish();
    }
    const utf16 = (u8[0] === 0xff && u8[1] === 0xfe) || (u8[0] === 0xfe && u8[1] === 0xff);
    const hasNul = u8.subarray(0, 4096).includes(0);
    if (utf16 || hasNul) {
      c.add({ check: "file", severity: "error", message: "The file is not UTF-8 (it looks like UTF-16 or a binary file). Re-export it as “CSV UTF-8” and upload again." });
      skipFrom(...ALL_AFTER_FILE);
      return finish();
    }
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(u8).replace(/^\uFEFF/, "");
    } catch {
      c.add({ check: "file", severity: "error", message: "The file is not valid UTF-8 (unreadable characters found). Re-export it as “CSV UTF-8” and upload again." });
      skipFrom(...ALL_AFTER_FILE);
      return finish();
    }
  }
  if (c.hasErrors("file")) { skipFrom(...ALL_AFTER_FILE); return finish(); }

  // ── Split into rows, remembering each row's line number ───────────────
  const rawLines = text.split(/\r\n|\n|\r/);
  const lines: { no: number; text: string }[] = [];
  rawLines.forEach((t, i) => { if (t.trim() !== "") lines.push({ no: i + 1, text: t }); });
  if (lines.length < 2) {
    c.add({ check: "schema", severity: "error", message: "The file needs a header row and at least one data row." });
    skipFrom("cleanliness", "range", "dates", "sum", "outliers");
    return finish();
  }
  const delim = detectDelimiter(lines[0].text);
  delimiter = delim;
  if (!delim) {
    c.add({ check: "schema", severity: "error", message: "Row 1: could not find any columns. Expected: Date plus one column per province, separated by commas." });
    skipFrom("cleanliness", "range", "dates", "sum", "outliers");
    return finish();
  }

  const header = splitCsvLine(lines[0].text, delim).map((h) => h.replace(/^\uFEFF/, "").trim());
  // Ignore trailing completely-empty columns that spreadsheet programs love to add.
  const dataRowsRaw = lines.slice(1).map((l) => ({ no: l.no, cells: splitCsvLine(l.text, delim) }));
  let width = header.length;
  while (width > 1 && header[width - 1] === "" && dataRowsRaw.every((r) => (r.cells[width - 1] ?? "").trim() === "")) width--;
  const head = header.slice(0, width);
  // rows made only of delimiters carry no data
  const dataRows = dataRowsRaw.filter((r) => r.cells.slice(0, width).some((x) => x.trim() !== ""));
  recordsTotal = dataRows.length;

  // ── 1. Schema & header validation ─────────────────────────────────────
  if (head[0].toLowerCase() !== "date") {
    c.add({ check: "schema", severity: "error", row: 1, column: colLabel(head[0], 0), message: `Row 1: the first column must be named "Date" (found "${show(head[0])}").` });
  }
  const provCols: { idx: number; header: string; canon: string }[] = [];
  const seenCanon = new Map<string, number>();
  const foreign: Record<string, string[]> = {}; // other region id → headers belonging to it
  const unknown: string[] = [];
  for (let i = 1; i < head.length; i++) {
    const h = head[i];
    const canon = canonicalProvince(h);
    if (canon == null) { unknown.push(h || "(blank)"); continue; }
    if (!region.provinces.includes(canon)) {
      const owner = regionOfProvince(h) ?? "?";
      (foreign[owner] ??= []).push(h);
      continue;
    }
    if (seenCanon.has(canon)) {
      c.add({ check: "schema", severity: "error", row: 1, column: colLabel(h, i), message: `Row 1: column "${canon}" appears twice (columns ${colLetter(seenCanon.get(canon)!)} and ${colLetter(i)}).` });
      continue;
    }
    seenCanon.set(canon, i);
    provCols.push({ idx: i, header: h, canon });
  }
  const missing = region.provinces.filter((p) => !seenCanon.has(p));

  // Wrong region? (most columns belong to one other region)
  const foreignTop = Object.entries(foreign).sort((a, b) => b[1].length - a[1].length)[0];
  if (foreignTop && foreignTop[0] in REGION_PROVINCES && foreignTop[1].length >= Math.max(1, provCols.length)) {
    const other = REGION_PROVINCES[foreignTop[0]];
    c.add({
      check: "schema", severity: "error", row: 1,
      message: `Wrong region: this file looks like ${other.name} data (columns: ${foreignTop[1].join(", ")}) but you are updating ${regionName}.`,
    });
  } else {
    for (const [rid, hs] of Object.entries(foreign)) {
      const label = REGION_PROVINCES[rid]?.name ?? "another region";
      c.add({ check: "schema", severity: "error", row: 1, message: `Row 1: column(s) ${hs.join(", ")} belong to ${label}, not ${regionName}.` });
    }
  }
  if (unknown.length) {
    c.add({ check: "schema", severity: "error", row: 1, message: `Row 1: unrecognised column(s): ${unknown.map(show).join(", ")}. Expected only: Date, ${region.provinces.join(", ")}.` });
  }
  if (missing.length) {
    c.add({ check: "schema", severity: "error", row: 1, message: `Missing column(s) for ${regionName}: ${missing.join(", ")}.` });
  }
  // every row must have the same number of cells as the header
  for (const r of dataRows) {
    const n = r.cells.length;
    const extraEmpty = n > width && r.cells.slice(width).every((x) => x.trim() === "");
    if (n !== width && !extraEmpty) {
      c.add({ check: "schema", severity: "error", row: r.no, message: `Row ${r.no}: has ${n} column(s) but the header has ${width}.` });
    }
  }

  if (c.hasErrors("schema")) {
    // The file is for the wrong region / wrongly shaped: stop here, per the spec (hard reject).
    skipFrom("cleanliness", "range", "dates", "sum", "outliers");
    return finish();
  }

  // ── 6b. Cleanliness: hidden characters, empty & non-numeric cells ─────
  const grid: (number | null)[][] = provCols.map(() => new Array(dataRows.length).fill(null)); // [province][row]
  dataRows.forEach((r, ri) => {
    const dateCell = r.cells[0] ?? "";
    if (HIDDEN_CHARS.test(dateCell)) {
      c.add({ check: "cleanliness", severity: "error", row: r.no, column: colLabel(head[0], 0), message: `Row ${r.no}, column ${colLabel(head[0], 0)}: hidden or special characters found in the date.` });
    }
    provCols.forEach((pc, pi) => {
      const raw = r.cells[pc.idx] ?? "";
      const where = `Row ${r.no}, column ${colLabel(pc.header, pc.idx)}`;
      if (HIDDEN_CHARS.test(raw)) {
        c.add({ check: "cleanliness", severity: "error", row: r.no, column: colLabel(pc.header, pc.idx), message: `${where}: hidden or special characters found (e.g. non-breaking space).` });
        return;
      }
      const t = raw.trim();
      if (t === "" || MISSING_TOKENS.has(t.toLowerCase())) {
        // Missing value. 1st upload: blocking error. 2nd upload: only recorded (the user decides what to do).
        missingCells.push({ row: r.no, colIndex: pc.idx, column: colLabel(pc.header, pc.idx), province: pc.canon, date: (r.cells[0] ?? "").trim() || null, raw });
        if (!collectMissing) {
          c.add({ check: "cleanliness", severity: "error", missing: true, row: r.no, column: colLabel(pc.header, pc.idx), message: `${where}: ${t === "" ? "empty cell" : `"${show(t)}" (no value)`}. Every day needs a number.` });
        }
        return;
      }
      if (!NUMBER.test(t)) {
        c.add({ check: "cleanliness", severity: "error", row: r.no, column: colLabel(pc.header, pc.idx), message: `${where}: "${show(t)}" is not a number.` });
        return;
      }
      grid[pi][ri] = parseFloat(t.replace("%", ""));
    });
  });

  // ── 2. Domain range: 0 – 100 ──────────────────────────────────────────
  provCols.forEach((pc, pi) => {
    dataRows.forEach((r, ri) => {
      const v = grid[pi][ri];
      if (v == null) return;
      if (v < LIMITS.minPct || v > LIMITS.maxPct) {
        c.add({
          check: "range", severity: "error", row: r.no, column: colLabel(pc.header, pc.idx),
          message: `Invalid value detected in row ${r.no}, column ${colLabel(pc.header, pc.idx)}: ${v}. Values must be between ${LIMITS.minPct} and ${LIMITS.maxPct}.`,
        });
      }
    });
  });

  // ── 4. Temporal continuity & date format ──────────────────────────────
  type D = { ri: number; no: number; y: number; m: number; d: number; n: number };
  const parsed: (D | null)[] = dataRows.map((r, ri) => {
    const p = parseDateStrict(r.cells[0] ?? "");
    if (!p.ok) {
      const raw = (r.cells[0] ?? "").trim();
      c.add({
        check: "dates", severity: "error", row: r.no, column: colLabel(head[0], 0),
        message: p.reason === "calendar"
          ? `Row ${r.no}: "${show(raw)}" is not a real calendar date.`
          : `Row ${r.no}: date "${show(raw)}" is not in DD/MM/YYYY or YYYY-MM-DD format.`,
      });
      return null;
    }
    return { ri, no: r.no, y: p.y, m: p.m, d: p.d, n: dayNum(p.y, p.m, p.d) };
  });
  const valid = parsed.filter((x): x is D => x !== null);
  if (valid.length) {
    // the month the file is about = the month most rows belong to
    const tally = new Map<number, number>();
    valid.forEach((v) => tally.set(v.y * 12 + v.m - 1, (tally.get(v.y * 12 + v.m - 1) ?? 0) + 1));
    const key = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
    const Y = Math.floor(key / 12), M = (key % 12) + 1;
    const dim = daysInMonth(Y, M);
    monthLabel = `${MONTH_NAMES[M - 1]} ${Y}`;

    parsed.forEach((p) => {
      if (p && (p.y !== Y || p.m !== M)) {
        c.add({ check: "dates", severity: "error", row: p.no, column: colLabel(head[0], 0), message: `Row ${p.no}: date ${fmtDMY(p.y, p.m, p.d)} is outside ${monthLabel}, the month this file covers.` });
      }
    });

    // consecutive rows must be consecutive days
    for (let i = 1; i < parsed.length; i++) {
      const a = parsed[i - 1], b = parsed[i];
      if (!a || !b || a.y !== Y || a.m !== M || b.y !== Y || b.m !== M) continue;
      if (b.n === a.n) {
        c.add({ check: "dates", severity: "error", row: b.no, column: colLabel(head[0], 0), message: `Row ${b.no}: duplicate date ${fmtDMY(b.y, b.m, b.d)} (same as row ${a.no}).` });
      } else if (b.n < a.n) {
        c.add({ check: "dates", severity: "error", row: b.no, column: colLabel(head[0], 0), message: `Row ${b.no}: date ${fmtDMY(b.y, b.m, b.d)} is out of order (comes after ${fmtDMY(a.y, a.m, a.d)}).` });
      } else if (b.n > a.n + 1) {
        const from = fmtDayNum(a.n + 1), to = fmtDayNum(b.n - 1);
        c.add({ check: "dates", severity: "error", row: b.no, column: colLabel(head[0], 0), message: `Date sequence break at row ${b.no}: ${fmtDMY(a.y, a.m, a.d)} jumps to ${fmtDMY(b.y, b.m, b.d)} — missing ${from === to ? from : `${from} to ${to}`}.` });
      }
    }
    // the file must start on day 1, end on the last day, and have one row per day
    const inMonth = valid.filter((v) => v.y === Y && v.m === M);
    const first = Math.min(...inMonth.map((v) => v.d)), last = Math.max(...inMonth.map((v) => v.d));
    const days = (a: number, b: number) => (a === b ? `Day ${a} is missing` : `Days ${a}–${b} are missing`);
    if (first !== 1) c.add({ check: "dates", severity: "error", message: `The month starts at ${fmtDMY(Y, M, first)}; expected ${fmtDMY(Y, M, 1)}. ${days(1, first - 1)}.` });
    if (last !== dim) c.add({ check: "dates", severity: "error", message: `The month ends at ${fmtDMY(Y, M, last)}; expected ${fmtDMY(Y, M, dim)}. ${days(last + 1, dim)}.` });
    if (dataRows.length !== dim) c.add({ check: "dates", severity: "error", message: `${monthLabel} has ${dim} days but the file has ${dataRows.length} data row(s).` });
  } else {
    c.add({ check: "dates", severity: "error", message: "No valid dates were found, so the month and day sequence cannot be verified." });
  }

  // Sum & outlier checks only make sense on clean, complete data.
  if (c.hasErrors() || missingCells.length) {
    skipFrom("sum", "outliers");
    return finish();
  }

  // ── 3. Cumulative sum ≈ 100 % ─────────────────────────────────────────
  const values = grid.map((col) => col.map((v) => v as number));
  provCols.forEach((pc, pi) => {
    const sum = values[pi].reduce((a, b) => a + b, 0);
    provinceSums.push({ name: pc.canon, sum: round(sum, 2) });
    if (substituted.has(pc.canon)) return; // system-generated zeros: this province can no longer add up to 100 %, and that is disclosed separately
    if (sum < LIMITS.sumMin || sum > LIMITS.sumMax) {
      c.add({
        check: "sum", severity: "warning", column: colLabel(pc.header, pc.idx),
        message: `Cumulative percentage sum for ${pc.canon} is ${round(sum, 1).toFixed(1)}% (expected ~100%). Please verify preprocessed data with the data engineering team before publishing.`,
      });
    }
  });

  // ── 5. Statistical anomaly / extreme outliers ─────────────────────────
  provCols.forEach((pc, pi) => {
    const v = values[pi];
    const n = v.length;
    const mean = v.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
    const sorted = [...v].sort((a, b) => a - b);
    const med = percentile(sorted, 0.5);
    const mad = percentile([...v.map((x) => Math.abs(x - med))].sort((a, b) => a - b), 0.5);
    const q1 = percentile(sorted, 0.25), q3 = percentile(sorted, 0.75);
    const fence = q3 + 3 * (q3 - q1);
    v.forEach((x, di) => {
      if (x < LIMITS.extremeMinPct) return; // ordinary rainy day, even if "unusual" for this province
      const z = sd > 0 ? (x - mean) / sd : 0;
      const mz = mad > 0 ? (0.6745 * (x - med)) / mad : 0;
      if (z > LIMITS.zThreshold || mz > LIMITS.zThreshold || x > fence) {
        const row = dataRows[di].no;
        const p = parsed[di];
        const when = p ? `${pad2(p.d)} ${MONTH_NAMES[p.m - 1].slice(0, 3)}` : `row ${row}`;
        c.add({
          check: "outliers", severity: "warning", row, column: colLabel(pc.header, pc.idx),
          message: `Extreme value detected on ${when} (${round(x, 2)}%) for ${pc.canon}, row ${row}. Confirm if this represents an extreme weather event or a typing error (e.g. decimal shift).`,
        });
      }
    });
  });

  table = {
    dates: parsed.map((p) => `${(p as D).y}-${pad2((p as D).m)}-${pad2((p as D).d)}`),
    provinces: provCols.map((p) => p.canon),
    values,
  };
  return finish();
}

// ── Server-side double check for chart data that arrives on save ────────
/**
 * Re-checks the chart payload the browser sends on "Next". Returns an error
 * message when the data is not safe to store, or null when it is fine.
 * (A browser can be tampered with, so the server never trusts client validation alone.)
 */
export function validateChartPayload(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v !== "object") return "Chart data is malformed.";
  const c = v as { days?: unknown; series?: unknown };
  if (!Array.isArray(c.days) || !Array.isArray(c.series)) return "Chart data is malformed.";
  if (c.days.length < 2 || c.days.length > 366) return "Chart data has an invalid number of days.";
  for (const s of c.series as Record<string, unknown>[]) {
    const name = String(s?.name ?? "unnamed");
    if (!Array.isArray(s?.pct) || s.pct.length !== c.days.length) return `Chart series "${name}" does not have one value per day.`;
    for (let i = 0; i < s.pct.length; i++) {
      const x = s.pct[i];
      if (typeof x !== "number" || !Number.isFinite(x)) return `Chart series "${name}", day ${i + 1}: value is not a number.`;
      if (x < LIMITS.minPct || x > LIMITS.maxPct) return `Chart series "${name}", day ${i + 1}: ${x} is outside 0–100%.`;
    }
  }
  return null;
}

// ── Audit-log wording (used by the upload page → logAudit) ──────────────
export const AUDIT_ACTIONS = {
  passed: "CSV_VALIDATION_PASSED",
  warning: "CSV_VALIDATION_WARNING",
  rejected: "CSV_VALIDATION_FAILED",
  incomplete: "CSV_MISSING_DATA_DETECTED",
  override: "CSV_VALIDATION_OVERRIDE",
  zeroFill: "CSV_MISSING_REPLACED_WITH_ZERO",
} as const;

/** One audit_log entry for a validation outcome, e.g. { action: "CSV_VALIDATION_FAILED", detail: "Region 1 … - Column mismatch" }. */
export function auditEntryFor(r: ValidationResult, kind: "result" | "override" = "result", updated = false): { action: string; detail: string } {
  const head = `${r.regionName} - ${updated ? "[updated CSV] " : ""}${r.fileName}`;
  let tail: string;
  if (kind === "override") {
    return { action: AUDIT_ACTIONS.override, detail: `${head}: admin confirmed ${r.warningCount} warning(s) and chose to proceed` };
  }
  if (r.status === "rejected") {
    const first = r.issues.find((i) => i.severity === "error")?.message ?? "invalid file";
    tail = r.missingCount
      ? `${r.missingCount} missing value(s) detected${r.otherErrorCount ? ` and ${r.otherErrorCount} other error(s)` : ""}. First: ${first}`
      : `${r.errorCount} error(s). First: ${first}`;
  } else if (r.status === "incomplete") {
    tail = `${r.missingCount} missing value(s) still present in the updated file; waiting for the user's decision`;
  } else if (r.status === "warning") {
    const first = r.issues.find((i) => i.severity === "warning")?.message ?? "needs review";
    tail = `${r.warningCount} warning(s). First: ${first}`;
  } else {
    tail = `${r.recordsPassed}/${r.recordsTotal} records passed${r.monthLabel ? ` (${r.monthLabel})` : ""}`;
  }
  const action = r.status === "rejected" && r.missingCount ? AUDIT_ACTIONS.incomplete : AUDIT_ACTIONS[r.status];
  return { action, detail: `${head}: ${tail}`.slice(0, 490) };
}

/** Audit entry written when the user consents and the system fills missing values with 0 in the processing copy. */
export function auditZeroFillEntry(regionName: string, fileName: string, replaced: number): { action: string; detail: string } {
  return {
    action: AUDIT_ACTIONS.zeroFill,
    detail: `${regionName} - ${fileName}: user consented; ${replaced} missing value(s) replaced with 0 in a processing copy (original file unchanged; values are system-generated, not measurements)`.slice(0, 490),
  };
}
