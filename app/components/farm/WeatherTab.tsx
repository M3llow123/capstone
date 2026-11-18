"use client";
import { memo, type ReactNode } from "react";
import { AlertTriangle, Cloud, CloudDrizzle, CloudRain, Droplets, Info, Sun, Wind } from "lucide-react";
import { forecastInsights, type Insight } from "../../lib/farm/insights";
import { weatherInfo, windDirection } from "../../lib/farm/labels";
import type { ForecastDay } from "../../lib/farm/types";
import { BarChart } from "./charts";
import { Card, CardSkeleton, ErrorBox, Notice } from "./ui";
import { TTL, useApi } from "./useApi";
import { GLYPH_COLOR, monthDay, n, weekday, WeatherGlyph, type WeatherResp } from "./weatherShared";

const LEVEL: Record<Insight["level"], { icon: typeof Info; bg: string; border: string; fg: string }> = {
  alert: { icon: AlertTriangle, bg: "#fdecea", border: "#f1b7b2", fg: "#c62828" },
  watch: { icon: AlertTriangle, bg: "#fff6e8", border: "#f3c98b", fg: "#c26a00" },
  info: { icon: Info, bg: "#eef6fb", border: "#b6d6ea", fg: "#1b6aa5" },
};

const hourTip = (iso: string) => new Date(iso).toLocaleString("en-PH", { weekday: "short", hour: "numeric", minute: "2-digit" });

function WeatherTab({ lat, lon }: { lat: number; lon: number }) {
  const r = useApi<WeatherResp>(`/api/farm/weather?lat=${lat}&lon=${lon}`, TTL.forecast);
  if (r.loading) return (
    <div role="status" aria-busy="true" aria-label="Getting the latest forecast" className="space-y-3">
      <div className="grid items-start gap-4 lg:grid-cols-2"><CardSkeleton lines={5} variant="farm" /><CardSkeleton lines={5} variant="farm" /></div>
      <CardSkeleton lines={4} variant="farm" />
      <CardSkeleton lines={5} variant="farm" />
    </div>
  );
  if (r.error) return <ErrorBox message={r.error} onRetry={r.refetch} variant="farm" />;
  if (!r.data) return null;
  const { forecast: f, provenance } = r.data;
  const c = f.current;
  const today = f.daily[0] as ForecastDay | undefined;
  const insights = forecastInsights(f.daily);
  const week = f.daily.slice(0, 7);
  const later = f.daily.slice(7);

  // "Next 48 hours" starts from the current hour (the hourly list begins at midnight today).
  const startIdx = c ? Math.max(0, f.hourly.findIndex(h => h.time >= c.time.slice(0, 13))) : 0;
  const next48 = f.hourly.slice(startIdx, startIdx + 48);
  const rain48 = next48.reduce((a, h) => a + (h.precipitationMm ?? 0), 0);
  const peakGust = Math.max(0, ...next48.map(h => h.windGustsKmh ?? 0));
  const peakChance = Math.max(0, ...next48.map(h => h.precipitationProbabilityPct ?? 0));
  const hourLabel = (iso: string, i: number) => (i % 6 !== 0 ? "" : iso.slice(11, 13) === "00" ? new Date(iso).toLocaleDateString("en-PH", { weekday: "short" }) : iso.slice(11, 13) + "h");
  return (
    <div className="space-y-3">
      {provenance.stale && <Notice tone="warn">The weather service could not be reached, so this is the last saved forecast from {new Date(provenance.retrievedAt).toLocaleString("en-PH")}. It may be out of date.</Notice>}

      <div className={`grid gap-4 ${c ? "lg:grid-cols-2" : ""}`}>
        {c && (
          <section aria-label="Weather right now" className="border border-[#d5dde5] bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="m-0 text-sm font-bold text-[#1c2b3a]">Right now</h3>
              <span className="text-xs text-[#607487]">Forecast model · updated {new Date(provenance.retrievedAt).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <div className="mt-3 flex items-center gap-4 text-[#1c2b3a]">
              <WeatherGlyph code={c.weatherCode} size={56} />
              <div>
                <div className="text-5xl font-bold leading-none">{n(c.temperatureC)}°C</div>
                <div className="mt-1.5 text-sm">{weatherInfo(c.weatherCode).label}{c.apparentTemperatureC != null && <span className="text-[#3a4652]"> &middot; feels like {n(c.apparentTemperatureC)}°C</span>}</div>
                {today && <div className="mt-0.5 text-xs text-[#3a4652]">Today: high <strong>{n(today.tempMaxC)}°</strong> &middot; low <strong>{n(today.tempMinC)}°</strong></div>}
              </div>
            </div>
            <dl className="m-0 mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat label="Humidity" value={`${n(c.humidityPct)}%`} icon={<Droplets size={13} />} />
              <Stat label="Rain, last hour" value={`${n(c.precipitationMm, 1)} mm`} icon={<CloudRain size={13} />} />
              <Stat label="Rain chance today" value={`${n(today?.precipitationProbabilityMaxPct ?? null)}%`} icon={<CloudDrizzle size={13} />} />
              <Stat label="Wind" value={`${n(c.windSpeedKmh)} km/h ${windDirection(c.windDirectionDeg)}`} icon={<Wind size={13} />} />
              <Stat label="Gusts" value={`${n(c.windGustsKmh)} km/h`} icon={<Wind size={13} />} />
              <Stat label="Cloud cover" value={`${n(c.cloudCoverPct)}%`} icon={<Cloud size={13} />} />
            </dl>
          </section>
        )}

        <Card variant="farm" title="Weather notes for your farm">
          <ul className="m-0 list-none space-y-2 p-0">
            {insights.map(i => {
              const s = LEVEL[i.level]; const I = s.icon;
              return (
                <li key={i.title} className="flex gap-2.5 border px-3 py-2.5 text-xs text-[#1c2b3a]" style={{ background: s.bg, borderColor: s.border }}>
                  <I size={16} className="mt-0.5 shrink-0" style={{ color: s.fg }} aria-hidden />
                  <div>
                    <p className="m-0 font-bold">{i.title}</p>
                    <p className="m-0 mt-0.5 leading-snug text-[#3a4652]">{i.text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-3"><Notice>App-generated from the forecast, <strong>not</strong> official PAGASA warnings. For official advisories, visit <a className="underline" href="https://www.pagasa.dost.gov.ph/" target="_blank" rel="noreferrer">pagasa.dost.gov.ph</a>.</Notice></div>
        </Card>
      </div>

      <Card variant="farm" title="16-day forecast" right={<span className="text-xs text-[#607487]">Days 8–16 are a rough guide</span>}>
        <h4 className="m-0 mb-2 text-xs font-bold uppercase tracking-wide text-[#607487]">Next 7 days</h4>
        <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-4 lg:grid-cols-7">
          {week.map((d, i) => {
            const chance = d.precipitationProbabilityMaxPct;
            return (
              <li key={d.date} className={`border p-2.5 text-center text-[#1c2b3a] ${i === 0 ? "col-span-2 sm:col-span-1" : ""}`} style={i === 0 ? { background: "#f2f6f8", borderColor: "#7895a9" } : { background: "#fff", borderColor: "#d5dde5" }}>
                <p className="m-0 text-xs font-bold">{i === 0 ? "Today" : weekday(d.date)}</p>
                <p className="m-0 text-[11px] text-[#5b6672]">{monthDay(d.date)}</p>
                <div className="my-1.5 flex justify-center"><WeatherGlyph code={d.weatherCode} size={28} /></div>
                <p className="m-0 text-sm font-bold">{n(d.tempMaxC)}° <span className="font-normal text-[#5b6672]">/ {n(d.tempMinC)}°</span></p>
                <div className="mt-2 h-1 w-full bg-[#e8edf2]" aria-hidden><div className="h-1 bg-[#3f789c]" style={{ width: `${Math.min(100, chance ?? 0)}%` }} /></div>
                <p className="m-0 mt-1.5 text-[11px] text-[#315d78]">{n(chance)}% rain · {n(d.precipitationSumMm, 1)} mm</p>
              </li>
            );
          })}
        </ul>

        {later.length > 0 && (
          <>
            <h4 className="m-0 mb-2 mt-5 border-t border-[#e4e9ee] pt-4 text-xs font-bold uppercase tracking-wide text-[#607487]">Days 8 to 16</h4>
            <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0 sm:grid-cols-5 lg:grid-cols-9">
              {later.map(d => (
                <li key={d.date} className="border border-[#dfe5ea] bg-[#f8fafb] p-2 text-center text-[#1c2b3a]">
                  <p className="m-0 text-[11px] font-bold">{weekday(d.date)} {new Date(d.date + "T00:00:00").getDate()}</p>
                  <div className="my-1 flex justify-center"><WeatherGlyph code={d.weatherCode} size={20} /></div>
                  <p className="m-0 text-xs font-bold">{n(d.tempMaxC)}° <span className="font-normal text-[#5b6672]">{n(d.tempMinC)}°</span></p>
                  <p className="m-0 text-[11px] text-[#1b6aa5]">{n(d.precipitationProbabilityMaxPct)}% rain</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card variant="farm" title="Next 48 hours">
        <ul className="m-0 mb-4 flex list-none flex-wrap gap-2 p-0">
          <Chip icon={<CloudRain size={13} />} label="Rain expected" value={`${rain48.toFixed(1)} mm`} />
          <Chip icon={<Droplets size={13} />} label="Highest rain chance" value={`${peakChance}%`} />
          <Chip icon={<Wind size={13} />} label="Strongest gust" value={`${n(peakGust)} km/h`} />
        </ul>
        <div className="grid gap-4 md:grid-cols-2">
          {rain48 < 0.05 ? (
            <figure className="m-0">
              <figcaption className="mb-1 text-sm font-bold text-[#1c2b3a]">Rain per hour</figcaption>
              <div className="flex min-h-28 items-center justify-center gap-3 border border-dashed border-[#b6d6ea] bg-[#f6f9fb] p-4 text-[#1c2b3a]">
                <Sun size={30} style={{ color: GLYPH_COLOR.sun }} aria-hidden />
                <div>
                  <p className="m-0 text-sm font-bold">No rain expected</p>
                  <p className="m-0 text-xs text-[#5b6672]">The next 48 hours look dry. Highest chance of rain: {peakChance}%.</p>
                </div>
              </div>
            </figure>
          ) : (
            <BarChart title="Rain per hour" unit="mm" height={120} data={next48.map((h, i) => ({ label: hourLabel(h.time, i), value: h.precipitationMm, tip: hourTip(h.time), note: `${h.precipitationProbabilityPct ?? "-"}% chance` }))} />
          )}
          <BarChart title="Wind gusts" unit="km/h" height={120} barColor="#7a8da3" data={next48.map((h, i) => ({ label: hourLabel(h.time, i), value: h.windGustsKmh, tip: hourTip(h.time) }))} />
        </div>
      </Card>
    </div>
  );
}

export default memo(WeatherTab);

function Stat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="border border-[#e2e8ed] bg-[#fafbfc] px-2.5 py-2">
      <dt className="flex items-center gap-1.5 text-xs text-[#607487]"><span className="text-[#3f789c]">{icon}</span>{label}</dt>
      <dd className="m-0 mt-1 text-sm font-semibold tabular-nums text-[#1c2b3a]">{value}</dd>
    </div>
  );
}

function Chip({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <li className="flex items-center gap-1.5 border border-[#d5dde5] bg-[#f8fafb] px-2.5 py-1.5 text-xs text-[#31475a]">
      <span className="text-[#3f789c]">{icon}</span>{label}: <strong className="tabular-nums">{value}</strong>
    </li>
  );
}
