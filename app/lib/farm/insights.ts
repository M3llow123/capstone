// Plain-language, rule-based weather notes for a farm. These are APPLICATION-GENERATED from the
// forecast and configurable thresholds. They are not official PAGASA warnings and are never
// labeled as such.
import type { ForecastDay } from "./types";

export interface Insight {
  level: "info" | "watch" | "alert";
  title: string;
  text: string;
}

export interface InsightThresholds {
  heavyRainDayMm: number;
  strongGustKmh: number;
  hotDayC: number;
  dryStretchDays: number;
  landPrepMaxMm: number;
}

export const DEFAULT_INSIGHT_THRESHOLDS: InsightThresholds = {
  heavyRainDayMm: 50,
  strongGustKmh: 60,
  hotDayC: 35,
  dryStretchDays: 7,
  landPrepMaxMm: 1,
};

const fmt = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });

export function forecastInsights(days: ForecastDay[], t: InsightThresholds = DEFAULT_INSIGHT_THRESHOLDS): Insight[] {
  const out: Insight[] = [];
  const week = days.slice(0, 7);
  if (!week.length) return out;

  const heavy = week.filter(d => (d.precipitationSumMm ?? 0) >= t.heavyRainDayMm);
  if (heavy.length)
    out.push({
      level: "alert", title: "Heavy rain possible",
      text: `${heavy.length} day(s) in the next week may bring ${t.heavyRainDayMm} mm or more (around ${fmt(heavy[0].date)}). Watch for waterlogging and check drainage.`,
    });

  const gust = week.filter(d => (d.windGustsMaxKmh ?? 0) >= t.strongGustKmh);
  if (gust.length)
    out.push({
      level: "alert", title: "Strong winds",
      text: `Gusts of ${t.strongGustKmh} km/h or more are forecast around ${fmt(gust[0].date)}. Young plants may be damaged.`,
    });

  const hot = week.filter(d => (d.tempMaxC ?? -99) >= t.hotDayC);
  if (hot.length)
    out.push({ level: "watch", title: "Very hot days", text: `Highs of ${t.hotDayC} C or more are forecast on ${hot.length} day(s). Crops can be heat-stressed, especially at flowering.` });

  let run = 0, best = 0;
  for (const d of days) {
    if ((d.precipitationSumMm ?? 0) < 1) { run++; best = Math.max(best, run); } else run = 0;
  }
  if (best >= t.dryStretchDays)
    out.push({ level: "watch", title: "Long dry stretch", text: `About ${best} days in a row with little or no rain are forecast. Rain-dependent fields may run short of water.` });

  const prep = week.filter(d => (d.precipitationSumMm ?? 99) < t.landPrepMaxMm && (d.precipitationProbabilityMaxPct ?? 100) < 40);
  if (prep.length >= 2 && !heavy.length)
    out.push({ level: "info", title: "Good days for field work", text: `${prep.length} mostly dry day(s) in the next week may suit land preparation. Forecasts can change, so recheck before you start.` });

  if (!out.length) out.push({ level: "info", title: "No notable weather concerns", text: "Nothing unusual is forecast for the next week based on the thresholds used here." });
  return out;
}
