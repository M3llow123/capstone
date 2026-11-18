// Explainable planting recommendation engine.
//
// Two different questions, never mixed up:
//  - "historical": is this MONTH generally favorable, judged from multi-year climate stats?
//  - "current":    is it advisable to plant in the next several days, judged from the same
//                  climatology PLUS the short-range forecast (about 16 days at most)?
//
// Each factor yields a 0-100 score (or null when its data is missing). The overall score is
// the weighted mean of the available factors; missing essential data produces an
// "insufficient_data" result instead of a guess. All thresholds live in cropProfiles.ts.

import type { ClimateOptions } from "./climate";
import { CROP_PROFILES, DEFAULT_SCORING, type CropProfile, type Range, type ScoringConfig } from "./cropProfiles";
import type {
  Assessment, Coordinates, Crop, FactorResult, Forecast, Irrigation, MonthlyClimate, Recommendation,
} from "./types";

export const DISCLAIMER =
  "This is an application-generated assessment, not an official government classification. Historical suitability does not guarantee future weather or crop success. Forecast confidence drops as the forecast period gets longer. Confirm with your local agricultural office.";

export interface RecommendInput {
  crop: Crop;
  irrigation: Irrigation;
  plantingMonth: number;
  coordinates: Coordinates;
  mode: "historical" | "current";
  climate: MonthlyClimate[] | null;
  climateMinYears?: number;
  forecast?: Forecast | null;
  now?: Date;
  profile?: CropProfile;
  config?: ScoringConfig;
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/** 0 outside [min,max], 100 inside [optMin,optMax], linear ramps in between. */
export function trapezoid(v: number, r: Range): number {
  if (v <= r.min || v >= r.max) return 0;
  if (v >= r.optMin && v <= r.optMax) return 100;
  if (v < r.optMin) return ((v - r.min) / (r.optMin - r.min)) * 100;
  return ((r.max - v) / (r.max - r.optMax)) * 100;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthName = (m: number) => MONTHS[m - 1];
const r0 = (n: number) => Math.round(n);

function windowMonths(m: number): [number, number] {
  return [m, (m % 12) + 1];
}

function weightedWindow(
  climate: MonthlyClimate[], m: number, w: [number, number], pick: (c: MonthlyClimate) => number | null, minYears: number
): number | null {
  const [a, b] = windowMonths(m);
  const ca = climate[a - 1], cb = climate[b - 1];
  if (!ca || !cb || ca.yearsWithData < minYears || cb.yearsWithData < minYears) return null;
  const va = pick(ca), vb = pick(cb);
  if (va == null || vb == null) return null;
  return va * w[0] + vb * w[1];
}

export function recommend(input: RecommendInput): Recommendation {
  const profile = input.profile ?? CROP_PROFILES[input.crop];
  const cfg = input.config ?? DEFAULT_SCORING;
  const now = input.now ?? new Date();
  const minYears = input.climateMinYears ?? 5;
  const { crop, irrigation, plantingMonth: m, mode } = input;
  const label = crop === "rice" ? "rice" : "corn";

  const risks: string[] = [];
  const actions: string[] = [];
  const insufficient: string[] = [];
  const sources: string[] = [];
  const factors: FactorResult[] = [];
  const climate = input.climate;
  const w = profile.windowWeights;
  const rainRange = irrigation === "irrigated" ? profile.irrigatedMonthlyRainMm : profile.rainfedMonthlyRainMm;

  // ---- Rainfall (historical distribution over the establishment window) ----
  let rainfall: FactorResult = {
    key: "rainfall", label: "Rainfall", score: null, weight: cfg.weights.rainfall,
    detail: "Not enough multi-year rainfall history for this location.", basis: "Open-Meteo historical reanalysis",
  };
  const meanRain = climate ? weightedWindow(climate, m, w, c => c.meanRainMm, minYears) : null;
  if (meanRain != null && climate) {
    const s = trapezoid(meanRain, rainRange);
    const c0 = climate[m - 1];
    const cv = c0.meanRainMm > 0 ? c0.stdRainMm / c0.meanRainMm : 0;
    rainfall = {
      ...rainfall, score: r0(s),
      detail: `Typical rainfall around ${monthName(m)} planting is about ${r0(meanRain)} mm/month (${c0.yearsWithData} years of data; ${irrigation === "irrigated" ? "irrigated" : "rain-dependent"} range ${rainRange.optMin}-${rainRange.optMax} mm).` +
        (cv > 0.6 ? " Rainfall varies a lot from year to year." : ""),
    };
    if (meanRain < rainRange.optMin && irrigation !== "irrigated") risks.push("Historical rainfall for this period is on the low side for rain-dependent planting.");
    if (meanRain > rainRange.optMax) risks.push("Historical rainfall for this period can be excessive; waterlogging or flooding is possible.");
    if (cv > 0.6) risks.push("Rainfall in this month changes a lot between years, so the average is less reliable.");
  } else insufficient.push("Multi-year historical rainfall is unavailable or incomplete.");
  factors.push(rainfall);

  // ---- Temperature ----
  let temperature: FactorResult = {
    key: "temperature", label: "Temperature", score: null, weight: cfg.weights.temperature,
    detail: "Not enough historical temperature data.", basis: "Open-Meteo historical reanalysis",
  };
  const meanT = climate ? weightedWindow(climate, m, w, c => c.meanTempC, minYears) : null;
  const meanTmax = climate ? weightedWindow(climate, m, w, c => c.meanTempMaxC, minYears) : null;
  if (meanT != null) {
    let s = trapezoid(meanT, profile.meanTempC);
    const hot = meanTmax != null && meanTmax >= profile.heatStressTmaxC;
    if (hot) { s = Math.max(0, s - 25); risks.push(`Typical daytime highs (~${r0(meanTmax!)} C) are near levels that can stress ${label}.`); }
    temperature = { ...temperature, score: r0(s), detail: `Mean temperature is about ${meanT.toFixed(1)} C${meanTmax != null ? `, daily highs about ${r0(meanTmax)} C` : ""}.` };
  } else insufficient.push("Historical temperature data is unavailable or incomplete.");
  factors.push(temperature);

  // ---- Forecast (current mode only) ----
  let forecast: FactorResult = {
    key: "forecast", label: "Weather forecast", score: null, weight: cfg.weights.forecast,
    detail: mode === "historical" ? "Not used here. The forecast is only used when judging the next few days, because a forecast cannot describe a month far ahead." : "Forecast unavailable.",
    basis: "Open-Meteo forecast",
  };
  if (mode === "current") {
    const curMonth = now.getUTCMonth() + 1;
    const inWindow = m === curMonth || m === (curMonth % 12) + 1;
    const days = input.forecast?.daily.slice(0, profile.forecastWindowDays) ?? [];
    const withRain = days.filter(d => d.precipitationSumMm != null);
    if (!inWindow) insufficient.push("The forecast only covers about 16 days, so it cannot assess a planting month this far away.");
    else if (withRain.length < Math.min(5, profile.forecastWindowDays)) insufficient.push("Forecast data for the next several days is unavailable.");
    else {
      const total = withRain.reduce((a, d) => a + (d.precipitationSumMm as number), 0);
      const maxDay = Math.max(...withRain.map(d => d.precipitationSumMm as number));
      const gust = Math.max(0, ...days.map(d => d.windGustsMaxKmh ?? 0));
      const tmax = Math.max(-Infinity, ...days.map(d => d.tempMaxC ?? -Infinity));
      let s = trapezoid(total, profile.forecastRainMm);
      if (maxDay >= profile.heavyDayWarnMm) { s -= 25; risks.push(`The forecast includes a very wet day (~${r0(maxDay)} mm).`); }
      if (gust >= profile.gustWarnKmh) { s -= 15; risks.push(`Strong gusts (up to ~${r0(gust)} km/h) are forecast; crops and seedlings can be damaged.`); }
      if (tmax >= profile.heatStressTmaxC) { s -= 10; risks.push("Very hot days are forecast."); }
      forecast = {
        ...forecast, score: r0(clamp(s)),
        detail: `Next ${withRain.length} days: about ${r0(total)} mm of rain expected (wettest day ~${r0(maxDay)} mm). Forecasts are less reliable beyond about 7 days.`,
      };
    }
  }
  factors.push(forecast);

  // ---- Water availability ----
  let water: FactorResult = {
    key: "water", label: "Water availability", score: null, weight: cfg.weights.water,
    detail: "Not used because no water source was chosen. Pick Irrigated or Rainfed under 'How does your field get water?' to include it.", basis: "Farm irrigation setting + historical dry spells",
  };
  if (irrigation === "irrigated") {
    water = { ...water, score: 90, detail: "Irrigation is reported. Confirm that water supply and schedule are reliable for the whole season." };
    actions.push("Check irrigation availability and schedule before planting.");
  } else if (irrigation === "rainfed" && climate) {
    const spell = weightedWindow(climate, m, w, c => c.meanLongestDrySpellDays, minYears);
    if (spell != null) {
      const s = 100 - clamp(((spell - profile.drySpellOkDays) / (profile.drySpellBadDays - profile.drySpellOkDays)) * 100);
      water = { ...water, score: r0(s), detail: `Rain-dependent farm. The longest dry stretch in this period typically lasts about ${spell.toFixed(0)} days.` };
      if (s < 60) risks.push("Dry spells long enough to stress a rain-dependent crop are common in this period.");
    }
  } else if (irrigation === "rainfed") water.detail = "Not enough dry-spell history for this location.";
  else actions.push("Add the farm's irrigation type for a more accurate water assessment.");
  factors.push(water);

  // ---- Weather risk ----
  let risk: FactorResult = {
    key: "risk", label: "Weather risks", score: null, weight: cfg.weights.risk,
    detail: "Not enough history to estimate weather risk.", basis: "Historical extremes (Open-Meteo reanalysis)",
  };
  if (climate) {
    const c0 = climate[m - 1];
    if (c0 && c0.yearsWithData >= minYears) {
      let s = 100;
      s -= c0.heavyMonthShare * 40;
      s -= Math.min(30, c0.meanHeavyRainDays * 15);
      const notes: string[] = [];
      if (c0.heavyMonthShare > 0.2) notes.push(`${r0(c0.heavyMonthShare * 100)}% of past years had an excessively wet ${monthName(m)}`);
      if (c0.meanHeavyRainDays >= 0.5) notes.push("heavy-rain days occur in many years");
      if (c0.meanWindMaxKmh != null && c0.meanWindMaxKmh >= profile.gustWarnKmh) { s -= 10; notes.push("strong winds are common"); }
      if (c0.heavyMonthShare > 0.2) risks.push("This period has a history of excessive rainfall (typhoon season risk).");
      risk = { ...risk, score: r0(clamp(s)), detail: notes.length ? `${notes.join("; ")}.` : "No notable historical extremes for this month." };
    }
  }
  factors.push(risk);

  // ---- Combine ----
  const essentialKeys = cfg.essential[mode];
  const missingEssential = essentialKeys.filter(k => factors.find(f => f.key === k)?.score == null);
  const available = factors.filter(f => f.score != null);
  const wsum = available.reduce((a, f) => a + f.weight, 0);
  const reasons = insufficient;
  const generatedAt = now.toISOString();

  sources.push("Open-Meteo (historical reanalysis)");
  if (mode === "current") sources.push("Open-Meteo (forecast)");

  const base = {
    mode, crop, irrigation, plantingMonth: m, coordinates: input.coordinates,
    factors, generatedAt, disclaimer: DISCLAIMER, sources, thresholdsValidated: profile.validated,
  };

  if (missingEssential.length || !available.length || wsum === 0) {
    return {
      ...base, assessment: "insufficient_data", score: null, risks, actions: [],
      insufficientReasons: reasons.length ? reasons : ["Essential data is missing."],
      explanation: "There is not enough reliable data to give a planting recommendation. " + (reasons.join(" ") || ""),
    };
  }

  const score = r0(available.reduce((a, f) => a + (f.score as number) * f.weight, 0) / wsum);
  const assessment: Assessment =
    score >= cfg.bands.favorable ? "favorable" : score >= cfg.bands.moderate ? "moderately_favorable" : score >= cfg.bands.less ? "less_favorable" : "high_risk";

  // Actions
  if (risks.some(r => /excessive|waterlogging|wet day|flood/i.test(r))) actions.push("Prepare drainage and avoid planting in low spots that hold water.");
  if (risks.some(r => /dry spell|low side/i.test(r))) actions.push("Confirm a water source before planting and consider timing planting with the onset of regular rain.");
  if (risks.some(r => /gust|wind/i.test(r))) actions.push("Protect seedlings and plan for wind exposure; avoid planting just before strong winds.");
  actions.push("Monitor weather forecasts and official PAGASA advisories before planting.");

  const top = [...available].sort((a, b) => (b.score as number) - (a.score as number));
  const explanation =
    `${label[0].toUpperCase() + label.slice(1)}, ${mode === "current" ? "planting in the next few days" : `${monthName(m)} planting`}: score ${score}/100. ` +
    `Strongest factor: ${top[0].label} (${top[0].score}). Weakest: ${top[top.length - 1].label} (${top[top.length - 1].score}). ` +
    `The score combines ${available.length} factor${available.length > 1 ? "s" : ""} that had data.`;

  return { ...base, assessment, score, risks, actions, insufficientReasons: [], explanation };
}

export interface CalendarEntry {
  month: number;
  assessment: Assessment;
  score: number | null;
  meanRainMm: number | null;
  meanTempC: number | null;
  yearsWithData: number;
}

/**
 * Historical suitability for all 12 months, plus the full recommendation behind each month so the
 * calendar can show any month's details without another request. No forecast is involved.
 */
export function buildCalendarDetailed(
  base: Omit<RecommendInput, "plantingMonth" | "mode">
): { calendar: CalendarEntry[]; recommendations: Recommendation[] } {
  const recommendations = Array.from({ length: 12 }, (_, i) => recommend({ ...base, plantingMonth: i + 1, mode: "historical" }));
  const calendar = recommendations.map((rec, i) => {
    const c = base.climate?.[i];
    return {
      month: i + 1, assessment: rec.assessment, score: rec.score,
      meanRainMm: c && c.yearsWithData ? c.meanRainMm : null,
      meanTempC: c?.meanTempC ?? null,
      yearsWithData: c?.yearsWithData ?? 0,
    };
  });
  return { calendar, recommendations };
}

/** Historical suitability for all 12 months. No forecast is involved. */
export function buildCalendar(base: Omit<RecommendInput, "plantingMonth" | "mode">): CalendarEntry[] {
  return buildCalendarDetailed(base).calendar;
}

export type { ClimateOptions };