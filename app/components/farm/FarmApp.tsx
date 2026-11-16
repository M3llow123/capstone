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

  const sel = "w-full rounded border border-[#ccd4df] bg-white px-3 py-2 text-sm text-[#1c2b3a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#003087]";
  const lbl = "mb-1 block text-xs font-bold text-[#1c2b3a]";
  const provValue = PROVINCES.some(p => p.name === place?.name) ? place!.name : "";

  return (
    <div className="space-y-3">
      <Card>
        <div className="grid gap-2 md:grid-cols-12 md:items-end">
          <div className="md:col-span-4">
            <label className={lbl} htmlFor="prov">Province</label>
            <select id="prov" className={sel} value={provValue} onChange={e => { const p = PROVINCES.find(x => x.name === e.target.value); if (p) choose(p); }}>
              <option value="">Choose a province...</option>
              {PROVINCES.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div className="md:col-span-3">
            <button onClick={useMyLocation} className="inline-flex w-full items-center justify-center gap-2 rounded border border-[#003087] bg-white px-3 py-2 text-sm font-bold text-[#003087] hover:bg-[#eef3fb]">
              <LocateFixed size={16} /> Use my location
            </button>
          </div>
          <div className="md:col-span-2">
            <span className={lbl}>Crop</span>
            <div role="radiogroup" aria-label="Crop" className="flex overflow-hidden rounded border border-[#003087]">
              {(["rice", "corn"] as Crop[]).map(c => (
                <button key={c} role="radio" aria-checked={crop === c} onClick={() => setCrop(c)} className="flex-1 px-3 py-2 text-sm font-bold capitalize" style={{ background: crop === c ? "#003087" : "#fff", color: crop === c ? "#fff" : "#003087" }}>{c}</button>
              ))}
            </div>
          </div>
          <div className="md:col-span-3">
            <label className={lbl} htmlFor="irr">Field water</label>
            <select id="irr" className={sel} value={irrigation} onChange={e => setIrrigation(e.target.value as Irrigation)}>
              <option value="unknown">Not sure / skip</option>
              <option value="irrigated">Irrigated (canal, pump)</option>
              <option value="rainfed">Rainfed (depends on rain)</option>
            </select>
          </div>
        </div>
        <div className="mt-2 text-xs">
          <button type="button" onClick={() => setShowMap(v => !v)} aria-expanded={showMap} className="text-[#003087] underline">
            {showMap ? "Hide map" : "Pick on the map"}
          </button>
          {showMap && (
            <div className="mt-1">
              <PhilippinesMap selected={place} onPick={(lat, lon) => choose({ name: MAP_POINT, lat, lon })} />
              <p className="m-0 mt-1 text-[11px] text-[#5b6672]">Click a spot to see the planting calendar and weather for it.</p>
            </div>
          )}
        </div>
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-[#003087]">Use exact farm coordinates</summary>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <div className="w-28"><label className={lbl} htmlFor="lat">Latitude</label><input id="lat" inputMode="decimal" className={sel} value={manual.lat} onChange={e => setManual(m => ({ ...m, lat: e.target.value }))} placeholder="15.54" /></div>
            <div className="w-28"><label className={lbl} htmlFor="lon">Longitude</label><input id="lon" inputMode="decimal" className={sel} value={manual.lon} onChange={e => setManual(m => ({ ...m, lon: e.target.value }))} placeholder="121.08" /></div>
            <button onClick={applyManual} className="rounded bg-[#003087] px-3 py-2 text-sm font-bold text-white">Use these</button>
          </div>
        </details>
        {msg && <p role="status" className="m-0 mt-1 text-xs text-[#7a1c1c]">{msg}</p>}
      </Card>

      {!place ? (
        <Empty>Choose a province or use your location above to see planting advice and the weather forecast for your farm.</Empty>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b border-[#ccd4df]">
            <div role="tablist" aria-label="Farm information" className="flex flex-wrap gap-1">
              {TABS.map(t => {
                const on = tab === t.id; const I = t.icon;
                return (
                  <button key={t.id} role="tab" aria-selected={on} id={`tab-${t.id}`} aria-controls="farm-panel" onClick={() => setTab(t.id)}
                    className="-mb-px flex items-center gap-1.5 rounded-t border px-3 py-1.5 text-sm"
                    style={{ background: on ? "#fff" : "transparent", borderColor: on ? "#ccd4df" : "transparent", borderBottomColor: on ? "#fff" : "#ccd4df", fontWeight: on ? 700 : 400, color: "#1c2b3a" }}>
                    <I size={15} />{t.label}
                  </button>
                );
              })}
            </div>
            <p className="m-0 flex items-center gap-1 pb-1 text-xs text-[#1c2b3a]"><MapPin size={13} /> <strong>{place.name}</strong>{place.name !== `${place.lat.toFixed(2)}, ${place.lon.toFixed(2)}` && <> ({place.lat.toFixed(2)}, {place.lon.toFixed(2)})</>} &middot; <strong className="capitalize">{crop}</strong></p>
          </div>
          <div id="farm-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
            {tab === "calendar" && <CalendarTab lat={place.lat} lon={place.lon} crop={crop} irrigation={irrigation} />}
            {tab === "weather" && <WeatherTab lat={place.lat} lon={place.lon} />}
          </div>
        </>
      )}

      <p className="m-0 text-[11px] leading-snug text-[#5b6672]">Data: <a className="underline" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo.com</a> (CC BY 4.0). Not official government classifications. For official warnings, see <a className="underline" href="https://www.pagasa.dost.gov.ph/" target="_blank" rel="noreferrer">PAGASA</a>.</p>
    </div>
  );
}