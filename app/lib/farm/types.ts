// Shared types for the public Farm Monitoring / Planting Recommendation features.
// Every value that comes from an outside provider is tagged with its source and kind
// so the UI can tell observations, forecasts and modeled estimates apart.

export type Crop = "rice" | "corn";
export type Irrigation = "irrigated" | "rainfed" | "unknown";
export type DataKind = "forecast" | "historical-reanalysis";

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface Provenance {
  source: "Open-Meteo";
  kind: DataKind;
  retrievedAt: string; // ISO timestamp
  coordinatesUsed: Coordinates;
  /** true when served from cache because the provider could not be reached */
  stale?: boolean;
}

export type Result<T> =
  | { ok: true; data: T; provenance: Provenance }
  | { ok: false; error: { code: FarmErrorCode; message: string } };

export type FarmErrorCode =
  | "invalid_input"
  | "timeout"
  | "network"
  | "rate_limited"
  | "upstream"
  | "no_data";

export interface ForecastCurrent {
  time: string;
  temperatureC: number | null;
  apparentTemperatureC: number | null;
  humidityPct: number | null;
  precipitationMm: number | null;
  weatherCode: number | null;
  cloudCoverPct: number | null;
  windSpeedKmh: number | null;
  windDirectionDeg: number | null;
  windGustsKmh: number | null;
}

export interface ForecastHour {
  time: string;
  temperatureC: number | null;
  humidityPct: number | null;
  precipitationProbabilityPct: number | null;
  precipitationMm: number | null;
  weatherCode: number | null;
  windSpeedKmh: number | null;
  windGustsKmh: number | null;
}

export interface ForecastDay {
  date: string;
  weatherCode: number | null;
  tempMaxC: number | null;
  tempMinC: number | null;
  precipitationSumMm: number | null;
  precipitationProbabilityMaxPct: number | null;
  windSpeedMaxKmh: number | null;
  windGustsMaxKmh: number | null;
}

export interface Forecast {
  current: ForecastCurrent | null;
  hourly: ForecastHour[];
  daily: ForecastDay[];
  timezone: string;
}

export interface DailyHistoryRow {
  date: string; // YYYY-MM-DD
  precipitationMm: number | null;
  tempMaxC: number | null;
  tempMinC: number | null;
  tempMeanC: number | null;
  windSpeedMaxKmh: number | null;
}

export interface MonthlyClimate {
  month: number; // 1-12
  yearsWithData: number;
  meanRainMm: number;
  stdRainMm: number;
  minYearRainMm: number;
  maxYearRainMm: number;
  meanRainyDays: number;
  meanDryDays: number;
  meanHeavyRainDays: number;
  maxDailyRainMm: number;
  meanLongestDrySpellDays: number;
  worstDrySpellDays: number;
  meanTempMaxC: number | null;
  meanTempMinC: number | null;
  meanTempC: number | null;
  meanWindMaxKmh: number | null;
  /** fraction of years (0-1) whose monthly total exceeded the heavy-month threshold */
  heavyMonthShare: number;
}

/** One month of one year in the rainfall history table. */
export interface YearMonthCell {
  /** Sum of the daily rainfall that has data, or null when no day has data. */
  totalMm: number | null;
  daysWithData: number;
  daysInMonth: number;
  /** Same rule summarizeMonthly uses: enough days with data for the year to count. */
  complete: boolean;
}

export interface YearMonthRow {
  year: number;
  months: YearMonthCell[]; // always 12 entries, Jan to Dec
  /** Sum of the months that have data; understated when `complete` is false. */
  totalMm: number | null;
  /** true only when all 12 months are complete */
  complete: boolean;
}

/** What /api/farm/history returns. */
export interface HistoryResponse {
  daily: DailyHistoryRow[];
  months: MonthlyClimate[];
  matrix: YearMonthRow[];
  /** The ClimateOptions the numbers were computed with (DEFAULT_CLIMATE_OPTIONS). */
  thresholds: {
    rainyDayMm: number; heavyDayMm: number; heavyMonthMm: number; minDayCoverage: number; minYears: number;
  };
  provenance: Provenance;
  source: {
    name: string;
    dataset: string;
    license: string;
    /** The exact Open-Meteo request the server made (or reused from cache). */
    url: string;
    years: number;
    periodStart: string; // first date returned
    periodEnd: string; // last date returned
    days: number;
  };
}

export type Assessment =
  | "favorable"
  | "moderately_favorable"
  | "less_favorable"
  | "high_risk"
  | "insufficient_data";

export interface FactorResult {
  key: "rainfall" | "temperature" | "forecast" | "water" | "risk";
  label: string;
  score: number | null; // 0-100, null = not evaluated
  weight: number; // configured weight (before renormalisation)
  detail: string;
  basis: string; // which data it used
}

export interface Recommendation {
  mode: "historical" | "current";
  crop: Crop;
  irrigation: Irrigation;
  plantingMonth: number;
  coordinates: Coordinates;
  assessment: Assessment;
  score: number | null;
  factors: FactorResult[];
  risks: string[];
  actions: string[];
  insufficientReasons: string[];
  explanation: string;
  sources: string[];
  generatedAt: string;
  disclaimer: string;
  thresholdsValidated: boolean;
}

/** Loosely-typed provider JSON. Every field is validated before use in the parse functions. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RawJson = any;
