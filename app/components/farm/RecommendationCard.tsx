"use client";
import { AlertTriangle, CheckCircle2, CloudRain, Droplets, ListChecks, Thermometer, CloudSun, Info } from "lucide-react";
import { ASSESSMENT_META, MONTH_LONG } from "../../lib/farm/labels";
import type { Assessment, FactorResult, Recommendation } from "../../lib/farm/types";
import { Badge, Card, Notice } from "./ui";

function scoreColor(s: number) {
  return s >= 75 ? "#2e7d32" : s >= 60 ? "#d9a800" : s >= 40 ? "#ef8a1f" : "#c62828";
}

/** Plain-language word for a 0-100 factor score. */
function rating(s: number) {
  return s >= 85 ? "Excellent" : s >= 70 ? "Good" : s >= 50 ? "Fair" : "Poor";
}

const VERDICT: Record<Assessment, { headline: string; sub: string }> = {
  favorable: { headline: "Good time to plant", sub: "Conditions here usually work well for this crop." },
  moderately_favorable: { headline: "Okay, with some care", sub: "Planting is possible, but watch the points below." },
  less_favorable: { headline: "Not the best time", sub: "Conditions are often difficult. Consider another month." },
  high_risk: { headline: "High risk. Consider waiting", sub: "Planting now carries a high chance of crop problems." },
  insufficient_data: { headline: "Not enough data", sub: "" },
};

const FACTOR_ICON: Record<FactorResult["key"], typeof CloudRain> = {
  rainfall: CloudRain,
  temperature: Thermometer,
  forecast: CloudSun,
  water: Droplets,
  risk: AlertTriangle,
};

/** "heavy-rain days occur in many years." -> "Heavy-rain days occur in many years." */
const sentence = (t: string) => {
  const s = t.trim();
  if (!s) return s;
  const c = s[0].toUpperCase() + s.slice(1);
  return /[.!?]$/.test(c) ? c : c + ".";
};

/** Easy-to-read meaning of each factor, by rating. The technical numbers stay underneath as "Data". */
const MEANING: Record<FactorResult["key"], [string, string, string, string]> = {
  //            Excellent                                   Good                                        Fair                                           Poor
  rainfall:    ["Rain usually comes at the right amount.", "Rain is usually enough, with small ups and downs.", "Rain is often too little or too much.", "Rain is usually too little or too much for this crop."],
  temperature: ["The weather is not too hot or too cold.", "The weather is mostly comfortable for the crop.", "It can get too hot or too cool for the crop.", "It is usually too hot or too cold for this crop."],
  forecast:    ["The next days look good for planting.", "The next days look mostly fine.", "The next days may be wet, windy or hot.", "The next days look bad for planting."],
  water:       ["Water for the field should be enough.", "Water should be mostly enough.", "Water may run short at times.", "Water is likely to run short."],
  risk:        ["Few storm or heavy-rain problems in past years.", "Some heavy-rain days in past years, but usually manageable.", "Heavy rain or strong wind hit in many past years.", "Heavy rain, strong wind or storms are common."],
};
const meaning = (f: FactorResult & { score: number }) => MEANING[f.key][f.score >= 85 ? 0 : f.score >= 70 ? 1 : f.score >= 50 ? 2 : 3];

/** Tidy the technical detail line: capital letter, full stop, degree sign. */
const tidy = (t: string) => sentence(t).replace(/(\d) C\b/g, "$1\u00B0C").replace(/\bmm\/month\b/g, "mm per month");

const FACTOR_NAME: Record<FactorResult["key"], string> = {
  rainfall: "Rain", temperature: "Temperature", forecast: "Next 7 days", water: "Water for the field", risk: "Storm and wind risk",
};

export default function RecommendationCard({ rec, heading }: { rec: Recommendation; heading?: string }) {
  const meta = ASSESSMENT_META[rec.assessment];
  const when = rec.mode === "current" ? "Planting in the next few days" : `${MONTH_LONG[rec.plantingMonth - 1]} planting`;
  const cropName = rec.crop === "rice" ? "Rice" : "Corn";
  const verdict = VERDICT[rec.assessment];
  const scored = rec.factors.filter(f => f.score != null) as (FactorResult & { score: number })[];
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const weakest = sorted.length > 1 ? sorted[sorted.length - 1] : null;
  const color = scoreColor(rec.score ?? 0);

  return (
    <Card title={heading ?? `${cropName} - ${when}`} right={<Badge bg={meta.bg} fg={meta.fg}>{meta.label}</Badge>}>
      {rec.assessment === "insufficient_data" ? (
        <div className="space-y-2 text-sm text-[#1c2b3a]">
          <p className="m-0 font-bold">We do not have enough reliable data to give a recommendation for this choice.</p>
          <ul className="m-0 list-disc pl-5">{rec.insufficientReasons.map(r => <li key={r}>{r}</li>)}</ul>
        </div>
      ) : (
        <div className="space-y-4 text-sm text-[#1c2b3a]">
          {/* 1. The answer */}
          <section aria-label="Summary" className="rounded border-l-4 bg-[#f6f8fa] p-3" style={{ borderColor: color }}>
            <div className="flex items-center gap-3">
              <div className="shrink-0 text-center leading-none">
                <div className="text-3xl font-bold" style={{ color }}>{rec.score}</div>
                <div className="mt-1 text-[11px] text-[#5b6672]">out of 100</div>
              </div>
              <div className="min-w-0">
                <p className="m-0 text-base font-bold">{verdict.headline}</p>
                <p className="m-0 text-xs text-[#3a4652]">{verdict.sub}</p>
              </div>
            </div>
            {best && (
              <p className="m-0 mt-2 text-xs text-[#3a4652]">
                <strong style={{ color: "#2e7d32" }}>Strongest:</strong> {best.label} ({rating(best.score).toLowerCase()})
                {weakest && weakest.score < 85 && <> &nbsp;&middot;&nbsp; <strong style={{ color: scoreColor(weakest.score) }}>Needs attention:</strong> {weakest.label} ({rating(weakest.score).toLowerCase()})</>}
              </p>
            )}
          </section>

          {/* 2. Why: one row per thing we checked */}
          <section aria-label="What we checked">
            <h4 className="m-0 mb-2 text-xs font-bold uppercase tracking-wide text-[#5b6672]">What we checked</h4>
            <ul className="m-0 list-none overflow-hidden rounded border border-[#dde3ea] p-0">
              {scored.map((f, i) => {
                const I = FACTOR_ICON[f.key];
                const c = scoreColor(f.score);
                return (
                  <li key={f.key} className="border-t border-[#e3e8ee] px-3 py-2.5 first:border-t-0" style={{ background: i % 2 ? "#fafbfc" : "#fff" }}>
                    {/* Row 1: what was checked, and how it rated. Wraps on narrow cards instead of scrolling. */}
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                      <span className="flex items-center gap-2 text-xs font-bold text-[#1c2b3a]"><I size={16} style={{ color: c }} aria-hidden />{FACTOR_NAME[f.key]}</span>
                      <span className="flex items-center gap-2">
                        <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: c + "1f", color: c }}>{rating(f.score)}</span>
                        <span className="flex items-center gap-1.5 text-[11px] text-[#5b6672]">
                          <span className="inline-block h-1.5 w-16 rounded bg-[#e8edf2]" aria-hidden><span className="block h-1.5 rounded" style={{ width: `${f.score}%`, background: c }} /></span>
                          {f.score} out of 100
                        </span>
                      </span>
                    </div>
                    {/* Row 2: what it means */}
                    <p className="m-0 mt-1.5 text-xs font-semibold text-[#1c2b3a]">{meaning(f)}</p>
                    <p className="m-0 mt-0.5 text-[11px] leading-snug text-[#5b6672]">{tidy(f.detail)}</p>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* 3. What to do */}
          {(rec.risks.length > 0 || rec.actions.length > 0) && (
            <section aria-label="Advice" className="grid gap-3 sm:grid-cols-2">
              {rec.risks.length > 0 && (
                <div className="rounded border border-[#f3c98b] bg-[#fff9ef] p-3">
                  <h4 className="m-0 mb-1.5 flex items-center gap-1.5 text-xs font-bold text-[#8a4b00]"><AlertTriangle size={14} aria-hidden /> Watch out for</h4>
                  <ul className="m-0 list-disc space-y-1 pl-4 text-xs">{rec.risks.map(r => <li key={r}>{sentence(r)}</li>)}</ul>
                </div>
              )}
              {rec.actions.length > 0 && (
                <div className="rounded border border-[#b9d9bb] bg-[#f3faf3] p-3">
                  <h4 className="m-0 mb-1.5 flex items-center gap-1.5 text-xs font-bold text-[#1f5e23]"><ListChecks size={14} aria-hidden /> What you can do</h4>
                  <ul className="m-0 list-none space-y-1 p-0 text-xs">
                    {rec.actions.map(a => <li key={a} className="flex gap-1.5"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-[#2e7d32]" aria-hidden />{sentence(a)}</li>)}
                  </ul>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* 4. Fine print, kept short and out of the way */}
      <div className="mt-3 space-y-1.5">
        {!rec.thresholdsValidated && (
          <Notice tone="warn">Still being reviewed by agriculture experts. Treat this as a guide, not as advice.</Notice>
        )}
        <details className="text-xs text-[#5b6672]">
          <summary className="flex cursor-pointer items-center gap-1 font-bold text-[#003087]"><Info size={13} aria-hidden /> About this assessment</summary>
          <p className="m-0 mt-1.5 leading-snug">{rec.disclaimer}</p>
        </details>
      </div>
    </Card>
  );
}