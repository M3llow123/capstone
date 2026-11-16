import type { Assessment } from "./types";

export const ASSESSMENT_META: Record<Assessment, { label: string; bg: string; fg: string }> = {
  favorable: { label: "Favorable", bg: "#2e7d32", fg: "#ffffff" },
  moderately_favorable: { label: "Moderately favorable", bg: "#f2c200", fg: "#1c2b3a" },
  less_favorable: { label: "Less favorable", bg: "#ef8a1f", fg: "#1c2b3a" },
  high_risk: { label: "High-risk period", bg: "#c62828", fg: "#ffffff" },
  insufficient_data: { label: "Not enough data", bg: "#9aa3ad", fg: "#1c2b3a" },
};

export const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export type WeatherIcon = "sun" | "partly" | "cloud" | "fog" | "drizzle" | "rain" | "storm";

/** WMO weather interpretation codes used by Open-Meteo. */
export function weatherInfo(code: number | null): { label: string; icon: WeatherIcon } {
  if (code == null) return { label: "No data", icon: "cloud" };
  if (code === 0) return { label: "Clear sky", icon: "sun" };
  if (code <= 2) return { label: "Partly cloudy", icon: "partly" };
  if (code === 3) return { label: "Overcast", icon: "cloud" };
  if (code <= 48) return { label: "Fog", icon: "fog" };
  if (code <= 57) return { label: "Drizzle", icon: "drizzle" };
  if (code <= 67) return { label: "Rain", icon: "rain" };
  if (code <= 77) return { label: "Cold precipitation", icon: "cloud" };
  if (code <= 82) return { label: "Rain showers", icon: "rain" };
  if (code <= 86) return { label: "Snow showers", icon: "cloud" };
  return { label: "Thunderstorm", icon: "storm" };
}

export function windDirection(deg: number | null): string {
  if (deg == null) return "-";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}
