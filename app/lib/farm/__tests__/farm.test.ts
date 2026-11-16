// Run: npx tsx --test app/lib/farm/__tests__/farm.test.ts
// All network calls are mocked: tests never contact Open-Meteo.
import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CLIMATE_OPTIONS, summarizeMonthly, yearMonthRainfall } from "../climate";
import { buildHistoryResponse, csvField, dailyCsv, monthlyCsv, toCsv } from "../history";
import { recommend, trapezoid, buildCalendar, buildCalendarDetailed } from "../recommendation";
import { parseForecast, getForecast, getDailyHistory, historyRequest } from "../openMeteo";
import { fetchJson } from "../http";
import { cached, clearFarmCache } from "../cache";
import { parseCoordinates } from "../validation";
import type { DailyHistoryRow, MonthlyClimate } from "../types";

const coords = { lat: 14.6, lon: 121 };

/** Build N years of daily rows; rain(month, day, year) -> mm */
function history(years: number[], rain: (m: number, d: number, y: number) => number, temp = 27): DailyHistoryRow[] {
  const rows: DailyHistoryRow[] = [];
  for (const y of years) for (let m = 1; m <= 12; m++) {
    const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
    for (let d = 1; d <= n; d++) rows.push({
      date: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      precipitationMm: rain(m, d, y), tempMaxC: temp + 4, tempMinC: temp - 4, tempMeanC: temp, windSpeedMaxKmh: 20,
    });
  }
  return rows;
}
const YEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

test("trapezoid scoring", () => {
  const r = { min: 0, optMin: 10, optMax: 20, max: 30 };
  assert.equal(trapezoid(15, r), 100);
  assert.equal(trapezoid(5, r), 50);
  assert.equal(trapezoid(25, r), 50);
  assert.equal(trapezoid(-1, r), 0);
  assert.equal(trapezoid(30, r), 0);
});

test("coordinates must be inside the Philippines and are rounded", () => {
  assert.deepEqual(parseCoordinates("14.6012", "121.0049"), { lat: 14.6, lon: 121 });
  assert.equal(parseCoordinates("48.8", "2.3"), null);
  assert.equal(parseCoordinates("abc", "121"), null);
  assert.equal(parseCoordinates(null, null), null);
});

test("monthly summary: totals, rainy/dry days, dry spell, incomplete years skipped", () => {
  // January: rain 10 mm on days 1-5, then dry (26 dry days, 1 spell of 26)
  const rows = history(YEARS, (m, d) => (m === 1 && d <= 5 ? 10 : m === 7 ? 20 : 0));
  const { months } = summarizeMonthly(rows);
  const jan = months[0];
  assert.equal(jan.yearsWithData, 10);
  assert.equal(jan.meanRainMm, 50);
  assert.equal(jan.meanRainyDays, 5);
  assert.equal(jan.meanDryDays, 26);
  assert.equal(jan.meanLongestDrySpellDays, 26);
  assert.equal(months[6].meanRainMm, 620);
  assert.equal(months[6].heavyMonthShare, 1); // 620 >= 600 mm
  // drop most of 2025 -> that year no longer counts
  const partial = rows.filter(r => !(r.date.startsWith("2025-01") && Number(r.date.slice(8)) > 10));
  assert.equal(summarizeMonthly(partial).months[0].yearsWithData, 9);
});

test("rice June with good rain is favorable; scoring is explainable", () => {
  const rows = history(YEARS, (m) => (m === 6 || m === 7 ? 11 : 1), 28); // ~330 mm/mo in Jun-Jul
  const climate = summarizeMonthly(rows).months;
  const rec = recommend({ crop: "rice", irrigation: "rainfed", plantingMonth: 6, coordinates: coords, mode: "historical", climate });
  assert.ok(["favorable", "moderately_favorable"].includes(rec.assessment), rec.assessment);
  assert.ok(rec.score! >= 60);
  assert.equal(rec.factors.find(f => f.key === "forecast")!.score, null); // not used historically
  assert.equal(rec.thresholdsValidated, false);
  assert.match(rec.disclaimer, /not an official government classification/);
});

test("rice and corn are scored with different requirements", () => {
  const rows = history(YEARS, () => 4, 28); // ~120 mm/month: low for rice, good for corn
  const climate = summarizeMonthly(rows).months;
  const base = { irrigation: "rainfed" as const, plantingMonth: 3, coordinates: coords, mode: "historical" as const, climate };
  const rice = recommend({ ...base, crop: "rice" });
  const corn = recommend({ ...base, crop: "corn" });
  assert.ok(corn.score! > rice.score!, `corn ${corn.score} should beat rice ${rice.score}`);
});

test("missing climate -> insufficient data, never a confident score", () => {
  const rec = recommend({ crop: "rice", irrigation: "rainfed", plantingMonth: 6, coordinates: coords, mode: "historical", climate: null });
  assert.equal(rec.assessment, "insufficient_data");
  assert.equal(rec.score, null);
  assert.ok(rec.insufficientReasons.length > 0);
});

test("extreme rainfall scenario is high risk", () => {
  const climate = summarizeMonthly(history(YEARS, (m) => (m === 8 ? 60 : 3), 28)).months; // 1860 mm in August
  const rec = recommend({ crop: "corn", irrigation: "rainfed", plantingMonth: 8, coordinates: coords, mode: "historical", climate });
  assert.ok(["less_favorable", "high_risk"].includes(rec.assessment), rec.assessment);
  assert.ok(rec.risks.some(r => /excessive|waterlogging/i.test(r)));
});

test("dry-spell scenario flags water risk for rainfed, not for irrigated", () => {
  // rain falls only on 1 day in 15 -> long dry spells, monthly total ~ 120 mm
  const rain = (_m: number, d: number) => (d % 15 === 0 ? 60 : 0);
  const climate = summarizeMonthly(history(YEARS, rain, 28)).months;
  const base = { crop: "rice" as const, plantingMonth: 2, coordinates: coords, mode: "historical" as const, climate };
  const rainfed = recommend({ ...base, irrigation: "rainfed" });
  const irrigated = recommend({ ...base, irrigation: "irrigated" });
  assert.ok(rainfed.factors.find(f => f.key === "water")!.score! < 60);
  assert.ok(rainfed.risks.some(r => /dry spell/i.test(r)));
  assert.ok(irrigated.factors.find(f => f.key === "water")!.score! >= 85);
});

test("official warning caps the assessment and is attributed as official", () => {
  const climate = summarizeMonthly(history(YEARS, () => 11, 28)).months;
  const base = { crop: "rice" as const, irrigation: "irrigated" as const, plantingMonth: 6, coordinates: coords, mode: "historical" as const, climate };
  const without = recommend(base);
  const withWarn = recommend({ ...base, advisories: [{ title: "Tropical Cyclone Wind Signal", severity: "warning" }] });
  assert.ok(withWarn.score! < without.score!);
  assert.ok(["less_favorable", "high_risk"].includes(withWarn.assessment));
  assert.ok(withWarn.risks.some(r => r.startsWith("Official advisory in effect")));
});

test("current mode needs a forecast and refuses far-away months", () => {
  const climate = summarizeMonthly(history(YEARS, () => 11, 28)).months;
  const now = new Date("2026-06-10T00:00:00Z");
  const base = { crop: "rice" as const, irrigation: "rainfed" as const, coordinates: coords, mode: "current" as const, climate, now };
  assert.equal(recommend({ ...base, plantingMonth: 6, forecast: null }).assessment, "insufficient_data");
  const daily = Array.from({ length: 16 }, (_, i) => ({ date: `2026-06-${10 + i}`, weatherCode: 61, tempMaxC: 31, tempMinC: 24, precipitationSumMm: 10, precipitationProbabilityMaxPct: 70, windSpeedMaxKmh: 15, windGustsMaxKmh: 30 }));
  const ok = recommend({ ...base, plantingMonth: 6, forecast: { current: null, hourly: [], daily, timezone: "Asia/Manila" } });
  assert.notEqual(ok.assessment, "insufficient_data");
  assert.equal(ok.factors.find(f => f.key === "forecast")!.score !== null, true);
  const far = recommend({ ...base, plantingMonth: 11, forecast: { current: null, hourly: [], daily, timezone: "Asia/Manila" } });
  assert.equal(far.assessment, "insufficient_data");
  assert.ok(far.insufficientReasons.some(r => /16 days/.test(r)));
});

test("calendar returns 12 months and grays out months without data", () => {
  const climate: MonthlyClimate[] = summarizeMonthly(history(YEARS, () => 8, 28)).months;
  const cal = buildCalendar({ crop: "corn", irrigation: "rainfed", coordinates: coords, climate });
  assert.equal(cal.length, 12);
  const empty = buildCalendar({ crop: "corn", irrigation: "rainfed", coordinates: coords, climate: null });
  assert.ok(empty.every(e => e.assessment === "insufficient_data"));
});

test("parseForecast handles provider payloads and missing values", () => {
  const f = parseForecast({
    timezone: "Asia/Manila",
    current: { time: "2026-06-10T10:00", temperature_2m: 30.1, relative_humidity_2m: 80, wind_gusts_10m: null },
    hourly: { time: ["2026-06-10T10:00"], temperature_2m: [30], precipitation_probability: [null] },
    daily: { time: ["2026-06-10"], precipitation_sum: [12.5], temperature_2m_max: [32] },
  });
  assert.equal(f.current!.temperatureC, 30.1);
  assert.equal(f.current!.windGustsKmh, null);
  assert.equal(f.hourly[0].precipitationProbabilityPct, null);
  assert.equal(f.daily[0].precipitationSumMm, 12.5);
});

// ---- network behaviour with mocked fetch ----
const realFetch = globalThis.fetch;
const mock = (fn: typeof fetch) => { globalThis.fetch = fn; };
test.afterEach(() => { globalThis.fetch = realFetch; clearFarmCache(); });

test("fetchJson retries on 503 then succeeds", async () => {
  let n = 0;
  mock((async () => (++n < 2 ? new Response("", { status: 503 }) : new Response('{"a":1}', { status: 200 }))) as typeof fetch);
  assert.deepEqual(await fetchJson("https://x.test", { retries: 1 }), { a: 1 });
  assert.equal(n, 2);
});

test("fetchJson times out", async () => {
  mock(((_u: unknown, init?: RequestInit) => new Promise((_res, rej) => init!.signal!.addEventListener("abort", () => rej(Object.assign(new Error("a"), { name: "AbortError" }))))) as typeof fetch);
  await assert.rejects(fetchJson("https://x.test", { timeoutMs: 20, retries: 0 }), (e: { code: string }) => e.code === "timeout");
});

test("fetchJson does not retry a 4xx", async () => {
  let n = 0;
  mock((async () => { n++; return new Response("", { status: 400 }); }) as typeof fetch);
  await assert.rejects(fetchJson("https://x.test", { retries: 3 }));
  assert.equal(n, 1);
});

test("services return ok:false (never fake data) when providers are down", async () => {
  mock((async () => { throw new TypeError("fetch failed"); }) as typeof fetch);
  const f = await getForecast(coords);
  const h = await getDailyHistory(coords, 3);
  for (const r of [f, h]) { assert.equal(r.ok, false); }
});

test("forecast responses are cached (second call makes no request)", async () => {
  let calls = 0;
  const payload = { timezone: "Asia/Manila", daily: { time: ["2026-06-10"], precipitation_sum: [1] } };
  mock((async () => { calls++; return new Response(JSON.stringify(payload), { status: 200 }); }) as typeof fetch);
  const a = await getForecast(coords);
  const b = await getForecast(coords);
  assert.equal(calls, 1);
  assert.ok(a.ok && b.ok);
});

// ---- performance behaviour ----
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

test("cache: an expired entry is served instantly while it refreshes in the background", async () => {
  let n = 0;
  const load = async () => { n++; await sleep(40); return `v${n}`; };
  assert.equal((await cached("k", 20, load, { swrMs: 1000 })).value, "v1");
  await sleep(30); // past the ttl, inside the swr window
  const t0 = Date.now();
  const hit = await cached("k", 20, load, { swrMs: 1000 });
  assert.equal(hit.value, "v1"); // old value, no waiting
  assert.ok(Date.now() - t0 < 25);
  assert.equal(hit.stale, false);
  await sleep(80);
  assert.equal(n, 2); // exactly one background refresh so far
  assert.equal((await cached("k", 20, load, { swrMs: 1000 })).value, "v2"); // the refresh landed
});

test("cache: a failed refresh keeps serving the old value", async () => {
  await cached("k2", 5, async () => "good");
  await sleep(15);
  const r = await cached("k2", 5, async () => { throw new Error("down"); });
  assert.deepEqual([r.value, r.stale], ["good", true]);
});

test("cache: concurrent callers share one request", async () => {
  let n = 0;
  const load = async () => { n++; await sleep(20); return 1; };
  await Promise.all([cached("k3", 1000, load), cached("k3", 1000, load), cached("k3", 1000, load)]);
  assert.equal(n, 1);
});

test("fetchJson does not retry a timeout unless asked to", async () => {
  let n = 0;
  mock(((_u: unknown, init?: RequestInit) => { n++; return new Promise((_res, rej) => init!.signal!.addEventListener("abort", () => rej(Object.assign(new Error("a"), { name: "AbortError" })))); }) as typeof fetch);
  await assert.rejects(fetchJson("https://x.test", { timeoutMs: 10, retries: 2 }), (e: { code: string }) => e.code === "timeout");
  assert.equal(n, 1);
});

test("forecast asks only for the hourly values the Weather tab shows", async () => {
  let url = "";
  mock((async (u: string | URL | Request) => { url = String(u); return new Response(JSON.stringify({ timezone: "Asia/Manila", daily: { time: ["2026-06-10"] } }), { status: 200 }); }) as typeof fetch);
  await getForecast(coords);
  const hourly = new URL(url).searchParams.get("hourly");
  assert.equal(hourly, "precipitation_probability,precipitation,wind_gusts_10m");
});

test("calendar detail: 12 full recommendations that match the calendar tiles", () => {
  const climate = summarizeMonthly(history(YEARS, () => 8, 28)).months;
  const base = { crop: "corn" as const, irrigation: "rainfed" as const, coordinates: coords, climate };
  const { calendar, recommendations } = buildCalendarDetailed(base);
  assert.deepEqual(calendar, buildCalendar(base));
  assert.equal(recommendations.length, 12);
  recommendations.forEach((r, i) => { assert.equal(r.plantingMonth, i + 1); assert.equal(r.score, calendar[i].score); });
});

// ---- Historical Climate Data page ----
test("year-by-month matrix: totals, missing months and incomplete months", () => {
  const rows = history(YEARS, (m, d) => (m === 1 && d <= 5 ? 10 : 0)).filter(r =>
    !(r.date.startsWith("2023-03")) &&                                           // whole month missing
    !(r.date.startsWith("2025-01") && Number(r.date.slice(8)) > 10)              // 10 of 31 days left
  );
  const matrix = yearMonthRainfall(rows);
  assert.deepEqual(matrix.map(y => y.year), YEARS); // one row per year, oldest first
  assert.ok(matrix.every(y => y.months.length === 12));

  const y2024 = matrix.find(y => y.year === 2024)!;
  assert.equal(y2024.months[0].totalMm, 50);
  assert.equal(y2024.months[0].daysInMonth, 31);
  assert.equal(y2024.months[1].daysInMonth, 29); // leap year
  assert.equal(y2024.totalMm, 50);
  assert.equal(y2024.complete, true);

  const m2023 = matrix.find(y => y.year === 2023)!.months[2];
  assert.deepEqual(m2023, { totalMm: null, daysWithData: 0, daysInMonth: 31, complete: false });
  assert.equal(matrix.find(y => y.year === 2023)!.complete, false);

  const jan2025 = matrix.find(y => y.year === 2025)!.months[0];
  assert.equal(jan2025.daysWithData, 10);
  assert.equal(jan2025.totalMm, 50); // partial total is still shown...
  assert.equal(jan2025.complete, false); // ...but flagged
  assert.equal(matrix.find(y => y.year === 2025)!.complete, false);

  // the matrix and the monthly summary agree on which months were usable
  const { months } = summarizeMonthly(rows);
  for (let m = 0; m < 12; m++) {
    assert.equal(matrix.filter(y => y.months[m].complete).length, months[m].yearsWithData);
  }
});

test("year-by-month matrix: a day without a rainfall value does not count as data", () => {
  const rows = history([2024], () => 2).map(r => (r.date.startsWith("2024-02") && Number(r.date.slice(8)) <= 4 ? { ...r, precipitationMm: null } : r));
  const feb = yearMonthRainfall(rows)[0].months[1];
  assert.equal(feb.daysWithData, 25); // 29 - 4
  assert.equal(feb.totalMm, 50);
  assert.equal(feb.complete, false); // 25/29 = 86% < 90%
  assert.equal(yearMonthRainfall(rows, { minDayCoverage: 0.8 })[0].months[1].complete, true);
});

test("CSV builder quotes, empties and line endings", () => {
  assert.equal(csvField(null), "");
  assert.equal(csvField(undefined), "");
  assert.equal(csvField(0), "0");
  assert.equal(csvField("a,b"), '"a,b"');
  assert.equal(csvField('say "hi"'), '"say ""hi"""');
  assert.equal(csvField("two\nlines"), '"two\nlines"');
  assert.equal(toCsv(["a", "b"], [[1, null], ["x,y", 2.5]]), 'a,b\r\n1,\r\n"x,y",2.5\r\n');
});

test("daily and monthly CSV exports contain every row with the right columns", () => {
  const rows = history([2024], (m, d) => (m === 1 && d === 1 ? 12.5 : 0));
  rows[1] = { ...rows[1], precipitationMm: null };
  const lines = dailyCsv(rows).trimEnd().split("\r\n");
  assert.equal(lines.length, 1 + 366); // header + every day of 2024
  assert.equal(lines[0], "date,rain_mm,tmax_c,tmin_c,tmean_c,wind_max_kmh");
  assert.equal(lines[1], "2024-01-01,12.5,31,23,27,20");
  assert.equal(lines[2], "2024-01-02,,31,23,27,20"); // missing rain stays empty, never 0
  assert.equal(lines[366], "2024-12-31,0,31,23,27,20");

  const m = monthlyCsv(summarizeMonthly(history(YEARS, (mo, d) => (mo === 1 && d <= 5 ? 10 : 0))).months).trimEnd().split("\r\n");
  assert.equal(m.length, 13);
  assert.ok(m[0].startsWith("month,years_with_data,avg_rain_mm"));
  assert.ok(m[1].startsWith("Jan,10,50,5,0,26,26,31,23,27,20"));
  assert.ok(m[12].startsWith("Dec,10,0,0,0,31,31,"));
});

test("history payload uses exactly the same monthly numbers as /api/farm/climate", () => {
  const rows = history(YEARS, (m, d) => (m >= 6 && m <= 9 ? (d % 3 === 0 ? 30 : 2) : 0.5));
  const prov = { source: "Open-Meteo" as const, kind: "historical-reanalysis" as const, coordinatesUsed: coords, retrievedAt: "2026-11-14T00:00:00.000Z" };
  const res = buildHistoryResponse(rows, prov, { url: "https://archive-api.open-meteo.com/v1/archive?x=1", years: 10 });
  assert.deepEqual(res.months, summarizeMonthly(rows).months); // the climate route returns summarizeMonthly(rows).months
  assert.deepEqual(res.thresholds, DEFAULT_CLIMATE_OPTIONS);
  assert.equal(res.source.days, rows.length);
  assert.equal(res.source.periodStart, "2016-01-01");
  assert.equal(res.source.periodEnd, "2025-12-31");
  assert.equal(res.matrix.length, 10);
  assert.equal(res.daily, rows);
});

test("history page request URL is the one that is fetched, and reuses the shared cache", async () => {
  const now = new Date(Date.UTC(2026, 10, 14));
  const req = historyRequest(coords, 10, now);
  const u = new URL(req.url);
  assert.equal(u.origin + u.pathname, "https://archive-api.open-meteo.com/v1/archive");
  assert.equal(u.searchParams.get("start_date"), "2016-01-01");
  assert.equal(u.searchParams.get("end_date"), "2025-12-31"); // last COMPLETE year
  assert.equal(u.searchParams.get("latitude"), "14.6");
  assert.equal(historyRequest(coords, 5, now).firstYear, 2021);

  const urls: string[] = [];
  const payload = { daily: { time: ["2025-12-31"], precipitation_sum: [3], temperature_2m_max: [30], temperature_2m_min: [24], temperature_2m_mean: [27], wind_speed_10m_max: [15] } };
  mock((async (x: string | URL | Request) => { urls.push(String(x)); return new Response(JSON.stringify(payload), { status: 200 }); }) as typeof fetch);
  const a = await getDailyHistory(coords, 10, now); // e.g. the calendar
  const b = await getDailyHistory(coords, 10, now); // then the history page
  assert.ok(a.ok && b.ok);
  assert.equal(urls.length, 1); // no duplicate Open-Meteo request
  assert.equal(urls[0], req.url);
});
