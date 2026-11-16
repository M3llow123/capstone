// Turns multi-year daily history into per-month climate statistics.
// Pure functions only (no network) so they are easy to test.

import type { DailyHistoryRow, MonthlyClimate, YearMonthCell, YearMonthRow } from "./types";

export interface ClimateOptions {
  rainyDayMm: number; // a day counts as rainy at or above this amount
  heavyDayMm: number; // a day counts as heavy-rain at or above this amount
  heavyMonthMm: number; // a month total at or above this counts as an excessively wet month
  minDayCoverage: number; // fraction of a month's days that must have data for the year to count
  minYears: number;
}

export const DEFAULT_CLIMATE_OPTIONS: ClimateOptions = {
  rainyDayMm: 1,
  heavyDayMm: 50,
  heavyMonthMm: 600,
  minDayCoverage: 0.9,
  minYears: 5,
};

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const std = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};
const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const nullableMean = (a: number[]) => (a.length ? mean(a) : null);

/** Returns 12 entries; months with fewer than `minYears` usable years get yearsWithData < minYears. */
export function summarizeMonthly(
  rows: DailyHistoryRow[],
  options: Partial<ClimateOptions> = {}
): { months: MonthlyClimate[]; options: ClimateOptions } {
  const opt = { ...DEFAULT_CLIMATE_OPTIONS, ...options };
  // bucket rows by year-month
  const buckets = new Map<string, DailyHistoryRow[]>();
  for (const r of rows) {
    const key = r.date.slice(0, 7);
    (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(r);
  }

  const months: MonthlyClimate[] = [];
  for (let m = 1; m <= 12; m++) {
    const totals: number[] = [], rainy: number[] = [], dry: number[] = [], heavy: number[] = [];
    const spells: number[] = [], tmax: number[] = [], tmin: number[] = [], tmean: number[] = [], wind: number[] = [];
    let maxDaily = 0;

    for (const [key, days] of buckets) {
      const [ys, ms] = key.split("-");
      if (Number(ms) !== m) continue;
      const withRain = days.filter(d => d.precipitationMm != null);
      if (withRain.length / daysIn(Number(ys), m) < opt.minDayCoverage) continue; // incomplete year

      const sorted = [...withRain].sort((a, b) => a.date.localeCompare(b.date));
      let total = 0, nRainy = 0, nHeavy = 0, run = 0, longest = 0;
      for (const d of sorted) {
        const p = d.precipitationMm as number;
        total += p;
        if (p >= opt.rainyDayMm) { nRainy++; run = 0; } else { run++; longest = Math.max(longest, run); }
        if (p >= opt.heavyDayMm) nHeavy++;
        maxDaily = Math.max(maxDaily, p);
      }
      totals.push(total);
      rainy.push(nRainy);
      dry.push(sorted.length - nRainy);
      heavy.push(nHeavy);
      spells.push(longest);
      for (const d of days) {
        if (d.tempMaxC != null) tmax.push(d.tempMaxC);
        if (d.tempMinC != null) tmin.push(d.tempMinC);
        if (d.tempMeanC != null) tmean.push(d.tempMeanC);
        if (d.windSpeedMaxKmh != null) wind.push(d.windSpeedMaxKmh);
      }
    }

    const n = totals.length;
    months.push({
      month: m,
      yearsWithData: n,
      meanRainMm: n ? mean(totals) : 0,
      stdRainMm: std(totals),
      minYearRainMm: n ? Math.min(...totals) : 0,
      maxYearRainMm: n ? Math.max(...totals) : 0,
      meanRainyDays: n ? mean(rainy) : 0,
      meanDryDays: n ? mean(dry) : 0,
      meanHeavyRainDays: n ? mean(heavy) : 0,
      maxDailyRainMm: maxDaily,
      meanLongestDrySpellDays: n ? mean(spells) : 0,
      worstDrySpellDays: n ? Math.max(...spells) : 0,
      meanTempMaxC: nullableMean(tmax),
      meanTempMinC: nullableMean(tmin),
      meanTempC: nullableMean(tmean),
      meanWindMaxKmh: nullableMean(wind),
      heavyMonthShare: n ? totals.filter(t => t >= opt.heavyMonthMm).length / n : 0,
    });
  }
  return { months, options: opt };
}

/**
 * Rainfall per year and month (rows = years, 12 columns). A month is `complete` under the same
 * rule summarizeMonthly uses to decide whether a year counts, so the two tables agree about
 * which months were used. Incomplete months still show their partial total so nothing is hidden.
 */
export function yearMonthRainfall(
  rows: DailyHistoryRow[],
  options: Partial<ClimateOptions> = {}
): YearMonthRow[] {
  const opt = { ...DEFAULT_CLIMATE_OPTIONS, ...options };
  const sums = new Map<string, { total: number; n: number }>();
  const years = new Set<number>();
  for (const r of rows) {
    years.add(Number(r.date.slice(0, 4)));
    if (r.precipitationMm == null) continue;
    const key = r.date.slice(0, 7);
    const e = sums.get(key) ?? { total: 0, n: 0 };
    e.total += r.precipitationMm;
    e.n++;
    sums.set(key, e);
  }
  return [...years].sort((a, b) => a - b).map(year => {
    const months: YearMonthCell[] = [];
    let total = 0, any = false, allComplete = true;
    for (let m = 1; m <= 12; m++) {
      const e = sums.get(`${year}-${String(m).padStart(2, "0")}`);
      const daysInMonth = daysIn(year, m);
      const daysWithData = e?.n ?? 0;
      const complete = daysWithData / daysInMonth >= opt.minDayCoverage;
      if (e) { total += e.total; any = true; }
      if (!complete) allComplete = false;
      months.push({ totalMm: e ? e.total : null, daysWithData, daysInMonth, complete });
    }
    return { year, months, totalMm: any ? total : null, complete: allComplete };
  });
}
