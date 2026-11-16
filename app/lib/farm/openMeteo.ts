// Open-Meteo integration: forecast (api.open-meteo.com) and historical reanalysis
// (archive-api.open-meteo.com, ERA5). No API key on the free non-commercial tier
// (10,000 calls/day); data is CC BY 4.0, so the UI must show attribution.
// Endpoint and variable names should be re-checked against https://open-meteo.com/en/docs
// whenever Open-Meteo changes its API.

import { cached } from "./cache";
import { FarmApiError, fetchJsonMeta } from "./http";
import type {
  RawJson, Coordinates, DailyHistoryRow, Forecast, ForecastCurrent, ForecastDay, ForecastHour, Result,
} from "./types";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
const TZ = "Asia/Manila";

// Two cache layers. The in-memory one (cache.ts) answers repeat visits instantly and can keep
// showing a slightly old forecast while it refreshes. Underneath, Next.js's persistent fetch cache
// (`revalidateSec`) survives restarts. Worst case a forecast is about 20 minutes old.
const FORECAST_TTL = 10 * 60 * 1000; // 10 minutes
const FORECAST_SWR = 50 * 60 * 1000; // then up to 50 more minutes served instantly while refreshing
const FORECAST_REVALIDATE_SEC = 10 * 60;
const HISTORY_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days: past weather does not change
const HISTORY_REVALIDATE_SEC = 30 * 24 * 60 * 60;

type Num = (number | null)[] | undefined;
const at = (arr: Num, i: number): number | null => {
  const v = arr?.[i];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};

function fail(err: unknown): { ok: false; error: { code: FarmApiError["code"]; message: string } } {
  if (err instanceof FarmApiError) return { ok: false, error: { code: err.code, message: err.message } };
  return { ok: false, error: { code: "upstream", message: "Weather data is temporarily unavailable." } };
}

export function parseForecast(raw: RawJson): Forecast {
  const c = raw?.current;
  const current: ForecastCurrent | null = c
    ? {
        time: String(c.time ?? ""),
        temperatureC: num(c.temperature_2m),
        apparentTemperatureC: num(c.apparent_temperature),
        humidityPct: num(c.relative_humidity_2m),
        precipitationMm: num(c.precipitation),
        weatherCode: num(c.weather_code),
        cloudCoverPct: num(c.cloud_cover),
        windSpeedKmh: num(c.wind_speed_10m),
        windDirectionDeg: num(c.wind_direction_10m),
        windGustsKmh: num(c.wind_gusts_10m),
      }
    : null;

  const h = raw?.hourly ?? {};
  const hourly: ForecastHour[] = (h.time ?? []).map((time: string, i: number) => ({
    time,
    temperatureC: at(h.temperature_2m, i),
    humidityPct: at(h.relative_humidity_2m, i),
    precipitationProbabilityPct: at(h.precipitation_probability, i),
    precipitationMm: at(h.precipitation, i),
    weatherCode: at(h.weather_code, i),
    windSpeedKmh: at(h.wind_speed_10m, i),
    windGustsKmh: at(h.wind_gusts_10m, i),
  }));

  const d = raw?.daily ?? {};
  const daily: ForecastDay[] = (d.time ?? []).map((date: string, i: number) => ({
    date,
    weatherCode: at(d.weather_code, i),
    tempMaxC: at(d.temperature_2m_max, i),
    tempMinC: at(d.temperature_2m_min, i),
    precipitationSumMm: at(d.precipitation_sum, i),
    precipitationProbabilityMaxPct: at(d.precipitation_probability_max, i),
    windSpeedMaxKmh: at(d.wind_speed_10m_max, i),
    windGustsMaxKmh: at(d.wind_gusts_10m_max, i),
  }));

  return { current, hourly, daily, timezone: String(raw?.timezone ?? TZ) };
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export async function getForecast(coords: Coordinates): Promise<Result<Forecast>> {
  const q = new URLSearchParams({
    latitude: String(coords.lat),
    longitude: String(coords.lon),
    current:
      "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    // Only what the "Next 48 hours" charts read. The other hourly values were never displayed.
    hourly: "precipitation_probability,precipitation,wind_gusts_10m",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max",
    timezone: TZ,
    forecast_days: "16",
  });
  try {
    const r = await cached(
      `forecast:${coords.lat},${coords.lon}`, FORECAST_TTL,
      async () => {
        const { data, date } = await fetchJsonMeta<unknown>(`${FORECAST_URL}?${q}`, { timeoutMs: 15000, retries: 1, retryOnTimeout: true, revalidateSec: FORECAST_REVALIDATE_SEC });
        return { raw: data, at: date ?? Date.now() };
      },
      { swrMs: FORECAST_SWR }
    );
    const data = parseForecast(r.value.raw);
    if (!data.daily.length) return { ok: false, error: { code: "no_data", message: "No forecast returned." } };
    return {
      ok: true,
      data,
      provenance: {
        source: "Open-Meteo", kind: "forecast", coordinatesUsed: coords,
        retrievedAt: new Date(r.value.at).toISOString(), stale: r.stale,
      },
    };
  } catch (e) {
    return fail(e);
  }
}

export function parseDailyHistory(raw: RawJson): DailyHistoryRow[] {
  const d = raw?.daily ?? {};
  return (d.time ?? []).map((date: string, i: number) => ({
    date,
    precipitationMm: at(d.precipitation_sum, i),
    tempMaxC: at(d.temperature_2m_max, i),
    tempMinC: at(d.temperature_2m_min, i),
    tempMeanC: at(d.temperature_2m_mean, i),
    windSpeedMaxKmh: at(d.wind_speed_10m_max, i),
  }));
}

/**
 * The exact archive request for the last `years` COMPLETE calendar years. Shared by
 * getDailyHistory and the history page, so the URL shown to the user is the URL that was fetched.
 */
export function historyRequest(coords: Coordinates, years = 10, now = new Date()) {
  const y = Math.min(Math.max(Math.floor(years), 1), 30);
  const lastYear = now.getUTCFullYear() - 1;
  const firstYear = lastYear - y + 1;
  const q = new URLSearchParams({
    latitude: String(coords.lat),
    longitude: String(coords.lon),
    start_date: `${firstYear}-01-01`,
    end_date: `${lastYear}-12-31`,
    daily: "precipitation_sum,temperature_2m_max,temperature_2m_min,temperature_2m_mean,wind_speed_10m_max",
    timezone: TZ,
  });
  return { url: `${ARCHIVE_URL}?${q}`, firstYear, lastYear, years: y };
}

/**
 * Daily history for the last `years` COMPLETE calendar years (ERA5 lags real time by a few
 * days, so the current year is excluded). One request, cached for 30 days.
 */
export async function getDailyHistory(
  coords: Coordinates,
  years = 10,
  now = new Date()
): Promise<Result<DailyHistoryRow[]>> {
  const { url, firstYear, lastYear } = historyRequest(coords, years, now);
  try {
    const r = await cached(`history:${coords.lat},${coords.lon}:${firstYear}-${lastYear}`, HISTORY_TTL, async () => {
      const { data, date } = await fetchJsonMeta<unknown>(url, { timeoutMs: 30000, retries: 1, retryOnTimeout: true, revalidateSec: HISTORY_REVALIDATE_SEC });
      return { raw: data, at: date ?? Date.now() };
    });
    const rows = parseDailyHistory(r.value.raw);
    if (!rows.length) return { ok: false, error: { code: "no_data", message: "No historical data returned." } };
    return {
      ok: true,
      data: rows,
      provenance: {
        source: "Open-Meteo", kind: "historical-reanalysis", coordinatesUsed: coords,
        retrievedAt: new Date(r.value.at).toISOString(), stale: r.stale,
      },
    };
  } catch (e) {
    return fail(e);
  }
}
