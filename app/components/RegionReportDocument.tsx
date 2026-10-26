"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { estimateChartFromImage, type EstimatedChart, type RainfallChartData } from "../lib/rainfallChart";

/**
 * The A4 regional impact-assessment document.
 * Used by:
 *  - app/regions/[id]/print/page.tsx (CMS print/save preview)
 *  - app/report/page.tsx (public "Regions" panel, read-only)
 *
 * NOTE: The provincial table + map placeholders are still static demo data,
 * same as before this refactor — only regionName / summary / month are real,
 * sourced from whatever the admin generated & saved in the CMS.
 */

const DEFAULT_SUMMARY_PARAGRAPHS = [
  "The Ilocos region received very minimal rainfall amount for the month, which is likely insufficient to sustain rice and corn crops in the area. Most of the corn crops in the region are in the establishment stage, while the ripening stage prevails for rice crops. Crops are at risk of poor grain development, and possible yield reduction due to moisture stress, especially in areas without irrigation or water management interventions.",
  "The SPEI-3 suggests mostly drier than normal conditions in the region for the past three months. However, Ilocos Norte experiences slightly wetter than normal conditions. In addition, the extreme rainfall indices (RX1day and RX5day) showed no significant extreme rainfall events that could have caused damage on both rice and corn crops.",
];

/**
 * The AI output starts with its own heading lines ("REGION III (CENTRAL LUZON)",
 * "REGIONAL SUMMARY:"). The report already prints those headings, so drop any
 * short ALL-CAPS line and keep only the paragraphs.
 */
export function cleanSummary(summary: string): string {
  return summary
    .split(/\r?\n/)
    .filter((l) => {
      const t = l.trim();
      if (!t) return true;
      return !(t.length < 90 && !/[a-z]/.test(t) && /[A-Z]/.test(t));
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The plain text of the Regional Summary as shown in the report (used by the "Listen" button). */
export function getSummaryText(summary: string): string {
  const text = summary
    ? cleanSummary(summary).replace(/\s+/g, " ").trim()
    : DEFAULT_SUMMARY_PARAGRAPHS.join(" ");
  return text;
}

/** Splits on blank lines; if there are none, splits at the sentence end nearest the middle (never mid-word). */
function splitParagraphs(summary: string): string[] {
  const byBlank = summary.split(/\n\n+/).filter(Boolean);
  if (byBlank.length > 1) return byBlank;

  const mid = Math.floor(summary.length / 2);
  let best = -1;
  const re = /[.!?]\s+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(summary))) {
    const end = m.index + m[0].length;
    if (best === -1 || Math.abs(end - mid) < Math.abs(best - mid)) best = end;
  }

  // No sentence ending found: fall back to the next space after the middle.
  if (best <= 0 || best >= summary.length) {
    const sp = summary.indexOf(" ", mid);
    best = sp === -1 ? mid : sp + 1;
  }

  return [summary.slice(0, best), summary.slice(best)].filter((p) => p.trim());
}

function LegacyRegionReport({
  regionName,
  summary,
  month,
}: {
  regionName: string;
  summary: string;
  month: string;
}) {
  const paragraphs = summary ? splitParagraphs(cleanSummary(summary)) : DEFAULT_SUMMARY_PARAGRAPHS;

  return (
    <>
      <style>{`
        .a4-title { font-size: 28px; font-weight: 900; font-family: 'Times New Roman', Times, serif; color: #000; margin: 0 0 2px; line-height: 1.1; }
        .a4-subtitle-map { font-size: 8px; font-weight: 700; color: #222; margin: 0 0 2px; }
        .a4-map-stage { font-size: 7.5px; color: #333; margin: 0 0 6px; }
        .prov-table { width: 100%; border-collapse: collapse; font-size: 7.5px; font-family: Arial, sans-serif; }
        .prov-table th { border: 1px solid #999; padding: 2px 4px; text-align: center; font-weight: 700; background: #fff; font-size: 7px; }
        .prov-table td { border: 1px solid #999; padding: 2px 4px; text-align: center; font-size: 7.5px; }
        .section-heading { font-size: 15px; font-weight: 900; font-family: 'Times New Roman', Times, serif; text-align: center; margin: 0 0 8px; color: #000; border-bottom: 1.5px solid #000; padding-bottom: 3px; }
        .map-label { font-size: 10px; font-weight: 900; font-family: 'Times New Roman', Times, serif; text-align: center; margin: 0 0 3px; color: #000; }
        .map-sublabel { font-size: 8px; text-align: center; color: #333; margin: 0 0 4px; font-style: italic; }
        @media print {
          .no-print { display: none !important; }
          .a4-page { box-shadow: none !important; border: none !important; width: 794px !important; margin: 0 !important; border-radius: 0 !important; }
          @page { size: A4 portrait; margin: 10mm 12mm; }
        }
      `}</style>

      <div className="a4-page" style={{
        width: 794,
        minHeight: 1123,
        background: "#fff",
        boxShadow: "0 2px 16px rgba(0,0,0,0.12)",
        border: "1px solid #ccc",
        borderRadius: 2,
        fontFamily: "'Times New Roman', Times, serif",
        color: "#000",
        margin: "0 auto",
        padding: "28px 32px 24px",
      }}>
        <h1 className="a4-title">{regionName}</h1>

        <div style={{ display: "flex", gap: 16, marginTop: 10, alignItems: "flex-start" }}>
          {/* LEFT: 2 stacked maps */}
          <div style={{ width: 168, flexShrink: 0 }}>
            <div className="a4-subtitle-map">Water Availability for Rice</div>
            <div className="a4-map-stage">Prevailing Stage : (IV) Ripening</div>
            <PdfMapBox color="#f59e0b" height={168} />
            <div className="a4-subtitle-map" style={{ marginTop: 10 }}>Water Availability for Corn</div>
            <div className="a4-map-stage">Prevailing Stage : (I) Establishment</div>
            <PdfMapBox color="#22c55e" height={168} />
          </div>

          {/* CENTER: Provincial table + SPEI map */}
          <div style={{ flex: 1 }}>
            <div className="section-heading">Provincial Values</div>
            <table className="prov-table">
              <thead>
                <tr>
                  <th rowSpan={2} style={{ verticalAlign: "bottom" }}></th>
                  <th rowSpan={2} style={{ verticalAlign: "bottom" }}>Mon. Ave.<br/>Rainfall<br/>(mm)</th>
                  <th colSpan={2} style={{ background: "#fff" }}>Rice</th>
                  <th colSpan={2} style={{ background: "#fff" }}>Corn</th>
                </tr>
                <tr>
                  <th>CS</th><th>CCI (%)</th><th>CS</th><th>CCI (%)</th>
                </tr>
              </thead>
              <tbody>
                {PROVINCIAL_DATA.map((prov, pi) =>
                  prov.stages.map((s, si) => (
                    <tr key={`${pi}-${si}`}>
                      {si === 0 && (
                        <>
                          <td rowSpan={prov.stages.length} style={{ fontStyle: "italic", fontWeight: 600, verticalAlign: "middle", textAlign: "left", padding: "2px 5px", whiteSpace: "nowrap" }}>{prov.name}</td>
                          <td rowSpan={prov.stages.length} style={{ verticalAlign: "middle", fontWeight: 600 }}>{prov.rainfall}</td>
                        </>
                      )}
                      <td>{s.riceCS}</td>
                      <td style={{ background: getCCIColor(s.riceCCI), fontWeight: 700 }}>{s.riceCCI}</td>
                      <td>{s.cornCS}</td>
                      <td style={{ background: getCCIColor(s.cornCCI), fontWeight: 700 }}>{s.cornCCI}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div style={{ display: "flex", gap: 16, marginTop: 5, fontSize: 7, fontFamily: "Arial, sans-serif", flexWrap: "wrap" }}>
              <div style={{ lineHeight: 1.4 }}>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>Rice CS:</div>
                <div>(I) Nursery</div><div>(II) Vegetative</div><div>(III) Reproductive</div><div>(IV) Ripening</div>
              </div>
              <div style={{ lineHeight: 1.4 }}>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>Corn CS:</div>
                <div>(I) Establishment</div><div>(II) Vegetative</div><div>(III) Reproductive</div><div>(IV) Maturity</div>
              </div>
              <div style={{ lineHeight: 1.4 }}>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>CCI Category:</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ display: "inline-block", width: 10, height: 10, background: "#fca5a5", border: "0.5px solid #999" }}/> Inadequate</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ display: "inline-block", width: 10, height: 10, background: "#fde68a", border: "0.5px solid #999" }}/> Sufficient</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ display: "inline-block", width: 10, height: 10, background: "#86efac", border: "0.5px solid #999" }}/> Excess</div>
              </div>
            </div>

            <div className="map-label" style={{ marginTop: 10 }}>SPEI3 (Feb–Mar–Apr)</div>
            <PdfMapBox color="#60a5fa" height={130} colorScale={[-4,-2,0,2,4]} colorGradient="linear-gradient(to right,#b91c1c,#f97316,#fde68a,#fff,#93c5fd,#1d4ed8)" />
          </div>

          {/* RIGHT: Regional Summary */}
          <div style={{ width: 210, flexShrink: 0 }}>
            <div className="section-heading">Regional Summary</div>
            <div style={{ fontSize: 10.5, lineHeight: 1.7, textAlign: "justify", fontFamily: "'Times New Roman', serif", color: "#000" }}>
              {paragraphs.map((p, i) => (
                <p key={i} style={{ margin: i === 0 ? "0 0 12px" : 0 }}>{p.trim()}</p>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <div style={{ flex: 1 }}>
            <div className="map-label">NDVI</div>
            <PdfMapBox color="#22c55e" height={160} colorScale={[0,0.25,0.5,0.75,1]} colorGradient="linear-gradient(to right,#92400e,#d97706,#fde68a,#86efac,#15803d)" />
          </div>
          <div style={{ flex: 1 }}>
            <div className="map-label">SPEI3 (Feb-Mar-Apr)</div>
            <PdfMapBox color="#60a5fa" height={160} colorScale={[-4,-2,0,2,4]} colorGradient="linear-gradient(to right,#b91c1c,#f97316,#fde68a,#fff,#93c5fd,#1d4ed8)" />
          </div>
          <div style={{ flex: 1 }}>
            <div className="map-label">RX1day</div>
            <PdfMapBox color="#38bdf8" height={160} colorScale={[0,100,200,300,400]} colorGradient="linear-gradient(to right,#f0f9ff,#7dd3fc,#0284c7,#1e3a5f)" unit="mm" />
          </div>
          <div style={{ flex: 1 }}>
            <div className="map-label">RX5day</div>
            <PdfMapBox color="#818cf8" height={160} colorScale={[0,100,200,300,400]} colorGradient="linear-gradient(to right,#f0f9ff,#7dd3fc,#0284c7,#1e3a5f)" unit="mm" />
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <RainfallChart month={month} />
        </div>

        <div style={{ textAlign: "right", fontSize: 9, color: "#555", marginTop: 12, fontFamily: "Arial, sans-serif" }}>4</div>
      </div>
    </>
  );
}


/* ════════════════════════════════════════════════════════════════════════
   IMAGE-BASED LAYOUT
   The uploaded report image (maps, provincial table, legends) is shown
   exactly as uploaded. Only two things are added on top of it:
     1. the Regional Summary text, placed inside the empty "Regional Summary" box
     2. the daily-rainfall graph at the bottom, redrawn as an interactive chart
   The numbers below are pixel positions measured on the 1448 x 2048 report image.
   ════════════════════════════════════════════════════════════════════════ */
const IMG_W = 1448;
const IMG_H = 2048;
const IMG_CROP_H = 1700; // everything above the static rainfall graph
const SUMMARY_BOX = { x: 747, y: 228, w: 690, h: 878 }; // blank "Regional Summary" frame

export default function RegionReportDocument({
  regionName,
  summary,
  month,
  mapImage,
  chart,
}: {
  regionName: string;
  summary: string;
  month: string;
  /** URL of the uploaded report image. Without it the old placeholder layout is shown. */
  mapImage?: string | null;
  /** Daily rainfall data parsed from the uploaded CSV. */
  chart?: RainfallChartData | null;
}) {
  // Real size of the uploaded image: the old template image still contains the static graph (2048 px tall),
  // the new one stops above it. Either way we crop / extend to fit what is really there.
  const imgRef = useRef<HTMLImageElement>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth) setNat({ w: el.naturalWidth, h: el.naturalHeight });
  }, [mapImage]);

  if (!mapImage) return <LegacyRegionReport regionName={regionName} summary={summary} month={month} />;

  const baseH = nat ? (nat.h / nat.w) * IMG_W : IMG_CROP_H; // image height in 1448-wide units
  const hasGraph = nat ? baseH > 1900 : false;               // true only for images that still hold the old graph
  const cropH = hasGraph ? IMG_CROP_H : Math.min(IMG_CROP_H, baseH);
  const paragraphs = summary ? splitParagraphs(cleanSummary(summary)) : [];

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .a4-page { box-shadow: none !important; border: none !important; width: 794px !important; margin: 0 !important; border-radius: 0 !important; }
          @page { size: A4 portrait; margin: 10mm 12mm; }
        }
      `}</style>
      <div
        className="a4-page"
        style={{
          width: 794,
          background: "#fff",
          boxShadow: "0 2px 16px rgba(0,0,0,0.12)",
          border: "1px solid #ccc",
          borderRadius: 2,
          color: "#000",
          margin: "0 auto",
          padding: "12px 14px 10px",
        }}
      >
        {/* Uploaded image, cropped just above the static graph */}
        <div style={{ position: "relative", width: "100%", aspectRatio: `${IMG_W} / ${cropH}`, overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            src={mapImage}
            alt={`${regionName} climate maps`}
            style={{ display: "block", width: "100%", height: "auto" }}
          />
          {/* Regional Summary text, inside the box that was left blank in the image */}
          <SummaryBox
            paragraphs={paragraphs}
            style={{
              position: "absolute",
              left: `${(SUMMARY_BOX.x / IMG_W) * 100}%`,
              top: `${(SUMMARY_BOX.y / cropH) * 100}%`,
              width: `${(SUMMARY_BOX.w / IMG_W) * 100}%`,
              height: `${(SUMMARY_BOX.h / cropH) * 100}%`,
              padding: "14px 16px",
              overflow: "hidden",
              boxSizing: "border-box",
              fontFamily: "Arial, Helvetica, sans-serif",
              lineHeight: 1.6,
              textAlign: "justify",
              color: "#000",
            }}
          />
        </div>

        {/* Interactive replacement for the static graph */}
        {chart && chart.series.length > 0 ? (
          <InteractiveRainfallChart data={chart} />
        ) : hasGraph ? (
          /* Older image that still contains the graph: show it, made hoverable by reading its lines */
          <ImageGraphHover src={mapImage} regionName={regionName} />
        ) : (
          <div
            className="no-print"
            style={{ margin: "10px 0 4px 36px", border: "1px dashed #9ca3af", borderRadius: 4, padding: "34px 18px", textAlign: "center", color: "#6b7280", fontSize: 12, lineHeight: 1.5, fontFamily: "Arial, Helvetica, sans-serif" }}
          >
            Daily rainfall graph: no chart data found for this report.<br />
            Upload a CSV (a date column plus one column per province, daily rainfall in mm) and save again.
          </div>
        )}
      </div>
    </>
  );
}

/**
 * The graph printed in the uploaded image, with a hover layer on top.
 * Values come from reading the image's coloured lines (see estimateChartFromImage),
 * so they are marked as estimates. If the image can't be read the graph simply stays a picture.
 */
function ImageGraphHover({ src, regionName }: { src: string; regionName: string }) {
  const cropH = IMG_H - IMG_CROP_H;
  const [est, setEst] = useState<EstimatedChart | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ idx: number; x: number; y: number; flip: boolean } | null>(null);

  useEffect(() => {
    let off = false;
    setEst(null);
    estimateChartFromImage(src, regionName).then((r) => { if (!off) setEst(r); });
    return () => { off = true; };
  }, [src, regionName]);

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const box = boxRef.current;
    if (!est || !box) return;
    const r = box.getBoundingClientRect();
    const imgY = IMG_CROP_H + ((e.clientY - r.top) / r.height) * cropH;
    if (imgY < 1764 || imgY > 2005) { setHover(null); return; } // only inside the plot box
    const fx = (e.clientX - r.left) / r.width;
    let idx = 0;
    est.xs.forEach((x, i) => { if (Math.abs(x - fx) < Math.abs(est.xs[idx] - fx)) idx = i; });
    setHover({ idx, x: e.clientX, y: e.clientY, flip: e.clientX > window.innerWidth - 230 });
  }

  const rows = est && hover
    ? est.series
        .map((s) => ({ s, v: s.pct[hover.idx] }))
        .sort((a, b) => (b.v ?? -1) - (a.v ?? -1))
    : [];

  return (
    <div
      ref={boxRef}
      onPointerMove={onMove}
      onPointerDown={onMove}
      onPointerLeave={() => setHover(null)}
      style={{ position: "relative", width: "100%", aspectRatio: `${IMG_W} / ${cropH}`, overflow: "hidden", cursor: est ? "crosshair" : undefined, touchAction: "pan-y" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" draggable={false} style={{ display: "block", width: "100%", height: "auto", marginTop: `-${(IMG_CROP_H / IMG_W) * 100}%`, userSelect: "none" }} />

      {est && hover && (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div
            style={{
              position: "absolute",
              left: `${est.xs[hover.idx] * 100}%`,
              top: `${((1766 - IMG_CROP_H) / cropH) * 100}%`,
              height: `${((1996 - 1766) / cropH) * 100}%`,
              borderLeft: "1px dashed #444",
            }}
          />
          {est.series.map((s) => {
            const y = s.y[hover.idx];
            if (y === null) return null;
            return (
              <span
                key={s.name}
                style={{
                  position: "absolute",
                  left: `${est.xs[hover.idx] * 100}%`,
                  top: `${((y - IMG_CROP_H) / cropH) * 100}%`,
                  width: 8, height: 8, borderRadius: "50%",
                  background: s.color, border: "1.5px solid #fff", boxShadow: "0 0 0 0.5px #666",
                  transform: "translate(-50%, -50%)",
                }}
              />
            );
          })}
        </div>
      )}

      {est && hover && typeof document !== "undefined" && createPortal(
        <div
          style={{
            position: "fixed",
            top: hover.y,
            left: hover.flip ? hover.x - 16 : hover.x + 16,
            transform: `translate(${hover.flip ? "-100%" : "0"}, ${hover.y < 220 ? "8px" : "calc(-100% - 8px)"})`,
            minWidth: 170,
            background: "rgba(255,255,255,.98)",
            border: "1px solid #cbd5e1",
            borderRadius: 4,
            boxShadow: "0 2px 10px rgba(0,0,0,.25)",
            padding: "7px 10px",
            fontFamily: "Arial, sans-serif",
            fontSize: 12,
            color: "#1f2937",
            pointerEvents: "none",
            zIndex: 10001,
            whiteSpace: "nowrap",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4, paddingBottom: 3, borderBottom: "1px solid #e5e7eb" }}>
            Day {hover.idx + 1}
          </div>
          {rows.map(({ s, v }) => (
            <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 6, lineHeight: 1.55 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{s.name}</span>
              <span style={{ fontWeight: 700 }}>{v === null ? "—" : `≈ ${v.toFixed(1)}%`}</span>
            </div>
          ))}
          <div style={{ marginTop: 4, paddingTop: 3, borderTop: "1px solid #e5e7eb", fontSize: 10, color: "#6b7280" }}>
            Estimated from the graph image · “—” = hidden behind another line
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/** Summary text that shrinks (down to 7px) until it fits inside its box, so it is never cut off. */
function SummaryBox({ paragraphs, style }: { paragraphs: string[]; style: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const [fs, setFs] = useState(13);
  const key = paragraphs.join("\u0001");

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let size = 13;
    el.style.fontSize = `${size}px`;
    while (size > 7 && el.scrollHeight > el.clientHeight + 1) {
      size -= 0.25;
      el.style.fontSize = `${size}px`;
    }
    setFs(size);
  }, [key]);

  return (
    <div ref={ref} style={{ ...style, fontSize: fs }}>
      {paragraphs.map((p, i) => (
        <p key={i} style={{ margin: "0 0 0.9em" }}>{p.trim()}</p>
      ))}
    </div>
  );
}

/* ── Interactive daily-rainfall chart ──
   Drawn to match the R-generated template: legend row on top, boxed plot, a grey gridline on
   every day, a label every 2nd day, y-axis ticks at 0 / half / max with rotated labels.
   Hover shows the values for that day; click a legend entry to hide / show a province. */
function InteractiveRainfallChart({ data }: { data: RainfallChartData }) {
  const { days, series } = data;
  const n = days.length;
  // Proportions copied from the template graph (wide and short): plot is ~1/6 as tall as it is wide.
  const W = 766, H = 138;
  const pL = 32, pR = 8, pT = 4, pB = 21;
  const bx0 = pL, bx1 = W - pR, by0 = pT, by1 = H - pB; // plot box
  const bw = bx1 - bx0, bh = by1 - by0;

  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const visible = series.filter((s) => !hidden.has(s.name));

  // y-axis: 0 / max/2 / max, where max = the highest value on the graph (1 decimal, like the template)
  const rawMax = Math.max(0.1, ...series.flatMap((s) => s.pct));
  const M = Math.round(rawMax * 10) / 10;
  // R pads both axes by 4 %, so the data never touches the box
  const span = Math.max(1, n - 1);
  const toX = (i: number) => bx0 + ((i + 0.04 * span) / (1.08 * span)) * bw;
  const toY = (v: number) => by1 - ((v + 0.04 * M) / (1.08 * M)) * bh;

  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ idx: number; x: number; y: number; flip: boolean } | null>(null);

  function handleMove(e: React.PointerEvent<SVGRectElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const sr = svg.getBoundingClientRect();
    const xView = ((e.clientX - sr.left) / sr.width) * W;
    let idx = 0;
    for (let i = 1; i < n; i++) if (Math.abs(toX(i) - xView) < Math.abs(toX(idx) - xView)) idx = i;
    setHover({ idx, x: e.clientX, y: e.clientY, flip: e.clientX > window.innerWidth - 230 });
  }

  const toggle = (name: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });

  const rows = hover
    ? visible.map((s) => ({ s, v: s.pct[hover.idx] ?? 0, mm: s.mm ? s.mm[hover.idx] : null })).sort((a, b) => b.v - a.v)
    : [];
  const yTicks = [0, M / 2, M];

  return (
    <div style={{ marginTop: 2, fontFamily: "Arial, Helvetica, sans-serif", color: "#000" }}>
      {/* Legend row (click to hide / show a province) */}
      <div style={{ display: "flex", justifyContent: "space-evenly", flexWrap: "wrap", gap: "0 8px", fontSize: 9, padding: "2px 0 1px 26px" }}>
        {series.map((s) => {
          const off = hidden.has(s.name);
          return (
            <button
              key={s.name}
              type="button"
              onClick={() => toggle(s.name)}
              title={off ? `Show ${s.name}` : `Hide ${s.name}`}
              style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", padding: "1px 0", cursor: "pointer", font: "inherit", color: "inherit", opacity: off ? 0.35 : 1, textDecoration: off ? "line-through" : "none" }}
            >
              <span style={{ width: 16, height: 2.5, background: s.color, display: "inline-block" }} />
              {s.name}
            </button>
          );
        })}
      </div>

      <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", background: "#fff", touchAction: "pan-y" }}>
        {/* a vertical grey gridline for every day */}
        {days.map((d, i) => (
          <line key={d + i} x1={toX(i)} y1={by0} x2={toX(i)} y2={by1} stroke="#bdbdbd" strokeWidth="0.8" />
        ))}

        {/* lines */}
        {visible.map((s) => (
          <polyline key={s.name} points={s.pct.map((v, i) => `${toX(i)},${toY(v)}`).join(" ")} fill="none" stroke={s.color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        ))}

        {/* box */}
        <rect x={bx0} y={by0} width={bw} height={bh} fill="none" stroke="#000" strokeWidth="1" />

        {/* y axis: ticks + rotated labels, like the template */}
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={bx0 - 3} y1={toY(v)} x2={bx0} y2={toY(v)} stroke="#000" strokeWidth="0.8" />
            <text transform={`translate(${bx0 - 6} ${toY(v)}) rotate(-90)`} textAnchor="middle" fontSize="7.5" fill="#000">{v.toFixed(1)}</text>
          </g>
        ))}
        <line x1={bx0} y1={toY(0)} x2={bx0} y2={toY(M)} stroke="#000" strokeWidth="1" />
        <text transform={`translate(8 ${(by0 + by1) / 2}) rotate(-90)`} textAnchor="middle" fontSize="7.5" fontStyle="italic" fill="#000">% of monthly rainfall total</text>

        {/* x axis: a label on every 2nd day */}
        {days.map((d, i) => (i % 2 === 0 ? (
          <g key={"x" + d + i}>
            <line x1={toX(i)} y1={by1} x2={toX(i)} y2={by1 + 3} stroke="#000" strokeWidth="0.8" />
            <text x={toX(i)} y={by1 + 12} textAnchor="middle" fontSize="7.5" fill="#000">{d}</text>
          </g>
        ) : null))}

        {/* hover guide + dots */}
        {hover && (
          <g pointerEvents="none">
            <line x1={toX(hover.idx)} y1={by0} x2={toX(hover.idx)} y2={by1} stroke="#222" strokeWidth="1" strokeDasharray="3,3" />
            {visible.map((s) => (
              <circle key={s.name} cx={toX(hover.idx)} cy={toY(s.pct[hover.idx] ?? 0)} r="2.6" fill={s.color} stroke="#fff" strokeWidth="1" />
            ))}
          </g>
        )}

        <rect
          x={bx0} y={by0} width={bw} height={bh}
          fill="transparent"
          style={{ cursor: "crosshair" }}
          onPointerMove={handleMove}
          onPointerDown={handleMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>

      {hover && typeof document !== "undefined" && createPortal(
        <div
          style={{
            position: "fixed",
            top: hover.y,
            left: hover.flip ? hover.x - 16 : hover.x + 16,
            transform: `translate(${hover.flip ? "-100%" : "0"}, ${hover.y < 220 ? "8px" : "calc(-100% - 8px)"})`,
            minWidth: 170,
            background: "rgba(255,255,255,.98)",
            border: "1px solid #cbd5e1",
            borderRadius: 4,
            boxShadow: "0 2px 10px rgba(0,0,0,.25)",
            padding: "7px 10px",
            fontFamily: "Arial, sans-serif",
            fontSize: 12,
            color: "#1f2937",
            pointerEvents: "none",
            zIndex: 10001,
            whiteSpace: "nowrap",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4, paddingBottom: 3, borderBottom: "1px solid #e5e7eb" }}>{days[hover.idx]}</div>
          {rows.map(({ s, v, mm }) => (
            <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 6, lineHeight: 1.55 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{s.name}</span>
              <span style={{ fontWeight: 700 }}>{v.toFixed(1)}%</span>
              {mm != null && <span style={{ color: "#6b7280", minWidth: 48, textAlign: "right" }}>{mm.toFixed(0)} mm</span>}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

/* ── Map Placeholder ── */
function PdfMapBox({ color, height = 130, colorScale, colorGradient, unit }: {
  color: string; height?: number; colorScale?: number[]; colorGradient?: string; unit?: string;
}) {
  return (
    <div style={{ border: "0.5px solid #aaa", overflow: "hidden" }}>
      <div style={{
        height,
        background: `linear-gradient(135deg, ${color}18 0%, ${color}35 50%, ${color}18 100%)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
      }}>
        <svg width="55" height={height - 10} viewBox="0 0 60 160" style={{ opacity: 0.35 }}>
          <path d="M30 5 C22 10, 14 22, 16 40 C18 56, 11 66, 13 84 C15 102, 21 115, 29 145 C30 150, 31 150, 32 145 C40 115, 47 102, 49 84 C51 66, 44 56, 46 40 C48 22, 40 10, 30 5Z" fill={color} opacity="0.7"/>
        </svg>
      </div>
      {colorScale && colorGradient && (
        <div style={{ padding: "3px 6px 4px", background: "#fff", borderTop: "0.5px solid #ccc" }}>
          <div style={{ height: 7, background: colorGradient, borderRadius: 1, border: "0.5px solid #ccc" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 6.5, fontFamily: "Arial, sans-serif", marginTop: 1, color: "#444" }}>
            {colorScale.map((v, i) => <span key={i}>{v}</span>)}
            {unit && <span style={{ marginLeft: 2 }}>{unit}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

/* Deterministic pseudo-random in [0,1) so the demo chart is identical on every render
   (and identical between the small view and the click-to-zoom view). */
function noise(seed: number, day: number) {
  const x = Math.sin(seed * 12.9898 + day * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/* ── Daily Rainfall Chart (hover to see the values) ── */
function RainfallChart({ month }: { month: string }) {
  void month;
  const days = Array.from({ length: 29 }, (_, i) => i + 1);
  const provinces: { name: string; color: string; data: number[] }[] = [
    { name: "Ilocos Norte", color: "#9ca3af", data: days.map(d => d === 21 ? 65 : d === 22 ? 35 : noise(1, d) < 0.1 ? 5 : 0) },
    { name: "Ilocos Sur",   color: "#4ade80", data: days.map(d => d === 27 ? 80 : d === 26 ? 28 : noise(2, d) < 0.1 ? 4 : 0) },
    { name: "La Union",     color: "#f87171", data: days.map(d => d === 27 ? 55 : d === 28 ? 22 : noise(3, d) < 0.1 ? 3 : 0) },
    { name: "Pangasinan",   color: "#003087", data: days.map(d => d === 28 ? 90 : d === 27 ? 38 : noise(4, d) < 0.1 ? 5 : 0) },
  ];

  const W = 720, H = 90, pL = 36, pR = 8, pT = 6, pB = 22;
  const cW = W - pL - pR, cH = H - pT - pB;
  const toX = (i: number) => pL + (i / (days.length - 1)) * cW;
  const toY = (v: number) => pT + cH - (v / 100) * cH;
  const pts = (data: number[]) => data.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");
  const tickDays = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29];

  // Hover state: which day is under the cursor + where to draw the tooltip (px inside the wrapper)
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ idx: number; x: number; y: number; flip: boolean } | null>(null);

  function handleMove(e: React.PointerEvent<SVGRectElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const sr = svg.getBoundingClientRect();
    const xView = ((e.clientX - sr.left) / sr.width) * W;      // cursor in chart coordinates
    const idx = Math.max(0, Math.min(days.length - 1, Math.round(((xView - pL) / cW) * (days.length - 1))));
    // x / y are viewport coordinates: the tooltip is drawn in a portal on <body>, so it is not
    // affected by the small preview's CSS zoom or by the lightbox's scroll/overflow clipping.
    setHover({
      idx,
      x: e.clientX,
      y: e.clientY,
      flip: e.clientX > window.innerWidth - 190,   // near the right edge -> open to the left
    });
  }

  const dayLabel = (d: number) => `${String(d).padStart(2, "0")}-Apr`;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 7.5, fontFamily: "Arial, sans-serif", color: "#444", paddingRight: 2, alignSelf: "center", whiteSpace: "nowrap" }}>
          % of monthly rainfall total
        </div>
        <svg ref={svgRef} width={W} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", background: "#fff", flex: 1 }}>
          {[0, 25, 50, 75, 100].map(v => (
            <g key={v}>
              <line x1={pL} y1={toY(v)} x2={W - pR} y2={toY(v)} stroke="#e5e7eb" strokeWidth="0.6" strokeDasharray={v === 0 ? "none" : "2,2"} />
              <text x={pL - 3} y={toY(v) + 3} textAnchor="end" fontSize="6" fill="#6b7280">{v}</text>
            </g>
          ))}
          <line x1={pL} y1={toY(0)} x2={W - pR} y2={toY(0)} stroke="#999" strokeWidth="0.8" />
          {tickDays.map(d => (
            <g key={d}>
              <line x1={toX(d - 1)} y1={toY(0)} x2={toX(d - 1)} y2={toY(0) + 3} stroke="#999" strokeWidth="0.6" />
              <text x={toX(d - 1)} y={H - 7} textAnchor="middle" fontSize="5.5" fill="#6b7280">{dayLabel(d)}</text>
            </g>
          ))}
          {provinces.map(p => (
            <polyline key={p.name} points={pts(p.data)} fill="none" stroke={p.color} strokeWidth="1" strokeLinejoin="round" />
          ))}
          {provinces.map((p, i) => (
            <g key={p.name} transform={`translate(${pL + i * 155}, ${H - 1})`}>
              <line x1="0" y1="-3" x2="14" y2="-3" stroke={p.color} strokeWidth="1.5" />
              <text x="16" y="0" fontSize="6" fill="#374151">{p.name}</text>
            </g>
          ))}

          {/* Hover guide line + a dot on every province line for that day */}
          {hover && (
            <g pointerEvents="none">
              <line x1={toX(hover.idx)} y1={pT} x2={toX(hover.idx)} y2={toY(0)} stroke="#6b7280" strokeWidth="0.6" strokeDasharray="2,2" />
              {provinces.map(p => (
                <circle key={p.name} cx={toX(hover.idx)} cy={toY(p.data[hover.idx])} r="2.2" fill={p.color} stroke="#fff" strokeWidth="0.8" />
              ))}
            </g>
          )}

          {/* Invisible layer that catches the mouse over the whole plot area */}
          <rect
            x={pL} y={pT} width={cW} height={H - pT}
            fill="transparent"
            style={{ cursor: "crosshair" }}
            onPointerMove={handleMove}
            onPointerDown={handleMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      </div>

      {/* Tooltip (portal to <body>, so it also works inside the zoom lightbox and the zoomed preview) */}
      {hover && typeof document !== "undefined" && createPortal(
        <div
          style={{
            position: "fixed",
            top: hover.y,
            left: hover.flip ? hover.x - 16 : hover.x + 16,
            transform: `translate(${hover.flip ? "-100%" : "0"}, ${hover.y < 150 ? "8px" : "calc(-100% - 8px)"})`,
            minWidth: 150,
            background: "rgba(255,255,255,.98)",
            border: "1px solid #cbd5e1",
            borderRadius: 4,
            boxShadow: "0 2px 10px rgba(0,0,0,.25)",
            padding: "7px 10px",
            fontFamily: "Arial, sans-serif",
            fontSize: 12,
            color: "#1f2937",
            pointerEvents: "none",
            zIndex: 10001,
            whiteSpace: "nowrap",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4, paddingBottom: 3, borderBottom: "1px solid #e5e7eb" }}>
            {dayLabel(hover.idx + 1)}
          </div>
          {provinces.map(p => (
            <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 6, lineHeight: 1.55 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{p.name}</span>
              <span style={{ fontWeight: 700 }}>{p.data[hover.idx]}%</span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

function getCCIColor(val: string) {
  if (val === "NaN" || val === "—") return "#fde68a";
  const n = parseFloat(val);
  if (isNaN(n)) return "#fde68a";
  if (n < 0.15) return "#fca5a5";
  if (n < 0.3) return "#fde68a";
  return "#86efac";
}

const PROVINCIAL_DATA = [
  { name: "Ilocos Norte", rainfall: "12.5", stages: [
    { riceCS: "I",   riceCCI: "NaN", cornCS: "I",   cornCCI: "NaN" },
    { riceCS: "II",  riceCCI: "NaN", cornCS: "II",  cornCCI: "NaN" },
    { riceCS: "III", riceCCI: "NaN", cornCS: "III", cornCCI: "NaN" },
    { riceCS: "IV",  riceCCI: "NaN", cornCS: "IV",  cornCCI: "NaN" },
  ]},
  { name: "Ilocos Sur", rainfall: "40.7", stages: [
    { riceCS: "I",   riceCCI: "0.1", cornCS: "I",   cornCCI: "0.0" },
    { riceCS: "II",  riceCCI: "0.1", cornCS: "II",  cornCCI: "0.0" },
    { riceCS: "III", riceCCI: "0.1", cornCS: "III", cornCCI: "0.0" },
    { riceCS: "IV",  riceCCI: "0.2", cornCS: "IV",  cornCCI: "0.0" },
  ]},
  { name: "La Union", rainfall: "22.1", stages: [
    { riceCS: "I",   riceCCI: "0.1", cornCS: "I",   cornCCI: "0.3" },
    { riceCS: "II",  riceCCI: "0.1", cornCS: "II",  cornCCI: "0.2" },
    { riceCS: "III", riceCCI: "0.1", cornCS: "III", cornCCI: "0.1" },
    { riceCS: "IV",  riceCCI: "0.2", cornCS: "IV",  cornCCI: "0.2" },
  ]},
  { name: "Pangasinan", rainfall: "28.5", stages: [
    { riceCS: "I",   riceCCI: "0.1", cornCS: "I",   cornCCI: "0.4" },
    { riceCS: "II",  riceCCI: "0.1", cornCS: "II",  cornCCI: "0.2" },
    { riceCS: "III", riceCCI: "0.1", cornCS: "III", cornCCI: "0.1" },
    { riceCS: "IV",  riceCCI: "0.2", cornCS: "IV",  cornCCI: "0.2" },
  ]},
];