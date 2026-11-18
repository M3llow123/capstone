"use client";
import { useEffect, useState } from "react";
import { CalendarDays, CloudSun, LocateFixed, MapPin } from "lucide-react";
import { PROVINCES, type Place } from "../../lib/farm/provinces";
import type { Crop, Irrigation } from "../../lib/farm/types";
import CalendarTab from "./CalendarTab";
import PhilippinesMap from "./PhilippinesMap";
import { MAP_POINT, useMapPointName } from "./useMapPointName";
import WeatherTab from "./WeatherTab";
import { Card, Empty } from "./ui";

type Tab = "calendar" | "weather";

const KEY = "farm-guide:v1";
const TABS: { id: Tab; label: string; icon: typeof CalendarDays }[] = [
  { id: "calendar", label: "Planting Calendar", icon: CalendarDays },
  { id: "weather", label: "Weather", icon: CloudSun },
];

function load(): { place: Place | null; crop: Crop; irrigation: Irrigation } {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (j && typeof j === "object") return { place: j.place ?? null, crop: j.crop === "corn" ? "corn" : "rice", irrigation: j.irrigation ?? "unknown" };
  } catch { /* storage unavailable: start fresh */ }
  return { place: null, crop: "rice", irrigation: "unknown" };
}

export default function FarmApp() {
  const [place, setPlace] = useState<Place | null>(null);
  const [crop, setCrop] = useState<Crop>("rice");
  const [irrigation, setIrrigation] = useState<Irrigation>("unknown");
  const [tab, setTab] = useState<Tab>("calendar");
  const [ready, setReady] = useState(false);
  const [manual, setManual] = useState({ lat: "", lon: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(true);

  useEffect(() => {
    const s = load();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlace(s.place); setCrop(s.crop); setIrrigation(s.irrigation); setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify({ place, crop, irrigation })); } catch { /* ignore */ }
  }, [ready, place, crop, irrigation]);

  useMapPointName(place, setPlace);

  const choose = (p: Place) => { setPlace(p); setMsg(null); };
  const useMyLocation = () => {
    if (!navigator.geolocation) return setMsg("Your browser cannot share its location. Pick a province instead.");
    setMsg("Finding your location...");
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude, lon = pos.coords.longitude;
        if (lat < 4.5 || lat > 21.5 || lon < 116 || lon > 127) return setMsg("Your location is outside the Philippines. Pick a province instead.");
        choose({ name: "My location", lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 });
      },
      () => setMsg("We could not get your location. You can allow location access, or pick a province.")
    );
  };
  const applyManual = () => {
    const lat = Number(manual.lat), lon = Number(manual.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || manual.lat === "" || manual.lon === "") return setMsg("Enter both latitude and longitude as numbers, for example 15.54 and 121.08.");
    if (lat < 4.5 || lat > 21.5 || lon < 116 || lon > 127) return setMsg("These coordinates are outside the Philippines. Check that latitude comes first (about 5 to 21) and longitude second (about 117 to 127).");
    choose({ name: `${lat.toFixed(2)}, ${lon.toFixed(2)}`, lat, lon });
  };

  const field = "min-h-11 w-full border border-[#bdc9d5] bg-white px-3 text-sm text-[#203648] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#17476b]";
  const lbl = "mb-1.5 block text-xs font-semibold text-[#31475a]";
  const provValue = PROVINCES.some(p => p.name === place?.name) ? place!.name : "";

  return (
    <div className="space-y-5">
      <Card variant="farm">
        <div className="mb-5">
          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.1em] text-[#607487]">Location and field</p>
          <h2 id="farm-details-heading" className="m-0 mt-1 text-lg font-bold text-[#172b3a]">Set up your farm</h2>
          <p className="m-0 mt-1 text-sm leading-5 text-[#526477]">Choose where you farm and the field conditions to tailor the guidance.</p>
        </div>

        <div className="grid gap-x-4 gap-y-4 sm:grid-cols-12 sm:items-end">
          <div className="sm:col-span-7">
            <label className={lbl} htmlFor="prov">Province</label>
            <select id="prov" className={field} value={provValue} onChange={e => { const p = PROVINCES.find(x => x.name === e.target.value); if (p) choose(p); }}>
              <option value="">Choose a province...</option>
              {PROVINCES.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-5">
            <button type="button" onClick={useMyLocation} className="inline-flex min-h-11 w-full items-center justify-center gap-2 border border-[#9fb1c1] bg-white px-3 text-sm font-semibold text-[#17476b] hover:bg-[#f4f7f9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#17476b]">
              <LocateFixed size={16} /> Use my location
            </button>
          </div>
          <div className="sm:col-span-5">
            <span className={lbl}>Crop</span>
            <div role="radiogroup" aria-label="Crop" className="grid min-h-11 grid-cols-2 border border-[#bdc9d5] bg-[#f7f9fa] p-1">
              {(["rice", "corn"] as Crop[]).map(c => {
                const selected = crop === c;
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setCrop(c)}
                    className={`px-3 text-sm font-semibold capitalize focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#17476b] ${selected ? "border border-[#c6d1dc] bg-white text-[#17476b]" : "text-[#526477] hover:bg-white/70"}`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="sm:col-span-7">
            <label className={lbl} htmlFor="irr">Field water</label>
            <select id="irr" className={field} value={irrigation} onChange={e => setIrrigation(e.target.value as Irrigation)}>
              <option value="unknown">Not sure / skip</option>
              <option value="irrigated">Irrigated (canal, pump)</option>
              <option value="rainfed">Rainfed (depends on rain)</option>
            </select>
          </div>
        </div>
        <div className="mt-5 border-t border-[#e2e8ed] pt-3">
          <button
            type="button"
            onClick={() => setShowMap(v => !v)}
            aria-expanded={showMap}
            aria-controls="farm-map"
            className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-[#17476b] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#17476b]"
          >
            <MapPin size={15} aria-hidden />
            {showMap ? "Hide map" : "Choose a point on the map"}
          </button>
          {showMap && (
            <div id="farm-map" className="mt-3">
              <PhilippinesMap selected={place} onPick={(lat, lon) => choose({ name: MAP_POINT, lat, lon })} />
              <p className="m-0 mt-2 text-xs text-[#607487]">Select a point to view its planting calendar and forecast. You can also choose a province above.</p>
            </div>
          )}
        </div>
        <details className="mt-3 border-t border-[#e2e8ed] pt-3">
          <summary className="min-h-8 cursor-pointer text-sm font-semibold text-[#17476b] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#17476b]">Enter exact farm coordinates</summary>
          <div className="mt-3 grid max-w-2xl gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div><label className={lbl} htmlFor="lat">Latitude</label><input id="lat" inputMode="decimal" className={field} value={manual.lat} onChange={e => setManual(m => ({ ...m, lat: e.target.value }))} placeholder="15.54" /></div>
            <div><label className={lbl} htmlFor="lon">Longitude</label><input id="lon" inputMode="decimal" className={field} value={manual.lon} onChange={e => setManual(m => ({ ...m, lon: e.target.value }))} placeholder="121.08" /></div>
            <button type="button" onClick={applyManual} className="min-h-11 border border-[#17476b] bg-[#17476b] px-4 text-sm font-semibold text-white hover:bg-[#103b5b] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#17476b] focus-visible:ring-offset-2">Use coordinates</button>
          </div>
        </details>
        {msg && <p role="status" className="m-0 mt-3 border-l-2 border-[#b74e45] bg-[#fff7f6] px-3 py-2 text-sm text-[#7a1c1c]">{msg}</p>}
      </Card>

      {!place ? (
        <Empty variant="farm">
          <strong className="block text-[#31475a]">Choose a farm location to get started</strong>
          <span className="mt-1 block">Select a province, share your location, or pick a point on the map to see planting guidance and weather.</span>
        </Empty>
      ) : (
        <>
          <div className="border-b border-[#cbd6df]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div role="tablist" aria-label="Farm information" className="flex gap-5">
              {TABS.map(t => {
                const on = tab === t.id; const I = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    id={`tab-${t.id}`}
                    aria-controls="farm-panel"
                    onClick={() => setTab(t.id)}
                    className={`-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#17476b] ${on ? "border-[#17476b] font-bold text-[#17476b]" : "border-transparent font-medium text-[#526477] hover:text-[#203648]"}`}
                  >
                    <I size={16} aria-hidden />{t.label}
                  </button>
                );
              })}
              </div>
              <div className="pb-3 text-xs text-[#526477] sm:text-right">
                <p className="m-0 flex items-center gap-1.5 font-semibold text-[#31475a] sm:justify-end"><MapPin size={14} aria-hidden />{place.name}</p>
                <p className="m-0 mt-1 tabular-nums">{place.lat.toFixed(2)}, {place.lon.toFixed(2)} <span className="px-1 text-[#a2afbb]">·</span><span className="capitalize">{crop}</span><span className="px-1 text-[#a2afbb]">·</span>{irrigation === "unknown" ? "Water source not specified" : irrigation === "irrigated" ? "Irrigated" : "Rainfed"}</p>
              </div>
            </div>
          </div>
          <div id="farm-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="pt-4">
            {tab === "calendar" && <CalendarTab lat={place.lat} lon={place.lon} crop={crop} irrigation={irrigation} />}
            {tab === "weather" && <WeatherTab lat={place.lat} lon={place.lon} />}
          </div>
        </>
      )}

      <p className="m-0 border-t border-[#d5dde5] pt-4 text-xs leading-5 text-[#607487]">
        Forecast and climate data: <a className="font-medium text-[#17476b] underline underline-offset-2" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> (CC BY 4.0). Planting guidance is an estimate, not an official government classification. For official warnings, visit <a className="font-medium text-[#17476b] underline underline-offset-2" href="https://www.pagasa.dost.gov.ph/" target="_blank" rel="noreferrer">PAGASA</a>.
      </p>
    </div>
  );
}