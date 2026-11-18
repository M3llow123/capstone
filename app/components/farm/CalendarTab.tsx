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
  if (cal.error) return <ErrorBox message={cal.error} onRetry={cal.refetch} variant="farm" />;
  if (!cal.data) return null;
  const { calendar, months } = cal.data;
  const anyData = calendar.some(c => c.assessment !== "insufficient_data");
  const good = calendar.filter(c => c.assessment === "favorable").map(c => c.month);
  const bestText = good.length ? monthRanges(good) : null;

  return (
    <div className="space-y-3">
      <Card variant="farm" title="Planting calendar" right={<span className="text-xs text-[#607487]">Select a month for details</span>}>
        {!anyData && <Empty variant="farm">Not enough historical weather is available for this location yet.</Empty>}
        {anyData && (
          <>
            <p className="m-0 mb-4 border-l-2 border-[#5b879f] bg-[#f5f8fa] px-3 py-2.5 text-sm leading-5 text-[#31475a]">
              {bestText
                ? <>Best months to plant {cropLabel(crop)}: <strong className="text-[#24603d]">{bestText}</strong>.</>
                : <>No month is rated fully favorable here. Select a month to review its assessment and guidance.</>}
            </p>
            <div className="grid grid-cols-4 gap-2 min-[420px]:grid-cols-6 sm:grid-cols-12">
              {calendar.map(c => {
                const meta = ASSESSMENT_META[c.assessment];
                const on = month === c.month;
                return (
                  <button
                    key={c.month}
                    type="button"
                    onClick={() => setMonth(c.month)}
                    aria-pressed={on}
                    aria-label={`${MONTH_LONG[c.month - 1]}: ${meta.label}${c.score != null ? `, score ${c.score}` : ""}`}
                    title={meta.label}
                    className={`min-h-14 border px-1 py-1.5 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#17476b] focus-visible:ring-offset-1 ${on ? "border-[#17476b] ring-2 ring-[#17476b] ring-offset-1" : "border-white/80 hover:border-[#9fb1c1]"}`}
                    style={{ background: meta.bg, color: meta.fg }}
                  >
                    <div className="text-xs font-bold">{MONTH_SHORT[c.month - 1]}</div>
                    <div className="mt-0.5 text-[11px] tabular-nums">{c.score != null ? c.score : "No score"}</div>
                  </button>
                );
              })}
            </div>
            <ul className="m-0 mt-3 flex list-none flex-wrap gap-x-4 gap-y-2 border-t border-[#e4e9ee] p-0 pt-3 text-xs text-[#526477]">
              {(Object.keys(ASSESSMENT_META) as (keyof typeof ASSESSMENT_META)[]).map(k => (
                <li key={k} className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 border border-black/10" style={{ background: ASSESSMENT_META[k].bg }} />{ASSESSMENT_META[k].label}</li>
              ))}
              <li>Score is out of 100</li>
            </ul>
          </>
        )}
      </Card>

      {anyData && (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          {cal.data.recommendations[month - 1] && <RecommendationCard rec={cal.data.recommendations[month - 1]} />}
          <Card variant="farm" title="Climate by month">
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
