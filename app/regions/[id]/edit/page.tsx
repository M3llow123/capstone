"use client";

import { useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { saveRegionReport } from "../../../lib/reportStore";
import AuditLogNav from "../../../components/AuditLogNav";
import { chartFromValidatedTable, type RainfallChartData } from "../../../lib/rainfallChart";
import { validateRainfallCsv, auditEntryFor, auditZeroFillEntry } from "../../../lib/csvValidation";
import { logAudit } from "../../../lib/auditStore";
import CsvValidationPanel from "../../../components/CsvValidationPanel";
import { MissingDataError, UpdatedCsvUploader, UpdatedCsvPassed, MissingDataWarning } from "../../../components/CsvMissingData";
import CsvCleaningResults from "../../../components/CsvCleaningResults";
import ZoomableImage from "../../../components/ZoomableImage";
import { csvTextFromBytes, replaceMissingWithZero, buildCleaningReport } from "../../../lib/csvCleaning";
import { csvItemState, substitutionNotice, type CsvItem } from "../../../lib/csvWorkflow";

// ── Region map ─────────────────────────────────────────────────────────
const REGIONS: Record<string, string> = {
  "1":  "Region 1 Ilocos Region",
  "2":  "Region 2 Cagayan Valley",
  "3":  "CAR (Cordillera Administrative Region)",
  "4":  "Region 3 Central Luzon",
  "5":  "Region 4A CALABARZON",
  "6":  "Region 4B MIMAROPA",
  "7":  "Region 5 Bicol Region",
  "8":  "Region 6 Western Visayas",
  "9":  "Region 7 Central Visayas",
  "10": "Region 8 Eastern Visayas",
  "11": "Region 9 Zamboanga Peninsula",
  "12": "Region 10 Northern Mindanao",
  "13": "Region 11 Davao Region",
  "14": "Region 12 SOCCSKSARGEN",
  "15": "Region 13 CARAGA",
  "16": "BARMM (Bangsamoro Autonomous Region in Muslim Mindanao)",
};

// ── System Prompt ──────────────────────────────────────────────────────
const buildSystemPrompt = (regionName: string) => `
You are an AI Climate Interpretation Assistant for the DOST-PAGASA Agri-Weather System.

Your task is to produce concise regional agricultural climate summaries based on uploaded climate and crop condition maps.

The output must closely follow the general writing style of PAGASA regional agricultural weather summaries: formal, factual, observational, concise, and focused on regional weather conditions and their implications for agriculture.

## MAIN OBJECTIVE

Interpret all uploaded maps together as ONE regional agricultural assessment.

Identify the dominant rainfall and moisture conditions across the region, explain meaningful variations in affected areas, and describe the observed or potential implications for vegetation, rice, and corn.

The summary must present a coherent regional assessment, not a separate description of each map.

## MAPS THAT MAY BE PROVIDED

- Vegetation condition maps
- Soil moisture and crop water condition maps
- Rainfall maps
- Extreme rainfall maps, including RX1day and RX5day
- SPEI-3 maps
- Rice and corn growth stage maps

Use only the information supported by the supplied maps and accompanying metadata.

## INTERPRETATION AND WRITING RULES

**1. Lead with the dominant regional condition.**

Begin by describing the most significant rainfall condition during the reporting period, such as excessive rainfall, generally light rainfall, uneven rainfall distribution, or prolonged dry conditions, as supported by the maps.

Do not automatically describe rainfall as minimal or moderate. Identify the actual prevailing condition first.

**2. Explain the agricultural implications.**

Connect the observed rainfall and moisture conditions to relevant agricultural effects, such as limited crop water availability, favorable moisture conditions, localized waterlogging, or possible crop stress.

Mention potential effects on crop development or yield only when the available evidence supports them. Do not present possible impacts as confirmed damage.

**3. Identify meaningful regional differences.**

Mention affected provinces or portions of the region when the maps show notable differences in rainfall, moisture, extreme rainfall, or vegetation conditions.

Prioritize the most important affected areas instead of listing every province or describing minor variations.

**4. Interpret all maps collectively.**

Use rainfall, moisture, vegetation, extreme rainfall, and crop growth stage information to form one consistent assessment.

Do not describe each map independently or repeatedly explain the same condition using different indicators.

When the maps indicate contrasting conditions, acknowledge the variation rather than forcing a single conclusion for the entire region.

**5. Interpret extreme rainfall and moisture indicators appropriately.**

When supported by the supplied maps, describe significant rainfall events, wetter-than-normal or drier-than-normal conditions, and their possible agricultural implications.

Use SPEI-3 to characterize moisture conditions over the relevant three-month period. Use RX1day and RX5day to identify notable one-day and five-day rainfall extremes when their values or classifications are available.

Do not invent rainfall amounts, historical comparisons, extreme events, or causal relationships.

**6. Relate conditions to rice and corn growth stages.**

Use crop growth stage maps and crop water condition maps to determine which crops and stages may be affected.

For rice and corn, describe relevant conditions such as adequate moisture, limited water availability, possible waterlogging, or localized crop stress only when supported by the evidence.

Do not assume that all crops across the region experience the same conditions.

**7. Include weather systems only when supported.**

Mention tropical cyclones, the southwest or northeast monsoon, or other weather systems only when their influence is established by the supplied information or verified reporting-period metadata.

Do not invent storm names, attribute rainfall to an unverified cause, or include weather systems merely to imitate an official bulletin.

**8. Handle missing or conflicting information carefully.**

Do not claim that vegetation conditions are favorable or unfavorable when vegetation data are unavailable.

Do not infer crop damage solely from rainfall totals. Distinguish between observed conditions and possible agricultural effects.

When one map is unavailable, continue using the remaining relevant maps without drawing unsupported conclusions.

## PAGASA-STYLE LANGUAGE

Use formal, straightforward sentences similar to routine regional agri-weather reports.

Prefer expressions such as:
- “The region received generally light to moderate rainfall during the period.”
- “Rainfall was heavier over portions of the western section of the region.”
- “The SPEI-3 indicated wetter-than-normal conditions over some areas.”
- “Extreme rainfall indices indicated significant rainfall events in affected portions of the region.”
- “These conditions may affect rice and corn development, particularly in areas with limited water availability.”
- “Vegetation conditions remained generally fair across most areas.”
- “Moisture conditions varied across the region.”

These are examples only. Select wording according to the actual evidence.

Avoid repetitive filler, conversational expressions, dramatic descriptions, excessive qualifiers, and generic statements that could apply to any region.

Do not use technical terminology unless it contributes meaningfully to the assessment. When an index is mentioned, explain its regional significance through simple observational language rather than explaining the underlying science.

## STRICT OUTPUT FORMAT

[REGION NAME IN UPPERCASE]

REGIONAL SUMMARY:

Write exactly TWO paragraphs.

Target length: 100–120 words for the two paragraphs combined, excluding the region name and heading.

Paragraph 1: Describe the dominant rainfall situation, relevant moisture conditions, and significant differences across the region. Include extreme rainfall or relevant weather systems only when supported by the available evidence.

Paragraph 2: Describe the implications for vegetation, agricultural water availability, and rice and corn conditions. Refer to crop growth stages where available and distinguish between observed conditions and potential impacts.

The two paragraphs must read as one coherent regional assessment. Do not repeat the same information in both paragraphs.

## STRICT RESTRICTIONS

Do not include bullet points, numbered lists, additional headings, recommendations, forecasts, or commentary outside the requested summary.

Do not invent measurements, affected provinces, crop growth stages, weather systems, historical comparisons, or agricultural impacts.

Do not force the use of particular phrases or mention every available indicator.

Do not produce identical wording for different regions when their mapped conditions differ.

Before responding, verify that the summary follows the required format, remains within the word limit, accurately reflects the supplied maps, and contains no unsupported claims.

Return only the final regional summary.
`.trim();

// ── Helpers ────────────────────────────────────────────────────────────
const toBase64 = (file: File): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res((r.result as string).split(",")[1]);
    r.onerror = () => rej(new Error("Read failed"));
    r.readAsDataURL(file);
  });

const toBase64File = (file: File): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string); // full data URL, incl. "data:image/...;base64,"
    r.onerror = () => rej(new Error("Read failed"));
    r.readAsDataURL(file);
  });

const readAsText = (file: File): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error("Read failed"));
    r.readAsText(file);
  });

// ── Component ──────────────────────────────────────────────────────────
export default function RegionsEditPage() {
  const params = useParams();
  const router = useRouter();
  const regionId = params?.id as string;
  const regionName = REGIONS[regionId] ?? "Unknown Region";

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  // Every uploaded CSV is validated (see lib/csvValidation.ts) before it can be used.
  // One CsvItem = one two-stage workflow (original → updated → optional zero-fill); see lib/csvWorkflow.ts.
  const [csvItems, setCsvItems] = useState<CsvItem[]>([]);
  const csvIdRef = useRef(0);
  const [summary, setSummary] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [impactOpen, setImpactOpen] = useState(true);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);

  // The CSV gate: anything that is not "ready" (still checking, rejected, missing values awaiting an
  // updated file or consent, unconfirmed warnings) blocks Generate / Next.
  const csvStates = csvItems.map(csvItemState);
  const has = (k: string) => csvStates.some(st => st.kind === k);
  const csvBlocked = csvStates.some(st => st.kind !== "ready");
  const csvBlockReason = has("pending")
    ? "Please wait — the CSV is still being validated."
    : has("rejected")
      ? "A CSV file failed validation. Remove it and upload a corrected file before continuing."
      : has("needs-update")
        ? "Missing values were detected. Upload the updated CSV file from the responsible department (or remove the file) before continuing."
        : has("needs-consent")
          ? "The updated CSV still has missing values. Agree to the replacement and press “Proceed with Missing Values Set to 0”, or upload another updated CSV."
          : "Review the CSV warnings and tick “Override & Confirm” (or remove the file) before continuing.";
  // Data that was filled with system-generated zeros (to be disclosed everywhere it is used).
  const substitutedReports = csvItems.flatMap(i => (i.cleaning ? [i.cleaning.report] : []));

  const imageRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  const handleImage = useCallback((files: FileList | null) => {
    if (!files) return;
    const valid = Array.from(files).filter(f => f.type.startsWith("image/"));
    setImageFiles(prev => [...prev, ...valid]);
    setImagePreviews(prev => [...prev, ...valid.map(f => URL.createObjectURL(f))]);
    setSaved(false);
    // reset input so same file can be re-added
    if (imageRef.current) imageRef.current.value = "";
  }, []);

  const removeImage = (i: number) => {
    setImageFiles(prev => prev.filter((_, j) => j !== i));
    setImagePreviews(prev => prev.filter((_, j) => j !== i));
  };

  const handleCsv = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const picked = Array.from(files);
    if (csvRef.current) csvRef.current.value = "";
    setSaved(false);
    const fresh: CsvItem[] = picked.map(file => ({ id: ++csvIdRef.current, file, result: null, confirmed: false, updated: null, consent: false, cleaning: null }));
    setCsvItems(prev => [...prev, ...fresh]);

    for (const it of fresh) {
      try {
        const result = validateRainfallCsv({ fileName: it.file.name, bytes: await it.file.arrayBuffer(), regionId });
        setCsvItems(prev => prev.map(x => (x.id === it.id ? { ...x, result } : x)));
        const entry = auditEntryFor(result);
        void logAudit(entry.action, entry.detail); // every outcome goes to the audit log
      } catch {
        setCsvItems(prev => prev.filter(x => x.id !== it.id));
        setError(`Could not read "${it.file.name}". Please try uploading it again.`);
      }
    }
  }, [regionId]);

  const removeCsv = (i: number) => {
    setCsvItems(prev => prev.filter((_, j) => j !== i));
  };

  const confirmCsv = (id: number, confirmed: boolean) => {
    setCsvItems(prev => prev.map(x => (x.id === id ? { ...x, confirmed } : x)));
    const item = csvItems.find(x => x.id === id);
    const st = item ? csvItemState(item) : null;
    if (confirmed && st && "effective" in st) {
      const entry = auditEntryFor(st.effective.result, "override");
      void logAudit(entry.action, entry.detail);
    }
  };

  // ── Stage 2: the "Upload Updated CSV File" box ──
  // Belongs to ONE workflow (item). A new updated file always starts that item's stage 2 from scratch:
  // earlier consent, cleaning results and confirmations are discarded.
  const handleUpdatedCsv = useCallback(async (id: number, file: File) => {
    setSaved(false);
    setError(null);
    setCsvItems(prev => prev.map(x => (x.id === id ? { ...x, updated: { file, text: null, result: null }, consent: false, cleaning: null, confirmed: false } : x)));
    try {
      const buf = await file.arrayBuffer();
      const result = validateRainfallCsv({ fileName: file.name, bytes: buf, regionId }, { missing: "collect" });
      const text = result.status === "rejected" ? null : csvTextFromBytes(buf);
      setCsvItems(prev => prev.map(x => (x.id === id && x.updated?.file === file ? { ...x, updated: { file, text, result } } : x)));
      const entry = auditEntryFor(result, "result", true);
      void logAudit(entry.action, entry.detail);
    } catch {
      setCsvItems(prev => prev.map(x => (x.id === id && x.updated?.file === file ? { ...x, updated: null } : x)));
      setError(`Could not read "${file.name}". Please try uploading it again.`);
    }
  }, [regionId]);

  const removeUpdatedCsv = (id: number) => {
    setSaved(false);
    setCsvItems(prev => prev.map(x => (x.id === id ? { ...x, updated: null, consent: false, cleaning: null, confirmed: false } : x)));
  };

  const setConsent = (id: number, consent: boolean) => {
    setCsvItems(prev => prev.map(x => (x.id === id ? { ...x, consent } : x)));
  };

  // Builds the SEPARATE processing copy (missing → 0). Only runs with the box ticked; the uploaded files are never touched.
  const proceedWithZeros = (id: number) => {
    const it = csvItems.find(x => x.id === id);
    const u = it?.updated;
    if (!it || !it.consent || !u?.result || u.result.status !== "incomplete" || u.text == null || !u.result.delimiter) return;
    const cells = u.result.missingCells;
    const { text: cleanedText } = replaceMissingWithZero(u.text, cells, u.result.delimiter);
    const cleanedName = u.file.name.replace(/\.csv$/i, "") + "_cleaned.csv";
    const provinces = [...new Set(cells.map(c => c.province))];
    // Re-validate the processing copy: it is what the graph and the AI summary will use.
    const result = validateRainfallCsv({ fileName: cleanedName, bytes: cleanedText, regionId }, { missing: "collect", substituted: provinces });
    const report = buildCleaningReport({ sourceFileName: u.file.name, originalText: u.text, cleanedText, cells, delimiter: u.result.delimiter, remaining: result.missingCount });
    setSaved(false);
    setCsvItems(prev => prev.map(x => (x.id === id ? { ...x, cleaning: { report, result }, confirmed: false } : x)));
    const entry = auditZeroFillEntry(regionName, u.file.name, report.summary.replaced);
    void logAudit(entry.action, entry.detail);
  };

  const discardCleaning = (id: number) => {
    setSaved(false);
    setCsvItems(prev => prev.map(x => (x.id === id ? { ...x, consent: false, cleaning: null, confirmed: false } : x)));
  };

  const handleGenerate = async () => {
    if (!imageFiles.length) { setError("Please upload at least one climate map image."); return; }
    if (csvBlocked) { setError(csvBlockReason); return; }
    setError(null);
    setGenerating(true);
    try {
      // Build image blocks for all uploaded images
      const imageBlocks = await Promise.all(
        imageFiles.map(async (f) => ({
          type: "image",
          source: { type: "base64", media_type: f.type, data: await toBase64(f) },
        }))
      );

      // Combine all CSV texts — always the data that passed validation: the original upload, the updated
      // upload, or the processing copy (missing → 0) when the user agreed to that.
      const effective = csvStates.flatMap(st => ("effective" in st ? [st.effective] : []));
      const csvTexts = await Promise.all(effective.map(e => e.text ?? readAsText(e.file)));
      let combinedCsv = effective.length
        ? csvTexts.map((t, i) => `--- ${effective[i].fileName}${effective[i].substituted ? " (processing copy: missing values replaced with 0 by the system)" : ""} ---\n${t}`).join("\n\n")
        : null;
      if (combinedCsv && substitutedReports.length) {
        const cells = substitutedReports.flatMap(r => r.log.map(e => `row ${e.row}, ${e.column}`));
        combinedCsv += `\n\nDATA QUALITY NOTE: ${substitutionNotice(cells.length)} The replaced cells are: ${cells.slice(0, 40).join("; ")}${cells.length > 40 ? `; … and ${cells.length - 40} more` : ""}. Treat these zeros as unknown values, not as measured dry days, and do not draw conclusions from them.`;
      }

      const userContent: any[] = [
        ...imageBlocks,
        {
          type: "text",
          text: combinedCsv
            ? `Please analyze the ${imageFiles.length} uploaded climate map image(s) and the following CSV crop/weather data for ${regionName}, then generate the regional agri-weather summary.\n\nCSV DATA:\n${combinedCsv}`
            : `Please analyze the ${imageFiles.length} uploaded climate map image(s) for ${regionName} and generate the regional agri-weather summary.`,
        },
      ];

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: buildSystemPrompt(regionName),
          messages: [{ role: "user", content: userContent }],
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error.message ?? "API error");
      const text = data.content?.find((b: any) => b.type === "text")?.text ?? "";
      setSummary(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setGenerating(false);
    }
  };

  // Daily rainfall graph: built from the first validated CSV, using the values exactly as uploaded.
  const buildChart = (): RainfallChartData | null => {
    for (const st of csvStates) {
      if (!("effective" in st) || !st.effective.result.table) continue;
      const chart = chartFromValidatedTable(st.effective.result.table);
      const rep = st.effective.substituted;
      if (rep) {
        // Saved with the graph so the public report can disclose the substituted values.
        chart.substituted = {
          count: rep.summary.replaced,
          sourceFile: rep.sourceFileName,
          cells: rep.log.map(e => ({ province: e.column.replace(/\s*\([A-Z]+\)$/, ""), date: e.date, row: e.row })),
          note: substitutionNotice(rep.summary.replaced),
        };
      }
      return chart;
    }
    return null;
  };

  const handleNext = async () => {
    if (csvBlocked) { setError(csvBlockReason); return; } // never save while a CSV is rejected / unconfirmed
    setError(null);
    setSaved(true);

    // Persist to the shared store so the public report page can surface it.
    try {
      const imageDataUrls = await Promise.all(imageFiles.map(toBase64File));
      const chart = buildChart();
      const { chartSaved } = await saveRegionReport({
        id: regionId,
        name: regionName,
        summary,
        images: imageDataUrls,
        chart,
        month: new Date().toLocaleString("default", { month: "long", year: "numeric" }),
      });
      if (chart && !chartSaved) {
        window.alert(
          "The graph was read from your CSV, but the server did not store it, so the public report would show no graph.\n\n" +
          "Deploy the latest app/api/content/route.ts and run 001_add_chart_column.sql in Supabase, then save again."
        );
      }
    } catch (err) {
      // Still proceed to review, but tell the admin the save failed instead of failing silently.
      console.error(err);
      window.alert(`Saving the report failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }

    const params = new URLSearchParams({ summary, region: regionName });
    setTimeout(() => router.push(`/regions/${regionId}/review?${params.toString()}`), 300);
  };

  const impactChildren = ["Corn Crop Stage and Water Sufficiency", "Rice Crop Stage and Water Sufficiency", "Monthly Rainfall", "Tropical Cyclone", "Crop Condition and Drought Indicator", "Regions", "Cover Page", "About this Report", "Preface", "Overview"];

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

        .side-link { display:block; padding:8px 16px 8px 28px; font-size:13px; color:#555; cursor:pointer; text-decoration:none; transition:background .12s,color .12s; border-left:3px solid transparent; border-right: none; background: transparent; width: 100%; text-align: left; font-family: inherit; }
        .side-link:hover { background:#e8edf2; color:#003087; }
        .side-link.active { background:#dce8f5; color:#003087; border-left:3px solid #003087; font-weight:600; }
        .side-parent { display:flex; align-items:center; justify-content:space-between; padding:9px 14px; font-size:13px; font-weight:600; color:#444; cursor:pointer; transition:background .12s; user-select:none; }
        .side-parent:hover { background:#e8edf2; }

        input[type=file]::file-selector-button {
          background: #e5e7eb; border: 1px solid #d1d5db; border-radius: 4px;
          padding: 3px 10px; cursor: pointer; font-size: 13px; color: #374151; margin-right: 8px;
        }
        .btn-generate:hover:not(:disabled) { background: #1d4ed8 !important; }
        .btn-next:hover:not(:disabled) { background: #1d4ed8 !important; }
        .btn-back:hover { background: #e5e7eb !important; }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-thumb { background:#ccc; border-radius:3px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none} }
      `}</style>

      {/* ── Sidebar ── */}
      <div style={{
        width: 200, background: "#fff", borderRight: "1px solid #dde3ea",
        display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto",
      }}>
        {/* Logo */}
        <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #eee" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#003087", letterSpacing: ".02em" }}>PAGASA</div>
          <div style={{ fontSize: 10, color: "#888", marginTop: 1 }}>Website Content Management System</div>
          <span style={{ display: "inline-block", marginTop: 4, fontSize: 10, padding: "1px 7px", borderRadius: 3, background: "#d32f2f", color: "#fff", fontWeight: 600 }}>Production</span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, paddingTop: 6 }}>
          {/* Maintenance */}
          <div className="side-parent" onClick={() => setMaintenanceOpen(p => !p)}>
            <span>Maintenance</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5"
              style={{ transform: maintenanceOpen ? "rotate(90deg)" : "none", transition: "transform .2s" }}>
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          {maintenanceOpen && ["Dashboard", "Users", "Settings"].map(label => (
            <button key={label} className="side-link" onClick={() => {}}>{label}</button>
          ))}

          {/* Impact Assessment */}
          <div className="side-parent" onClick={() => setImpactOpen(p => !p)} style={{ marginTop: 2 }}>
            <span>Impact Assessment</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5"
              style={{ transform: impactOpen ? "rotate(90deg)" : "none", transition: "transform .2s" }}>
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          {impactOpen && impactChildren.map(label => (
            <button
              key={label}
              className={`side-link${label === "Regions" ? " active" : ""}`}
              onClick={() => router.push("/")}
            >{label}</button>
          ))}

          {/* AI Tools */}
          <AuditLogNav />
          <div style={{ marginTop: 8, borderTop: "1px solid #eee", paddingTop: 8 }}>
            <div style={{ padding: "4px 14px 6px", fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: ".06em" }}>AI Tools</div>
            <button
              className="side-link"
              style={{ paddingLeft: 16, display: "flex", alignItems: "center", gap: 8 }}
              onClick={() => router.push("/chat")}
            >
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4caf50", flexShrink: 0 }} />
              PAGASA AI
            </button>
          </div>
        </nav>

        {/* User footer */}
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
          <div style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>Region</div>

          {/* ── Upload Card ── */}
          <div style={{ background: "#fff", borderRadius: 6, border: "1px solid #dde3ea", overflow: "hidden", marginBottom: 16 }}>
            {/* Card header */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: "#222" }}>Update</span>
              <button
                className="btn-next"
                onClick={handleNext}
                disabled={!summary || csvBlocked}
                title={csvBlocked ? csvBlockReason : undefined}
                style={{
                  background: saved ? "#16a34a" : "#003087",
                  color: "#fff", border: "none", borderRadius: 4,
                  padding: "6px 18px", fontSize: 13, fontWeight: 600,
                  cursor: summary && !csvBlocked ? "pointer" : "not-allowed",
                  opacity: summary && !csvBlocked ? 1 : 0.4, transition: "background .15s",
                }}>
                {saved ? "✓ Saved" : "Next"}
              </button>
            </div>

            <div style={{ padding: "18px 16px" }}>
              <p style={{ color: "#d32f2f", fontSize: 12, margin: "0 0 14px" }}>* Required Field</p>

              {/* Region field */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: 500, fontSize: 13, marginBottom: 5, color: "#374151" }}>
                  <span style={{ color: "#d32f2f" }}>* </span>Region
                </label>
                <input type="text" value={regionName} readOnly
                  style={{ width: "100%", maxWidth: 380, padding: "7px 10px", border: "1px solid #dde3ea", borderRadius: 4, background: "#f9fafb", color: "#374151", fontSize: 13 }} />
              </div>

              {/* Upload row */}
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {/* Image upload */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={{ display: "block", fontWeight: 500, fontSize: 13, marginBottom: 5, color: "#374151" }}>
                    <span style={{ color: "#d32f2f" }}>* </span>Upload Image
                    <span style={{ fontSize: 11, color: "#888", fontWeight: 400, marginLeft: 6 }}>(multiple allowed · click a preview to enlarge)</span>
                  </label>
                  <input ref={imageRef} type="file" accept="image/*" multiple
                    onChange={e => handleImage(e.target.files)}
                    style={{ width: "100%", border: "1px solid #dde3ea", borderRadius: 4, padding: "5px 8px", background: "#fff", fontSize: 13 }} />
                  {imagePreviews.length > 0 && (
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                      {imagePreviews.map((src, i) => (
                        <div key={i} style={{ position: "relative", animation: "fadeIn .2s ease" }}>
                          {/* Click the preview to open the full image in a pop-up (Esc, X or the dark area closes it) */}
                          <ZoomableImage src={src} alt={imageFiles[i]?.name ?? `preview-${i}`}
                            style={{ width: "100%", maxHeight: 120, objectFit: "cover", borderRadius: 5, border: "1px solid #dde3ea", display: "block" }} />
                          <div style={{ marginTop: 3, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 11, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>{imageFiles[i]?.name}</span>
                            <button onClick={() => removeImage(i)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#d32f2f", fontSize: 12, padding: "0 2px", fontWeight: 600 }}>✕ Remove</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* CSV upload */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={{ display: "block", fontWeight: 500, fontSize: 13, marginBottom: 5, color: "#374151" }}>
                    <span style={{ color: "#d32f2f" }}>* </span>Upload CSV
                    <span style={{ fontSize: 11, color: "#888", fontWeight: 400, marginLeft: 6 }}>(multiple allowed)</span>
                  </label>
                  <input ref={csvRef} type="file" accept=".csv,text/csv" multiple
                    onChange={e => handleCsv(e.target.files)}
                    style={{ width: "100%", border: "1px solid #dde3ea", borderRadius: 4, padding: "5px 8px", background: "#fff", fontSize: 13 }} />
                  <div style={{ fontSize: 11, color: "#888", marginTop: 5, lineHeight: 1.45 }}>
                    Expected: <b>Date</b> plus one column per province of this region, one row per day for a full month
                    (values = % of the month&apos;s rainfall total). Files are checked automatically.
                  </div>
                  {csvItems.length > 0 && (
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                      {csvItems.map((it, i) => {
                        const st = it.result?.status;
                        const u = it.updated;
                        const stage1Missing = st === "rejected" && it.result!.missingCount > 0;
                        const ks = csvStates[i]?.kind;
                        const tone = ks === "rejected" || ks === "needs-update" ? { bg: "#fef2f2", bd: "#fecaca", fg: "#b91c1c" }
                          : ks === "needs-consent" || ks === "unconfirmed" ? { bg: "#fffbeb", bd: "#fde68a", fg: "#b45309" }
                          : { bg: "#f0fdf4", bd: "#bbf7d0", fg: "#15803d" };
                        return (
                          <div key={it.id} style={{ display: "flex", flexDirection: "column", gap: 5, animation: "fadeIn .2s ease" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", background: tone.bg, border: `1px solid ${tone.bd}`, borderRadius: 5 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={tone.fg} strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                <span style={{ fontSize: 12, color: tone.fg, fontWeight: 500, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.file.name}</span>
                              </div>
                              <button onClick={() => removeCsv(i)}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#d32f2f", fontSize: 12, padding: "0 2px", fontWeight: 600 }}>✕</button>
                            </div>
                            {it.result ? (
                              <>
                                {/* Stage 1 — original upload. Missing values: RED error, then the updated-CSV uploader directly below it. */}
                                {(!stage1Missing || it.result.otherErrorCount > 0) && (
                                  <CsvValidationPanel result={it.result} confirmed={it.confirmed} onConfirmChange={v => confirmCsv(it.id, v)} />
                                )}
                                {stage1Missing && <MissingDataError cells={it.result.missingCells} />}
                                {stage1Missing && (
                                  <UpdatedCsvUploader
                                    current={u ? { name: u.file.name } : null}
                                    onPick={f => handleUpdatedCsv(it.id, f)}
                                    onRemove={() => removeUpdatedCsv(it.id)}
                                  />
                                )}

                                {/* Stage 2 — re-validation of the updated file (same workflow, same item). */}
                                {u && (!u.result
                                  ? <div style={{ fontSize: 11.5, color: "#6b7280" }}>Validating updated file…</div>
                                  : u.result.status === "passed"
                                    ? <UpdatedCsvPassed fileName={u.file.name} />
                                    : u.result.status === "incomplete"
                                      ? (it.cleaning
                                        ? <>
                                            <div role="status" style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 5, padding: "8px 11px", fontSize: 12, lineHeight: 1.5, color: "#78350f" }}>
                                              <b style={{ color: "#b45309" }}>{u.file.name}</b> still had {u.result.missingCount} missing value{u.result.missingCount === 1 ? "" : "s"}. With your consent they were set to 0 in a separate processing copy — see “CSV Data Cleaning Results” below.
                                            </div>
                                            {it.cleaning.result.status !== "passed" && (
                                              <CsvValidationPanel result={it.cleaning.result} confirmed={it.confirmed} onConfirmChange={v => confirmCsv(it.id, v)} />
                                            )}
                                          </>
                                        : <MissingDataWarning
                                            fileName={u.file.name}
                                            cells={u.result.missingCells}
                                            consent={it.consent}
                                            onConsent={v => setConsent(it.id, v)}
                                            onProceed={() => proceedWithZeros(it.id)}
                                          />)
                                      : <CsvValidationPanel result={u.result} confirmed={it.confirmed} onConfirmChange={v => confirmCsv(it.id, v)} />
                                )}
                              </>
                            ) : <div style={{ fontSize: 11.5, color: "#6b7280" }}>Validating…</div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* ── CSV Data Cleaning Results (only after the user consented and pressed Proceed) ── */}
              {csvItems.map(it => it.cleaning && (
                <CsvCleaningResults key={it.id} report={it.cleaning.report} onDiscard={() => discardCleaning(it.id)} />
              ))}
            </div>
          </div>

          {/* ── Generate / Editor Card ── */}
          <div style={{ background: "#fff", borderRadius: 6, border: "1px solid #dde3ea", overflow: "hidden" }}>
            {/* Toolbar */}
            <div style={{ padding: "8px 12px", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fafbfc" }}>
              <div style={{ display: "flex", gap: 5 }}>
                {["Source", "B", "I", "U", "≡", "≡", "≡"].map((t, i) => (
                  <button key={i} style={{ background: "none", border: "1px solid #dde3ea", borderRadius: 3, padding: "2px 6px", fontSize: 12, cursor: "pointer", color: "#374151", fontWeight: t === "B" ? 700 : 400, fontStyle: t === "I" ? "italic" : "normal", textDecoration: t === "U" ? "underline" : "none" }}>{t}</button>
                ))}
              </div>
              <button
                className="btn-generate"
                onClick={handleGenerate}
                disabled={generating || !imageFiles.length || csvBlocked}
                title={csvBlocked ? csvBlockReason : undefined}
                style={{
                  background: "#003087", color: "#fff", border: "none", borderRadius: 4,
                  padding: "6px 16px", fontSize: 13, fontWeight: 600,
                  cursor: imageFiles.length && !csvBlocked ? "pointer" : "not-allowed",
                  opacity: imageFiles.length && !csvBlocked ? 1 : 0.4,
                  display: "flex", alignItems: "center", gap: 7, transition: "background .15s",
                }}>
                {generating
                  ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}><circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="8" strokeLinecap="round"/></svg>Generating…</>
                  : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>Generate</>
                }
              </button>
            </div>

            {/* Editor */}
            <div style={{ padding: "12px" }}>
              {error && (
                <div style={{ background: "rgba(211,47,47,.07)", border: "1px solid rgba(211,47,47,.2)", borderRadius: 5, padding: "9px 12px", fontSize: 13, color: "#d32f2f", marginBottom: 10 }}>
                  ⚠ {error}
                </div>
              )}
              {substitutedReports.length > 0 && (
                <div role="note" style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 5, padding: "8px 12px", fontSize: 12.5, color: "#78350f", marginBottom: 10, lineHeight: 1.5 }}>
                  <b style={{ color: "#b45309" }}>Data note:</b> {substitutionNotice(substitutedReports.reduce((n, r) => n + r.summary.replaced, 0))} The graph and this summary use the processed copy, and the public report will carry the same disclosure under the graph.
                </div>
              )}
              <textarea
                value={summary}
                onChange={e => setSummary(e.target.value)}
                placeholder={generating ? "Generating regional summary…" : "Upload an image (and optionally a CSV), then click Generate to create the regional summary."}
                rows={10}
                style={{
                  width: "100%", border: "1px solid #dde3ea", borderRadius: 5,
                  padding: "10px 12px", fontSize: 13, lineHeight: 1.75, color: "#1f2937",
                  background: generating ? "#f9fafb" : "#fff",
                  resize: "vertical", fontFamily: "inherit",
                  transition: "background .2s",
                  animation: summary ? "fadeIn .3s ease" : "none",
                  outline: "none",
                }}
              />
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: "#aaa" }}>
                  {summary ? `${summary.split(/\s+/).filter(Boolean).length} words` : "No content yet"}
                </span>
                <span style={{ fontSize: 11, color: "#aaa", fontStyle: "italic" }}>
                  Powered by PAGASA Climate Model v2.4 · AI can make mistakes. Verify important data.
                </span>
              </div>
            </div>
          </div>

          {/* Back button */}
          <div style={{ marginTop: 14 }}>
            <button
              className="btn-back"
              onClick={() => router.push("/")}
              style={{ background: "#fff", border: "1px solid #dde3ea", color: "#374151", borderRadius: 4, padding: "6px 14px", fontSize: 13, cursor: "pointer", transition: "background .15s" }}>
              ← Back to Regions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}