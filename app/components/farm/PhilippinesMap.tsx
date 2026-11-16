"use client";
import { useEffect, useRef, useState } from "react";
import type { Place } from "../../lib/farm/provinces";

// Click-to-pick map of the Philippines. Uses Leaflet and OpenStreetMap tiles, loaded from a CDN the
// first time the map is shown, so the project needs no extra npm package. It needs internet access;
// if it cannot load, the province list and the coordinate boxes next to it still work.
// Bounds match the Philippines box the API accepts (validation.ts).
const LEAFLET_VERSION = "1.9.4";
const LEAFLET_CSS = { href: `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`, integrity: "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" };
const LEAFLET_JS = { src: `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`, integrity: "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" };
const PH = { latMin: 4.5, latMax: 21.5, lonMin: 116, lonMax: 127 };

// The small part of Leaflet's API used here.
interface LMap {
  on(ev: "click", fn: (e: { latlng: { lat: number; lng: number } }) => void): void;
  remove(): void;
  setView(c: [number, number], zoom?: number): void;
  getZoom(): number;
}
interface LMarker { setLatLng(c: [number, number]): void; addTo(m: LMap): LMarker; remove(): void }
interface LeafletLib {
  map(el: HTMLElement, o: object): LMap;
  tileLayer(url: string, o: object): { addTo(m: LMap): void };
  circleMarker(c: [number, number], o: object): LMarker;
}

let loading: Promise<LeafletLib> | null = null;
function loadLeaflet(): Promise<LeafletLib> {
  const have = (window as unknown as { L?: LeafletLib }).L;
  if (have) return Promise.resolve(have);
  if (!loading) {
    loading = new Promise<LeafletLib>((resolve, reject) => {
      const css = document.createElement("link");
      css.rel = "stylesheet"; css.href = LEAFLET_CSS.href; css.integrity = LEAFLET_CSS.integrity; css.crossOrigin = "";
      document.head.appendChild(css);
      const js = document.createElement("script");
      js.src = LEAFLET_JS.src; js.integrity = LEAFLET_JS.integrity; js.crossOrigin = ""; js.async = true;
      js.onload = () => resolve((window as unknown as { L: LeafletLib }).L);
      js.onerror = () => { loading = null; css.remove(); js.remove(); reject(new Error("Leaflet failed to load")); };
      document.head.appendChild(js);
    });
  }
  return loading;
}

export default function PhilippinesMap({ selected, onPick }: { selected: Place | null; onPick: (lat: number, lon: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const markerRef = useRef<LMarker | null>(null);
  const libRef = useRef<LeafletLib | null>(null);
  const pickRef = useRef(onPick);
  const clicked = useRef<string | null>(null); // the spot just chosen on the map, so the view is not re-centred on it
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => { pickRef.current = onPick; });

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then(L => {
      if (cancelled || !box.current) return;
      const map = L.map(box.current, {
        center: [12.5, 122], zoom: 5, minZoom: 5, maxZoom: 12,
        maxBounds: [[PH.latMin - 0.5, PH.lonMin - 0.5], [PH.latMax + 0.5, PH.lonMax + 0.5]], maxBoundsViscosity: 1,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 12, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      }).addTo(map);
      map.on("click", e => {
        const lat = Math.round(e.latlng.lat * 100) / 100, lon = Math.round(e.latlng.lng * 100) / 100; // same 2-decimal grid as the API
        if (lat < PH.latMin || lat > PH.latMax || lon < PH.lonMin || lon > PH.lonMax) return;
        clicked.current = `${lat},${lon}`;
        pickRef.current(lat, lon);
      });
      libRef.current = L; mapRef.current = map;
      setStatus("ready");
    }).catch(() => { if (!cancelled) setStatus("error"); });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null; markerRef.current = null; libRef.current = null;
    };
  }, []);

  const lat = selected?.lat, lon = selected?.lon;
  useEffect(() => {
    const map = mapRef.current, L = libRef.current;
    if (status !== "ready" || !map || !L) return;
    if (lat == null || lon == null) { markerRef.current?.remove(); markerRef.current = null; return; }
    if (markerRef.current) markerRef.current.setLatLng([lat, lon]);
    else markerRef.current = L.circleMarker([lat, lon], { radius: 8, color: "#ffffff", weight: 2, fillColor: "#003087", fillOpacity: 1 }).addTo(map);
    // Chosen from the list or the coordinate boxes: bring that spot into view.
    if (clicked.current !== `${lat},${lon}`) map.setView([lat, lon], Math.max(map.getZoom(), 7));
  }, [lat, lon, status]);

  return (
    <div>
      <div className="relative isolate z-0">
        <div ref={box} role="group" aria-label="Map of the Philippines. Click a spot to choose it. The province list and coordinate boxes do the same without a mouse."
          className="h-64 w-full overflow-hidden rounded border border-[#ccd4df] bg-[#e8eef4] sm:h-80" />
        {status === "loading" && <p role="status" className="absolute inset-0 z-[500] m-0 flex items-center justify-center text-sm text-[#5b6672]">Loading map...</p>}
        {status === "error" && (
          <p role="alert" className="absolute inset-0 z-[500] m-0 flex items-center justify-center bg-white/90 p-4 text-center text-sm text-[#7a1c1c]">
            The map could not be loaded. It needs an internet connection. You can still pick a province or type coordinates.
          </p>
        )}
      </div>
    </div>
  );
}
