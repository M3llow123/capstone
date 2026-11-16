import type { Coordinates, Crop, Irrigation } from "./types";

// Philippines bounding box (with a small margin). Keeps the public endpoints from being
// used as a general-purpose weather proxy.
const PH = { latMin: 4.5, latMax: 21.5, lonMin: 116, lonMax: 127 };

export function parseCoordinates(latRaw: unknown, lonRaw: unknown): Coordinates | null {
  const lat = typeof latRaw === "string" && latRaw.trim() !== "" ? Number(latRaw) : Number(latRaw ?? NaN);
  const lon = typeof lonRaw === "string" && lonRaw.trim() !== "" ? Number(lonRaw) : Number(lonRaw ?? NaN);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < PH.latMin || lat > PH.latMax || lon < PH.lonMin || lon > PH.lonMax) return null;
  // ~1 km grid: matches the resolution of the data and makes cache keys reusable.
  return { lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 };
}

export function parseCrop(v: unknown): Crop | null {
  return v === "rice" || v === "corn" ? v : null;
}

export function parseIrrigation(v: unknown): Irrigation {
  return v === "irrigated" || v === "rainfed" ? v : "unknown";
}

export function parseMonth(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : null;
}
