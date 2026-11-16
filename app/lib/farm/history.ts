// Pure helpers for the Historical Climate Data page: the API payload and the CSV exports.
// No network and no React, so both are covered by unit tests.

import { summarizeMonthly, yearMonthRainfall } from "./climate";
import { MONTH_SHORT } from "./labels";
import type { DailyHistoryRow, HistoryResponse, MonthlyClimate, Provenance } from "./types";

/** Build the /api/farm/history payload. Monthly numbers come from summarizeMonthly, exactly as /api/farm/climate. */
export function buildHistoryResponse(
  rows: DailyHistoryRow[],
  provenance: Provenance,
  request: { url: string; years: number }
): HistoryResponse {
  const { months, options } = summarizeMonthly(rows);
  const dates = rows.map(r => r.date).sort();
  return {
    daily: rows,
    months,
    matrix: yearMonthRainfall(rows, options),
    thresholds: options,
    provenance,
    source: {
      name: "Open-Meteo Historical Weather API",
      dataset: "ERA5 reanalysis (ECMWF / Copernicus)",
      license: "CC BY 4.0",
      url: request.url,
      years: request.years,
      periodStart: dates[0] ?? "",
      periodEnd: dates[dates.length - 1] ?? "",
      days: rows.length,
    },
  };
}

type Cell = string | number | null | undefined;

/** One CSV field: empty for missing values, quoted when it holds a comma, quote or line break. */
export function csvField(v: Cell): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Rows to CSV text. Lines end with CRLF, which Excel and every other reader accept. */
export function toCsv(header: string[], rows: Cell[][]): string {
  return [header, ...rows].map(r => r.map(csvField).join(",")).join("\r\n") + "\r\n";
}

export function dailyCsv(rows: DailyHistoryRow[]): string {
  return toCsv(
    ["date", "rain_mm", "tmax_c", "tmin_c", "tmean_c", "wind_max_kmh"],
    rows.map(r => [r.date, r.precipitationMm, r.tempMaxC, r.tempMinC, r.tempMeanC, r.windSpeedMaxKmh])
  );
}

const r2 = (v: number | null) => (v == null ? null : Math.round(v * 100) / 100);

export function monthlyCsv(months: MonthlyClimate[]): string {
  return toCsv(
    [
      "month", "years_with_data", "avg_rain_mm", "avg_rainy_days", "avg_heavy_rain_days",
      "avg_longest_dry_spell_days", "worst_dry_spell_days", "avg_tmax_c", "avg_tmin_c", "avg_tmean_c", "avg_max_wind_kmh",
    ],
    months.map(m => [
      MONTH_SHORT[m.month - 1], m.yearsWithData, r2(m.meanRainMm), r2(m.meanRainyDays), r2(m.meanHeavyRainDays),
      r2(m.meanLongestDrySpellDays), m.worstDrySpellDays, r2(m.meanTempMaxC), r2(m.meanTempMinC), r2(m.meanTempC), r2(m.meanWindMaxKmh),
    ])
  );
}
