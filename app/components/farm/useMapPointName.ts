"use client";
import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { Place } from "../../lib/farm/provinces";

/** Name given to a spot picked on the map until its real name is found. */
export const MAP_POINT = "Map point";

/** Town / city and province for a spot, from OpenStreetMap's Nominatim. Null when it cannot tell. */
async function placeName(lat: number, lon: number, signal: AbortSignal): Promise<string | null> {
  const q = new URLSearchParams({ format: "jsonv2", zoom: "10", addressdetails: "1", "accept-language": "en", lat: String(lat), lon: String(lon) });
  const r = await fetch(`https://nominatim.openstreetmap.org/reverse?${q}`, { signal, headers: { Accept: "application/json" } });
  if (!r.ok) return null;
  const a = (await r.json())?.address as Record<string, string> | undefined;
  if (!a) return null;
  const town = a.city ?? a.town ?? a.municipality ?? a.village;
  const province = a.province ?? a.county;
  const name = [town, province].filter((x, i, all): x is string => !!x && all.indexOf(x) === i).join(", ");
  return name || null;
}

/**
 * A spot picked on the map starts out called "Map point". This looks up its real name (for example
 * "Cabanatuan, Nueva Ecija") and renames it, as long as the spot has not changed meanwhile.
 * The data does not wait for the name; if the lookup fails the name stays "Map point".
 */
export function useMapPointName(place: Place | null, setPlace: Dispatch<SetStateAction<Place | null>>) {
  const lat = place?.lat, lon = place?.lon, generic = place?.name === MAP_POINT;
  useEffect(() => {
    if (!generic || lat == null || lon == null) return;
    const ac = new AbortController();
    // Wait a moment so quick successive clicks make one lookup (Nominatim asks for at most 1 per second).
    const t = setTimeout(() => {
      placeName(lat, lon, ac.signal)
        .then(name => { if (name) setPlace(p => (p && p.lat === lat && p.lon === lon && p.name === MAP_POINT ? { ...p, name } : p)); })
        .catch(() => { /* offline or blocked: keep "Map point" */ });
    }, 500);
    return () => { clearTimeout(t); ac.abort(); };
  }, [generic, lat, lon, setPlace]);
}
