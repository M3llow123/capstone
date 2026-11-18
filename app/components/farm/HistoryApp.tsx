"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Download, MapPin, Printer } from "lucide-react";
import { DEFAULT_CLIMATE_OPTIONS } from "../../lib/farm/climate";
import { dailyCsv, monthlyCsv } from "../../lib/farm/history";
import { MONTH_SHORT } from "../../lib/farm/labels";
import { PROVINCES, type Place } from "../../lib/farm/provinces";
import type { DailyHistoryRow, HistoryResponse, MonthlyClimate, YearMonthRow } from "../../lib/farm/types";
import { BarChart, LineChart } from "./charts";
import { Card, CardSkeleton, Empty, ErrorBox, Notice } from "./ui";
import { TTL, useApi } from "./useApi";
import { MAP_POINT, useMapPointName } from "./useMapPointName";

const KEY = "farm-history:v1";
const CUSTOM = "__custom";
const YEAR_CHOICES = [5, 10] as const;
type Years = (typeof YEAR_CHOICES)[number];

const f = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? "-" : v.toFixed(d));
const th = "px-3 py-2 text-xs font-semibold";
const td = "px-3 py-2 text-xs tabular-nums sm:text-sm";
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// The place is shared with the Farm Guide (same storage key), so a province, a map point or typed
// coordinates chosen there show up here, and a province chosen here shows up there.
const FARM_KEY = "farm-guide:v1";
const inPhilippines = (lat: number, lon: number) => lat >= 4.5 && lat <= 21.5 && lon >= 116 && lon <= 127;

function readFarm(): Record<string, unknown> {
  try {
    const j = JSON.parse(localStorage.getItem(FARM_KEY) ?? "null");
    if (j && typeof j === "object") return j;
  } catch { /* storage unavailable */ }
  return {};
}

function loadSaved(): { place: Place | null; years: Years } {
  let years: Years = 10;
  let place: Place | null = null;
  try {
    const own = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (own && typeof own === "object") {
      years = own.years === 5 ? 5 : 10;
      place = PROVINCES.find(p => p.name === own.province) ?? null; // older saves
    }
  } catch { /* storage unavailable: start fresh */ }
  const fp = readFarm().place as Partial<Place> | null | undefined;
  if (fp && typeof fp.lat === "number" && typeof fp.lon === "number" && Number.isFinite(fp.lat) && Number.isFinite(fp.lon) && inPhilippines(fp.lat, fp.lon)) {
    place = { name: typeof fp.name === "string" && fp.name ? fp.name : MAP_POINT, lat: fp.lat, lon: fp.lon };
  }
  return { place, years };
}

/** Save text as a file in the browser. The BOM makes Excel read UTF-8 correctly. */
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob(["\uFEFF", text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const btn = "inline-flex min-h-10 items-center justify-center gap-2 border border-[#9fb1c1] bg-white px-3 py-2 text-sm font-semibold text-[#17476b] hover:bg-[#f4f7f9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#17476b]";

export default function HistoryApp() {
  const [place, setPlace] = useState<Place | null>(null);
  const [years, setYears] = useState<Years>(10);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = loadSaved();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlace(s.place); setYears(s.years); setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify({ years })); } catch { /* ignore */ }
  }, [ready, years]);
  useEffect(() => {
    if (!ready || !place) return;
    try { localStorage.setItem(FARM_KEY, JSON.stringify({ ...readFarm(), place })); } catch { /* ignore */ }
  }, [ready, place]);
  useMapPointName(place, setPlace);

  const url = place ? `/api/farm/history?lat=${place.lat}&lon=${place.lon}&years=${years}` : null;
  // Past weather does not change, so a copy stays fresh for a day.
  const r = useApi<HistoryResponse>(url, TTL.history);

  const field = "min-h-11 w-full border border-[#bdc9d5] bg-white px-3 text-sm text-[#203648] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#17476b]";
  const lbl = "mb-1.5 block text-xs font-semibold text-[#31475a]";
  const isProvince = !!place && PROVINCES.some(p => p.name === place.name);

  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <Card variant="farm">
          <div className="mb-5">
            <p className="m-0 text-[11px] font-bold uppercase tracking-[0.1em] text-[#607487]">Data filters</p>
            <h2 className="m-0 mt-1 text-lg font-bold text-[#172b3a]">Choose a location and time period</h2>
            <p className="m-0 mt-1 text-sm leading-5 text-[#526477]">Select a province and the number of complete years to compare.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-12 md:items-end">
            <div className="md:col-span-6">
              <label className={lbl} htmlFor="hprov">Province</label>
              <select id="hprov" className={field} value={isProvince ? place!.name : place ? CUSTOM : ""}
                onChange={e => { if (e.target.value === CUSTOM) return; setPlace(PROVINCES.find(p => p.name === e.target.value) ?? null); }}>
                <option value="">Choose a province...</option>
                {place && !isProvince && <option value={CUSTOM}>{place.name} ({place.lat.toFixed(2)}, {place.lon.toFixed(2)})</option>}
                {PROVINCES.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className={lbl} htmlFor="hyears">Years of history</label>
              <select id="hyears" className={field} value={years} onChange={e => setYears(Number(e.target.value) === 5 ? 5 : 10)}>
                {YEAR_CHOICES.map(y => <option key={y} value={y}>Last {y} complete years</option>)}
              </select>
            </div>
            <div className="md:col-span-3">
              <button onClick={() => window.print()} className={`${btn} w-full justify-center`}>
                <Printer size={16} /> Print / Save as PDF
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e2e8ed] pt-3">
            <p className="m-0 text-sm text-[#607487]">A location selected in the <Link href="/farm" className="font-semibold text-[#17476b] underline underline-offset-2">Farm Guide</Link> is shared here automatically.</p>
            {place && (
              <p className="m-0 flex items-center gap-1.5 text-xs font-semibold text-[#31475a]">
                <MapPin size={14} aria-hidden /> {place.name} <span className="font-normal tabular-nums text-[#607487]">({place.lat.toFixed(2)}, {place.lon.toFixed(2)})</span>
              </p>
            )}
          </div>
        </Card>
      </div>

      {!place ? (
        ready && <Empty variant="farm">
          <strong className="block text-[#31475a]">Choose a province to get started</strong>
          <span className="mt-1 block">Historical rainfall and temperature summaries will appear here.</span>
        </Empty>
      ) : r.loading ? (
        <div role="status" aria-busy="true" aria-label="Loading historical climate data" className="space-y-4">
          <CardSkeleton lines={7} variant="farm" />
          <CardSkeleton lines={9} variant="farm" />
          <CardSkeleton lines={8} variant="farm" />
          <div className="grid gap-4 lg:grid-cols-2"><CardSkeleton lines={6} variant="farm" /><CardSkeleton lines={6} variant="farm" /></div>
          <CardSkeleton lines={10} variant="farm" />
        </div>
      ) : r.error ? (
        <ErrorBox message={r.error} onRetry={r.refetch} variant="farm" />
      ) : r.data ? (
        <>
          {r.data.provenance.stale && (
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <div className="min-w-0 flex-1">
                <Notice tone="warn">The weather data service could not be reached, so this is the last saved copy from {new Date(r.data.provenance.retrievedAt).toLocaleString("en-PH")}. Past weather does not change, but the copy may be missing recent days.</Notice>
              </div>
              <button onClick={r.refetch} className="min-h-9 border border-[#d1a459] bg-white px-3 py-1.5 text-xs font-semibold text-[#76500d] hover:bg-[#fffaf2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#76500d]">Check again</button>
            </div>
          )}
          <SourcePanel place={place} data={r.data} />
          <MonthlyTable months={r.data.months} minYears={r.data.thresholds.minYears} province={place.name} years={r.data.source.years} />
          <MatrixTable matrix={r.data.matrix} />
          <Charts data={r.data} />
          <RawSample daily={r.data.daily} months={r.data.months} province={place.name} source={r.data.source} />
        </>
      ) : null}

      {place && <Methods data={r.data} />}

      <p className="m-0 border-t border-[#d5dde5] pt-4 text-xs leading-5 text-[#607487]">
        Data: <a className="font-medium text-[#17476b] underline underline-offset-2" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo.com</a> (CC BY 4.0), built on ERA5 reanalysis from ECMWF / Copernicus. These are modeled data, not official PAGASA observations. For official data and warnings, visit <a className="font-medium text-[#17476b] underline underline-offset-2" href="https://www.pagasa.dost.gov.ph/" target="_blank" rel="noreferrer">PAGASA</a>.
      </p>
    </div>
  );
}

function SourcePanel({ place, data }: { place: Place; data: HistoryResponse }) {
  const { source: s, provenance: p } = data;
  const c = p.coordinatesUsed;
  const missing = data.daily.filter(d => d.precipitationMm == null).length;
  const rows: [string, ReactNode][] = [
    ["Province", place.name],
    ["Coordinates used", `${c.lat.toFixed(2)}, ${c.lon.toFixed(2)} (latitude, longitude)`],
    ["Data source", `${s.name}: ${s.dataset}. Licence ${s.license}.`],
    ["Period covered", `${s.periodStart} to ${s.periodEnd} (${s.years} complete years)`],
    ["Date retrieved", new Date(p.retrievedAt).toLocaleString("en-PH")],
    ["Days returned", `${s.days.toLocaleString("en-PH")} days (${missing.toLocaleString("en-PH")} without a rainfall value)`],
  ];
  return (
    <div className="print:break-inside-avoid">
      <Card variant="farm" title="Source and traceability">
        <dl className="m-0 grid gap-x-4 gap-y-2 text-sm text-[#31475a] sm:grid-cols-[11rem_1fr]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-semibold text-[#526477]">{k}</dt>
              <dd className="m-0">{v}</dd>
            </div>
          ))}
          <dt className="font-semibold text-[#526477]">Request URL</dt>
          <dd className="m-0 min-w-0">
            <a href={s.url} target="_blank" rel="noreferrer" className="break-all text-xs text-[#17476b] underline underline-offset-2">{s.url}</a>
            <span className="mt-1 block text-xs leading-5 text-[#607487]">This is the exact request our server sent. Open it to compare the raw values.</span>
          </dd>
        </dl>
        <div className="mt-2">
          <Notice tone="warn">This is modeled grid data, not PAGASA station readings. Each value describes a grid cell (Open-Meteo lists ERA5 at about 25 km and ERA5-Land at about 11 km), so it can differ from what a rain gauge in the province recorded.</Notice>
        </div>
      </Card>
    </div>
  );
}

function MonthlyTable({ months, minYears, province, years }: { months: MonthlyClimate[]; minYears: number; province: string; years: number }) {
  const heads = ["Month", "Avg rainfall (mm)", "Rainy days", "Heavy-rain days", "Longest dry spell (days)", "Avg daily high (°C)", "Avg daily low (°C)", "Avg daily mean (°C)", "Avg max wind (km/h)", "Years with data"];
  return (
    <Card variant="farm" title="Monthly summary">
    <div role="region" aria-label="Monthly climate summary table" tabIndex={0} className="overflow-x-auto border-y border-[#e3e8ee] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#17476b]">
      <table className="w-full min-w-[46rem] border-collapse text-sm text-[#31475a]">
        <caption className="mb-2 text-left text-xs leading-5 text-[#607487]">{province}: each row averages that calendar month over the last {years} complete years. Rainy days, heavy-rain days and dry spell are per month.</caption>
          <thead>
          <tr className="bg-[#f4f7f9] text-right">
              {heads.map((h, i) => <th key={h} scope="col" className={`${th} ${i === 0 ? "text-left" : ""}`}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {months.map(m => {
              const low = m.yearsWithData < minYears;
              return (
              <tr key={m.month} className="border-t border-[#e3e8ee] text-right" style={{ background: low ? "#fff6e8" : undefined }}>
                <th scope="row" className="px-3 py-2 text-left font-semibold">{MONTH_SHORT[m.month - 1]}</th>
                  <td className={td}>{m.yearsWithData ? f(m.meanRainMm) : "-"}</td>
                  <td className={td}>{m.yearsWithData ? f(m.meanRainyDays) : "-"}</td>
                  <td className={td}>{m.yearsWithData ? f(m.meanHeavyRainDays, 2) : "-"}</td>
                  <td className={td}>{m.yearsWithData ? f(m.meanLongestDrySpellDays) : "-"}</td>
                  <td className={td}>{f(m.meanTempMaxC)}</td>
                  <td className={td}>{f(m.meanTempMinC)}</td>
                  <td className={td}>{f(m.meanTempC)}</td>
                  <td className={td}>{f(m.meanWindMaxKmh)}</td>
                  <td className={td}>{m.yearsWithData}{low && <span title={`Fewer than ${minYears} years: not used for planting scores`}> *</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="m-0 mt-3 text-xs leading-5 text-[#607487]">* Fewer than {minYears} usable years, so this month is not used for planting scores.</p>
    </Card>
  );
}

function MatrixTable({ matrix }: { matrix: YearMonthRow[] }) {
  return (
    <Card variant="farm" title="Rainfall by year and month (mm)">
      <div role="region" aria-label="Rainfall by year and month table" tabIndex={0} className="overflow-x-auto border-y border-[#e3e8ee] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#17476b]">
        <table className="w-full min-w-[46rem] border-collapse text-sm text-[#31475a]">
          <caption className="mb-2 text-left text-xs leading-5 text-[#607487]">Total rainfall for each month of each year, with the yearly total on the right.</caption>
          <thead>
            <tr className="bg-[#f4f7f9] text-right">
              <th scope="col" className={`${th} text-left`}>Year</th>
              {MONTH_SHORT.map(m => <th key={m} scope="col" className={th}>{m}</th>)}
              <th scope="col" className={th}>Total</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map(row => (
              <tr key={row.year} className="border-t border-[#e3e8ee] text-right">
                <th scope="row" className="px-3 py-2 text-left font-semibold">{row.year}</th>
                {row.months.map((c, i) => (
                  <td key={i} className={td} style={{ background: c.complete ? undefined : "#fff6e8" }}
                    title={c.complete ? undefined : `Incomplete: ${c.daysWithData} of ${c.daysInMonth} days have data`}>
                    {c.totalMm == null ? "-" : Math.round(c.totalMm)}
                    {!c.complete && <><span aria-hidden>*</span><span className="sr-only"> (incomplete month)</span></>}
                  </td>
                ))}
                <td className={`${td} font-bold`} style={{ background: row.complete ? undefined : "#fff6e8" }}>
                  {row.totalMm == null ? "-" : Math.round(row.totalMm)}
                  {!row.complete && <><span aria-hidden>*</span><span className="sr-only"> (includes incomplete months)</span></>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="m-0 mt-3 text-xs leading-5 text-[#607487]">* Incomplete month: too many days without data, so the total is understated and that year is left out of the monthly averages. A yearly total with * includes such a month.</p>
    </Card>
  );
}

function Charts({ data }: { data: HistoryResponse }) {
  const { months, matrix } = data;
  const has = (m: MonthlyClimate) => m.yearsWithData > 0;
  const label = (m: MonthlyClimate) => MONTH_SHORT[m.month - 1];
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2 print:break-inside-avoid">
      <Card variant="farm">
        <BarChart title="Average monthly rainfall" unit="mm" data={months.map(m => ({ label: label(m), value: has(m) ? m.meanRainMm : null, note: `${m.yearsWithData} years` }))} />
      </Card>
      <Card variant="farm">
        <BarChart title="Total rainfall per year" unit="mm" barColor="#2e7d32"
          data={matrix.map(y => ({ label: String(y.year), value: y.totalMm, color: y.complete ? undefined : "#ef8a1f", note: y.complete ? undefined : "includes incomplete months" }))} />
        <p className="m-0 mt-2 text-xs text-[#607487]">Orange bars include an incomplete month.</p>
      </Card>
      <Card variant="farm">
        <LineChart title="Average daily mean temperature" unit="°C" data={months.map(m => ({ label: label(m), value: m.meanTempC }))} />
      </Card>
      <Card variant="farm">
        <LineChart title="Average daily high and low temperature" unit="°C"
          data={months.map(m => ({ label: label(m), value: m.meanTempMaxC }))}
          extra={months.map(m => ({ label: label(m), value: m.meanTempMinC }))} />
      </Card>
    </div>
  );
}

function RawSample({ daily, months, province, source }: { daily: DailyHistoryRow[]; months: MonthlyClimate[]; province: string; source: HistoryResponse["source"] }) {
  const N = 15;
  const all = daily.length <= N * 2;
  const shown = all ? daily : [...daily.slice(0, N), ...daily.slice(-N)];
  const base = `farm-history-${slug(province)}`;
  const span = `${source.periodStart.slice(0, 4)}-${source.periodEnd.slice(0, 4)}`;
  const heads = ["Date", "Rain (mm)", "High (°C)", "Low (°C)", "Mean (°C)", "Max wind (km/h)"];
  const row = (d: DailyHistoryRow) => (
    <tr key={d.date} className="border-t border-[#e3e8ee] text-right">
      <th scope="row" className="px-2 py-1 text-left font-normal tabular-nums">{d.date}</th>
      <td className={td}>{f(d.precipitationMm)}</td><td className={td}>{f(d.tempMaxC)}</td><td className={td}>{f(d.tempMinC)}</td>
      <td className={td}>{f(d.tempMeanC)}</td><td className={td}>{f(d.windSpeedMaxKmh)}</td>
    </tr>
  );
  return (
    <Card variant="farm" title="Raw daily data sample" right={
      <div className="flex flex-wrap gap-2 print:hidden">
        <button className={btn} onClick={() => download(`${base}-daily-${span}.csv`, dailyCsv(daily))}><Download size={15} /> Download full daily data (CSV)</button>
        <button className={btn} onClick={() => download(`${base}-monthly-summary-${span}.csv`, monthlyCsv(months))}><Download size={15} /> Download monthly summary (CSV)</button>
      </div>
    }>
      <div role="region" aria-label="Raw daily data sample table" tabIndex={0} className="overflow-x-auto border-y border-[#e3e8ee] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#17476b]">
        <table className="w-full min-w-[30rem] border-collapse text-sm text-[#31475a]">
          <caption className="mb-2 text-left text-xs leading-5 text-[#607487]">{all ? `All ${daily.length} daily rows.` : `First ${N} and last ${N} of ${daily.length.toLocaleString("en-PH")} daily rows. The CSV has every row.`}</caption>
          <thead>
            <tr className="bg-[#f4f7f9] text-right">
              {heads.map((h, i) => <th key={h} scope="col" className={`${th} ${i === 0 ? "text-left" : ""}`}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, all ? undefined : N).map(row)}
            {!all && (
              <tr className="border-t border-[#e3e8ee]"><td colSpan={6} className="bg-[#f4f7f9] px-3 py-2 text-center text-xs text-[#607487]">... {(daily.length - N * 2).toLocaleString("en-PH")} rows not shown ...</td></tr>
            )}
            {!all && shown.slice(N).map(row)}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Methods({ data }: { data: HistoryResponse | null }) {
  // Always the values the summary was computed with; before the data arrives, the shared defaults.
  const o = data?.thresholds ?? DEFAULT_CLIMATE_OPTIONS;
  const items: [string, string][] = [
    ["Rainy day", `A day with at least ${o.rainyDayMm} mm of rain.`],
    ["Heavy-rain day", `A day with at least ${o.heavyDayMm} mm of rain.`],
    ["Wet month", `A month whose total rainfall is at least ${o.heavyMonthMm} mm counts as excessively wet.`],
    ["Minimum data coverage", `A month counts for a year only if at least ${Math.round(o.minDayCoverage * 100)}% of its days have rainfall data. Other months are marked incomplete.`],
    ["Minimum years", `A calendar month needs at least ${o.minYears} usable years before it is used for a planting score.`],
    ["Longest dry spell", `The longest run of days below the rainy-day amount in a month, averaged over the years.`],
  ];
  return (
    <div className="print:break-inside-avoid">
      <Card variant="farm" title="Methods">
        <dl className="m-0 grid gap-x-4 gap-y-2 text-sm text-[#31475a] sm:grid-cols-[11rem_1fr]">
          {items.map(([k, v]) => (
            <div key={k} className="contents"><dt className="font-semibold text-[#526477]">{k}</dt><dd className="m-0">{v}</dd></div>
          ))}
        </dl>
        <p className="m-0 mt-3 text-xs leading-5 text-[#526477]">
          How this feeds the planting score: the monthly averages for rainfall and temperature are compared with each crop&apos;s ideal range, while dry spells (rainfed fields), heavy-rain days and wet months lower the score. Months with fewer than {o.minYears} usable years are not scored.
        </p>
      </Card>
    </div>
  );
}
