// ── Two-stage CSV workflow state (one CsvItem = one workflow) ───────────
// Every file picked in the main "Upload CSV" box starts its OWN workflow:
//
//   stage 1  the original file          → validated with missing = "error"
//   stage 2  the "updated" file         → validated with missing = "collect"
//   consent  user ticks the checkbox    → a processing copy is built (missing → 0)
//
// The second-stage state lives inside the SAME item, so it is never confused
// with another file and never counts uploads globally. Removing the item (or
// uploading a different updated file) throws away its consent and cleaning
// results. The original File is never modified.

import type { ValidationResult } from "./csvValidation";
import type { CleaningReport } from "./csvCleaning";

export interface UpdatedCsv {
  file: File;
  text: string | null; // decoded text, filled once the file has been read
  result: ValidationResult | null; // null while still being validated
}

export interface CsvCleaning {
  report: CleaningReport;
  result: ValidationResult; // validation of the processing copy (this is what the graph/AI use)
}

export interface CsvItem {
  id: number;
  file: File; // the ORIGINAL upload (never changed)
  result: ValidationResult | null; // stage-1 validation
  confirmed: boolean; // "Override & Confirm" for warnings on the data that will actually be used
  updated: UpdatedCsv | null; // stage 2
  consent: boolean; // zero-replacement consent (unchecked by default)
  cleaning: CsvCleaning | null; // exists only after consent + "Proceed"
}

/** The data that will really feed the graph and the AI summary. */
export interface EffectiveCsv {
  result: ValidationResult;
  fileName: string;
  text: string | null; // null = read it from `file` (original upload)
  file: File;
  substituted: CleaningReport | null; // set when missing values were replaced with 0
}

export type ItemState =
  | { kind: "pending" } // still being validated
  | { kind: "rejected" } // blocking error that is not "missing values" (wrong columns, bad dates, text in cells …)
  | { kind: "needs-update" } // stage 1 found missing values → upload the updated CSV
  | { kind: "needs-consent" } // stage 2 still incomplete → user must decide
  | { kind: "unconfirmed"; effective: EffectiveCsv } // usable once the warnings are confirmed
  | { kind: "ready"; effective: EffectiveCsv };

export function csvItemState(it: CsvItem): ItemState {
  const r1 = it.result;
  if (!r1) return { kind: "pending" };

  // ── stage 1 only ──
  if (!it.updated) {
    if (r1.status === "rejected") return r1.missingCount > 0 ? { kind: "needs-update" } : { kind: "rejected" };
    // "incomplete" cannot happen in stage 1 (missing cells are errors there)
    const effective: EffectiveCsv = { result: r1, fileName: it.file.name, text: null, file: it.file, substituted: null };
    return r1.status === "warning" && !it.confirmed ? { kind: "unconfirmed", effective } : { kind: "ready", effective };
  }

  // ── stage 2 ──
  const u = it.updated;
  if (!u.result) return { kind: "pending" };
  if (u.result.status === "rejected") return { kind: "rejected" };
  if (u.result.status === "incomplete") {
    if (!it.cleaning) return { kind: "needs-consent" };
    if (it.cleaning.result.status === "rejected" || it.cleaning.result.status === "incomplete") return { kind: "rejected" };
    const effective: EffectiveCsv = {
      result: it.cleaning.result,
      fileName: it.cleaning.report.cleanedFileName,
      text: it.cleaning.report.cleanedText,
      file: u.file,
      substituted: it.cleaning.report,
    };
    return it.cleaning.result.status === "warning" && !it.confirmed ? { kind: "unconfirmed", effective } : { kind: "ready", effective };
  }
  const effective: EffectiveCsv = { result: u.result, fileName: u.file.name, text: u.text, file: u.file, substituted: null };
  return u.result.status === "warning" && !it.confirmed ? { kind: "unconfirmed", effective } : { kind: "ready", effective };
}

/** Short disclosure used in the editor, the AI prompt and the saved report. */
export function substitutionNotice(count: number): string {
  return `${count} missing value${count === 1 ? "" : "s"} in the uploaded CSV ${count === 1 ? "was" : "were"} replaced with 0 by the system for processing. These are system-generated replacements, not actual PAGASA measurements, and the data has not been verified by the responsible department.`;
}
