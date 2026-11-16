"use client";
import { memo, useState } from "react";
import { ASSESSMENT_META, MONTH_LONG, MONTH_SHORT } from "../../lib/farm/labels";
import type { Crop, Irrigation, MonthlyClimate, Recommendation } from "../../lib/farm/types";
import type { CalendarEntry } from "../../lib/farm/recommendation";
import { BarChart, LineChart } from "./charts";
import RecommendationCard from "./RecommendationCard";
import { CalendarSkeleton, Card, Empty, ErrorBox } from "./ui";
import { TTL, useApi } from "./useApi";

interface CalendarResponse { calendar: CalendarEntry[]; recommendations: Recommendation[]; months: MonthlyClimate[]; disclaimer: string }

function CalendarTab({ lat, lon, crop, irrigation }: { lat: number; lon: number; crop: Crop; irrigation: Irrigation }) {
  const q = `lat=${lat}&lon=${lon}&crop=${crop}&irrigation=${irrigation}`;
  const cal = useApi<CalendarResponse>(`/api/farm/calendar?${q}`, TTL.calendar);
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);

  if (cal.loading) return <CalendarSkeleton />;
  if (cal.error) return <ErrorBox message={cal.error} onRetry={cal.refetch} />;
  if (!cal.data) return null;
  const { calendar, months } = cal.data;
  const anyData = calendar.some(c => c.assessment !== "insufficient_data");
  const good = calendar.filter(c => c.assessment === "favorable").map(c => c.month);
  const bestText = good.length ? monthRanges(good) : null;

  return (
    <div className="space-y-3">
      <Card title="Planting calendar" right={<span className="text-xs text-[#5b6672]">Tap a month for details</span>}>
        {!anyData && <Empty>Not enough historical weather is available for this location yet.</Empty>}
        {anyData && (
          <>
            <p className="m-0 mb-2 rounded bg-[#f6f8fa] px-3 py-2 text-sm text-[#1c2b3a]">
              {bestText
                ? <>Best months to plant {cropLabel(crop)}: <strong className="text-[#2e7d32]">{bestText}</strong>.</>
                : <>No month is rated fully favorable here. Pick the greenest or yellowest month below and read the tips.</>}
            </p>
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
              {calendar.map(c => {
                const meta = ASSESSMENT_META[c.assessment];
                const on = month === c.month;
                return (
                  <button
                    key={c.month}
                    onClick={() => setMonth(c.month)}
                    aria-pressed={on}
                    aria-label={`${MONTH_LONG[c.month - 1]}: ${meta.label}${c.score != null ? `, score ${c.score}` : ""}`}
                    title={meta.label}
                    className="rounded px-1 py-1.5 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#003087]"
                    style={{ background: meta.bg, color: meta.fg, outline: on ? "3px solid #003087" : "none", outlineOffset: 1 }}
                  >
                    <div className="text-xs font-bold">{MONTH_SHORT[c.month - 1]}</div>
                    <div className="text-xs">{c.score != null ? c.score : "-"}</div>
                  </button>
                );
              })}
            </div>
            <ul className="m-0 mt-2 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[11px] text-[#1c2b3a]">
              {(Object.keys(ASSESSMENT_META) as (keyof typeof ASSESSMENT_META)[]).map(k => (
                <li key={k} className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ASSESSMENT_META[k].bg }} />{ASSESSMENT_META[k].label}</li>
              ))}
              <li className="text-[#5b6672]">Score is out of 100</li>
            </ul>
          </>
        )}
      </Card>

      {anyData && (
        <div className="grid items-start gap-3 lg:grid-cols-2">
          {cal.data.recommendations[month - 1] && <RecommendationCard rec={cal.data.recommendations[month - 1]} />}
          <Card title="Past years: rainfall and temperature by month">
            <div className="space-y-2">
              <BarChart
                title="Average monthly rainfall" unit="mm" height={130}
                data={months.map(m => ({ label: MONTH_SHORT[m.month - 1], value: m.yearsWithData ? m.meanRainMm : null, color: ASSESSMENT_META[calendar[m.month - 1].assessment].bg, note: `${m.yearsWithData} yrs of data, ~${Math.round(m.meanRainyDays)} rainy days` }))}
              />
              <LineChart
                title="Average temperature" unit="°C" height={130} data={months.map(m => ({ label: MONTH_SHORT[m.month - 1], value: m.meanTempMaxC }))}
                extra={months.map(m => ({ label: MONTH_SHORT[m.month - 1], value: m.meanTempMinC }))}
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

const cropLabel = (c: Crop) => (c === "rice" ? "rice" : "corn");

/** [5,6,7,8,9,10] -> "May to October"; [1,2,5] -> "January to February, May" */
function monthRanges(months: number[]) {
  const out: string[] = [];
  let start = months[0], prev = months[0];
  const flush = () => out.push(start === prev ? MONTH_LONG[start - 1] : `${MONTH_LONG[start - 1]} to ${MONTH_LONG[prev - 1]}`);
  for (const m of months.slice(1)) {
    if (m === prev + 1) { prev = m; continue; }
    flush(); start = prev = m;
  }
  flush();
  return out.join(", ");
}

export default memo(CalendarTab);
