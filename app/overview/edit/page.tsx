"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { saveOverview, getOverview } from "../../lib/reportStore";
import AuditLogNav from "../../components/AuditLogNav";
import UserMenu from "@/app/components/UserMenu";
import ZoomableImage from "@/app/components/ZoomableImage";

// ── System Prompt ──────────────────────────────────────────────────────
const OVERVIEW_SYSTEM_PROMPT = `
You are an AI Climate Interpretation Assistant for the DOST-PAGASA Agri-Weather System.

Your task is to produce the concise nationwide Overview of the monthly agricultural impact assessment, based on the uploaded national climate and crop condition maps.

The output must closely follow the general writing style of PAGASA agricultural weather summaries: formal, factual, observational, concise, and focused on weather conditions and their implications for agriculture.

## MAIN OBJECTIVE

Interpret all uploaded maps together as ONE nationwide agricultural assessment.

Identify the dominant rainfall and moisture conditions across the country, point out the regions or island groups (Luzon, Visayas, Mindanao) where conditions differ meaningfully, and describe the observed or potential implications for vegetation, rice, and corn.

The Overview must present a coherent national picture, not a separate description of each map and not a region-by-region list.

## MAPS THAT ARE PROVIDED

- Monthly accumulated rainfall map (mm)
- Tropical cyclone tracks and cumulative rainfall, with the cyclones within the Philippine Area of Responsibility listed on the map
- NDVI vegetation map (it may show a note that the data is not yet available)
- 1-month SPEI map and 3-month SPEI map (negative values are drier than normal, positive values are wetter than normal)
- Rice crop stage and water sufficiency maps
- Corn crop stage and water sufficiency maps

Use only the information supported by the supplied maps. Read the map titles and legends to confirm the reporting month, the cyclone names and dates, the crop stage categories, and the water sufficiency categories (Excess, Sufficient, Inadequate).

## INTERPRETATION AND WRITING RULES

**1. Lead with the dominant national condition.**

Begin with the most significant rainfall condition across the country during the reporting period, such as widespread heavy rainfall, generally light rainfall, uneven rainfall distribution, or prolonged dry conditions, as supported by the maps. Do not automatically describe rainfall as minimal or moderate.

**2. Show geographic contrast at the right level.**

Mention island groups or regions only when the maps show notable differences in rainfall, moisture, extreme rainfall, or vegetation conditions. Prioritize the most affected areas. Do not list every region.

**3. Connect conditions to agriculture.**

Relate rainfall and moisture conditions to rice and corn, referring to crop growth stages where the maps show them. Describe adequate moisture, limited water availability, possible waterlogging, or localized crop stress only when supported. Distinguish observed conditions from possible effects, and do not present possible impacts as confirmed damage. Do not infer crop damage from rainfall totals alone.

**4. Use indicators sparingly and plainly.**

Use the 1-month SPEI for the reporting month and the 3-month SPEI for the longer period shown on the map, and note where the two differ. Explain their significance in simple observational language.

**5. Include weather systems only when supported.**

Tropical cyclones listed on the tropical cyclone map may be mentioned using the names, classifications, and dates shown there, but do not claim that a cyclone caused rainfall in a specific area unless the maps show it. Do not mention the southwest or northeast monsoon or any other weather system that the maps do not establish. Do not invent storm names.

**6. Handle missing or conflicting information carefully.**

When the NDVI map is marked as not yet available, do not say anything about vegetation condition; build the assessment from the remaining maps. When maps show contrasting conditions, acknowledge the variation instead of forcing one conclusion for the whole country. State the reporting month only as shown on the maps.

## PAGASA-STYLE LANGUAGE

Use formal, straightforward sentences similar to routine agri-weather reports. Prefer expressions such as:
- “Rainfall across the country was generally light to moderate during the period.”
- “Heavier rainfall was observed over portions of Luzon and the Visayas.”
- “The SPEI-3 indicated drier-than-normal conditions over some areas.”
- “These conditions may affect rice and corn development, particularly in areas with limited water availability.”

These are examples only. Select wording according to the actual evidence. Avoid filler, conversational expressions, dramatic descriptions, excessive qualifiers, and generic statements that could apply to any month.

## STRICT OUTPUT FORMAT

Write exactly THREE paragraphs.

Target length: 150–180 words for the three paragraphs combined.

Paragraph 1: The dominant national rainfall and moisture situation, including relevant weather systems only when supported.

Paragraph 2: Notable differences across island groups or regions, including extreme rainfall or drought indicators where supported.

Paragraph 3: Implications for agricultural water availability and for rice and corn, referring to the prevailing crop stages and water sufficiency shown on the maps and distinguishing observed conditions from potential impacts. Mention vegetation only if NDVI data is shown.

The three paragraphs must read as one coherent assessment. Do not repeat the same information across paragraphs.

## STRICT RESTRICTIONS

Do not include a title, headings, bullet points, numbered lists, recommendations, forecasts, or commentary outside the three paragraphs.

Do not invent measurements, affected regions, crop growth stages, weather systems, historical comparisons, or agricultural impacts.

Before responding, verify that the Overview follows the required format, stays within the word limit, accurately reflects the supplied maps, and contains no unsupported claims.

Return only the final Overview text.
`.trim();

// ── Helpers ────────────────────────────────────────────────────────────
const toBase64 = (file: File): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res((r.result as string).split(",")[1]);
    r.onerror = () => rej(new Error("Read failed"));
    r.readAsDataURL(file);
  });

export default function OverviewEditPage() {
  const router = useRouter();

  const [text, setText] = useState("");
  const [formLink, setFormLink] = useState("");
  const [formLabel, setFormLabel] = useState("Request Form");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [impactOpen, setImpactOpen] = useState(true);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);

  // ── AI generator state (map images -> Overview text) ──
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  const handleImage = useCallback((files: FileList | null) => {
    if (!files) return;
    const valid = Array.from(files).filter(f => f.type.startsWith("image/"));
    setImageFiles(prev => [...prev, ...valid]);
    setImagePreviews(prev => [...prev, ...valid.map(f => URL.createObjectURL(f))]);
    if (imageRef.current) imageRef.current.value = ""; // so the same file can be re-added
  }, []);

  const removeImage = (i: number) => {
    URL.revokeObjectURL(imagePreviews[i]);
    setImageFiles(prev => prev.filter((_, j) => j !== i));
    setImagePreviews(prev => prev.filter((_, j) => j !== i));
  };

  const handleGenerate = async () => {
    if (!imageFiles.length) { setGenError("Please upload at least one climate map image."); return; }
    // The text box may hold the saved Overview or unsaved edits; don't replace it silently.
    if (text.trim() && !window.confirm("This will replace the Overview text currently in the box. Continue?")) return;

    setGenError(null);
    setGenerating(true);
    try {
      const imageBlocks = await Promise.all(
        imageFiles.map(async (f) => ({
          type: "image",
          source: { type: "base64", media_type: f.type, data: await toBase64(f) },
        }))
      );

      const userContent: Array<Record<string, unknown>> = [
        ...imageBlocks,
        {
          type: "text",
          text: `Please analyze the ${imageFiles.length} uploaded national climate map image(s) and generate the nationwide Overview.`,
        },
      ];

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: OVERVIEW_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userContent }],
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error.message ?? "API error");
      const out: string = (data.content as Array<{ type: string; text?: string }> | undefined)
        ?.find(b => b.type === "text")?.text?.trim() ?? "";
      if (!out) throw new Error("The AI returned no text. Please try again.");
      setText(out);
      setSaved(false);
      setError(null);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setGenerating(false);
    }
  };

  // Load whatever Overview content is already saved, so the form shows current state.
  useEffect(() => {
    const existing = getOverview();
    if (existing) {
      setText(existing.text);
      setFormLink(existing.formLink);
      setFormLabel(existing.formLabel || "Request Form");
    }
  }, []);

 const handleSave = async () => {
    if (!text.trim()) {
      setError("Overview text is required.");
      return;
    }
    if (formLink.trim() && !/^https?:\/\//i.test(formLink.trim())) {
      setError("The form link must start with http:// or https://");
      return;
    }
    setError(null);

    try {
        await saveOverview({
        text: text.trim(),
        formLink: formLink.trim(),
        formLabel: formLabel.trim() || "Request Form",
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch {
      setError("Something went wrong saving the Overview.");
    }
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

        input.field, textarea.field {
          width: 100%; border: 1px solid #dde3ea; border-radius: 4px; padding: 8px 10px;
          font-size: 13px; font-family: inherit; color: #333;
        }
        textarea.field { resize: vertical; min-height: 160px; }
        input.field:focus, textarea.field:focus { outline: none; border-color: #003087; }
        .btn-save:hover:not(:disabled) { background: #1d4ed8 !important; }
        .btn-generate:hover:not(:disabled) { background: #1d4ed8 !important; }
        input[type=file]::file-selector-button {
          background: #e5e7eb; border: 1px solid #d1d5db; border-radius: 4px;
          padding: 3px 10px; cursor: pointer; font-size: 13px; color: #374151; margin-right: 8px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-thumb { background:#ccc; border-radius:3px; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none} }
      `}</style>

      {/* ── Sidebar ── */}
      <div style={{
        width: 200, background: "#fff", borderRight: "1px solid #dde3ea",
        display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto",
      }}>
        <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #eee" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#003087", letterSpacing: ".02em" }}>PAGASA</div>
          <div style={{ fontSize: 10, color: "#888", marginTop: 1 }}>Website Content Management System</div>
          <span style={{ display: "inline-block", marginTop: 4, fontSize: 10, padding: "1px 7px", borderRadius: 3, background: "#d32f2f", color: "#fff", fontWeight: 600 }}>Production</span>
        </div>

        <nav style={{ flex: 1, paddingTop: 6 }}>
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
              className={`side-link${label === "Overview" ? " active" : ""}`}
              onClick={() => {
                if (label === "Overview") return;
                if (label === "Corn Crop Stage and Water Sufficiency") { router.push("/corn-crop-stage/edit"); return; }
                if (label === "Rice Crop Stage and Water Sufficiency") { router.push("/rice-crop-stage/edit"); return; }
                if (label === "Monthly Rainfall") { router.push("/monthly-rainfall/edit"); return; }
                if (label === "Tropical Cyclone") { router.push("/tropical-cyclone/edit"); return; }
                if (label === "Crop Condition and Drought Indicator") { router.push("/crop-condition-drought/edit"); return; }
                if (label === "Cover Page") { router.push("/cover-page/edit"); return; }
                if (label === "About this Report") { router.push("/about-this-report/edit"); return; }
                if (label === "Preface") { router.push("/preface/edit"); return; }
                router.push("/");
              }}
            >{label}</button>
          ))}

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
        <div style={{ background: "#fff", borderBottom: "1px solid #dde3ea", padding: "10px 24px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 13, color: "#003087", fontWeight: 700 }}>PAGASA</span>
          <span style={{ fontSize: 13, color: "#888" }}>Website Content Management System</span>
          <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 3, background: "#d32f2f", color: "#fff", fontWeight: 600 }}>Production</span>
          <UserMenu />
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "28px 28px 32px" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#222", margin: "0 0 4px" }}>Impact Assessment</h1>
          <div style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>Overview</div>

          {/* ── Generate Card ── */}
          <div style={{ background: "#fff", borderRadius: 6, border: "1px solid #dde3ea", overflow: "hidden", maxWidth: 640, marginBottom: 16 }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: "#222" }}>Generate Overview</span>
              <button
                className="btn-generate"
                onClick={handleGenerate}
                disabled={generating || !imageFiles.length}
                style={{
                  background: "#003087", color: "#fff", border: "none", borderRadius: 4,
                  padding: "6px 16px", fontSize: 13, fontWeight: 600,
                  cursor: imageFiles.length && !generating ? "pointer" : "not-allowed",
                  opacity: imageFiles.length ? 1 : 0.4,
                  display: "flex", alignItems: "center", gap: 7, transition: "background .15s",
                }}>
                {generating
                  ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}><circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="8" strokeLinecap="round"/></svg>Generating…</>
                  : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>Generate</>
                }
              </button>
            </div>

            <div style={{ padding: "18px 16px" }}>
              <p style={{ fontSize: 12, color: "#888", margin: "0 0 14px" }}>
                Upload the national climate map images, then click Generate. The result fills the Overview Text box below, where you can edit it before saving.
              </p>

              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {/* Image upload */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={{ display: "block", fontWeight: 500, fontSize: 13, marginBottom: 5, color: "#374151" }}>
                    <span style={{ color: "#d32f2f" }}>* </span>Upload Image
                    <span style={{ fontSize: 11, color: "#888", fontWeight: 400, marginLeft: 6 }}>(multiple allowed)</span>
                  </label>
                  <input ref={imageRef} type="file" accept="image/*" multiple
                    onChange={e => handleImage(e.target.files)}
                    style={{ width: "100%", border: "1px solid #dde3ea", borderRadius: 4, padding: "5px 8px", background: "#fff", fontSize: 13 }} />
                  {imagePreviews.length > 0 && (
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                      {imagePreviews.map((src, i) => (
                        <div key={src} style={{ animation: "fadeIn .2s ease" }}>
                          <ZoomableImage src={src} alt={`preview-${i}`}
                            style={{ width: "100%", maxHeight: 160, objectFit: "contain", background: "#f9fafb", borderRadius: 5, border: "1px solid #dde3ea", display: "block" }} />
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

              </div>

              {genError && (
                <div style={{ background: "rgba(211,47,47,.07)", border: "1px solid rgba(211,47,47,.2)", borderRadius: 5, padding: "9px 12px", fontSize: 13, color: "#d32f2f", marginTop: 14 }}>
                  ⚠ {genError}
                </div>
              )}
              <div style={{ marginTop: 10, fontSize: 11, color: "#aaa", fontStyle: "italic" }}>
                AI can make mistakes. Please review the generated text before saving.
              </div>
            </div>
          </div>

          {/* ── Update Card ── */}
          <div style={{ background: "#fff", borderRadius: 6, border: "1px solid #dde3ea", overflow: "hidden", maxWidth: 640 }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: "#222" }}>Update</span>
              <button
                className="btn-save"
                onClick={handleSave}
                style={{
                  background: saved ? "#16a34a" : "#003087",
                  color: "#fff", border: "none", borderRadius: 4,
                  width: 36, height: 30,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", transition: "background .15s",
                }}
                aria-label="Save"
              >
                {saved ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" /><path d="M17 21v-8H7v8M7 3v5h8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                )}
              </button>
            </div>

            <div style={{ padding: "18px 16px" }}>
              <p style={{ color: "#d32f2f", fontSize: 12, margin: "0 0 14px" }}>* Required Field</p>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: 500, fontSize: 13, marginBottom: 5, color: "#374151" }}>
                  <span style={{ color: "#d32f2f" }}>* </span>Overview Text
                </label>
                <textarea
                  className="field"
                  placeholder={generating ? "Generating Overview…" : "Write the Overview content shown to viewers, or use Generate Overview above…"}
                  value={text}
                  onChange={e => { setSaved(false); setText(e.target.value); }}
                />
                <div style={{ marginTop: 4, fontSize: 11, color: "#aaa" }}>
                  {text.trim() ? `${text.trim().split(/\s+/).length} words` : "No content yet"}
                </div>
              </div>

              <div style={{ marginBottom: 6, borderTop: "1px solid #eee", paddingTop: 16 }}>
                <label style={{ display: "block", fontWeight: 500, fontSize: 13, marginBottom: 5, color: "#374151" }}>
                  Request Form Link
                </label>
                <input
                  className="field"
                  type="url"
                  placeholder="https://docs.google.com/forms/d/e/…/viewform"
                  value={formLink}
                  onChange={e => { setSaved(false); setFormLink(e.target.value); }}
                />
                <p style={{ fontSize: 11, color: "#888", margin: "5px 0 0" }}>
                  Paste a Google Forms (or any) link. It appears as a button at the bottom of the Overview section so viewers can submit a request.
                </p>
              </div>

              {formLink.trim() && (
                <div style={{ marginBottom: 6 }}>
                  <label style={{ display: "block", fontWeight: 500, fontSize: 13, marginBottom: 5, color: "#374151" }}>
                    Button Label
                  </label>
                  <input
                    className="field"
                    type="text"
                    placeholder="Request Form"
                    value={formLabel}
                    onChange={e => { setSaved(false); setFormLabel(e.target.value); }}
                  />
                </div>
              )}

              {formLink.trim() && (
                <div style={{ marginTop: 14, animation: "fadeIn .2s ease" }}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>Preview</div>
                  <div style={{ border: "1px solid #dde3ea", borderRadius: 5, padding: 14, background: "#fafbfc" }}>
                    <p style={{ fontSize: 13, color: "#444", margin: "0 0 12px", whiteSpace: "pre-wrap" }}>
                      {text || "Overview text will appear here…"}
                    </p>
                    <span
                      style={{
                        display: "inline-block", background: "#003087", color: "#fff",
                        borderRadius: 4, padding: "8px 16px", fontSize: 13, fontWeight: 600,
                      }}
                    >
                      {formLabel || "Request Form"} ↗
                    </span>
                  </div>
                </div>
              )}

              {error && (
                <div style={{ background: "rgba(211,47,47,.07)", border: "1px solid rgba(211,47,47,.2)", borderRadius: 5, padding: "9px 12px", fontSize: 13, color: "#d32f2f", marginTop: 14 }}>
                  ⚠ {error}
                </div>
              )}
              {saved && (
                <div style={{ fontSize: 12, color: "#16a34a", marginTop: 14, fontWeight: 600 }}>
                  ✓ Overview saved
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <button
              onClick={() => router.push("/")}
              style={{ background: "#fff", border: "1px solid #dde3ea", color: "#374151", borderRadius: 4, padding: "6px 14px", fontSize: 13, cursor: "pointer" }}
            >
              ← Back to Impact Assessment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}