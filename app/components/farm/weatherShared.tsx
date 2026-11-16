"use client";
// Small pieces shared by the Weather tab and the weather panel on the Planting Calendar.
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSun, Sun } from "lucide-react";
import { weatherInfo, type WeatherIcon } from "../../lib/farm/labels";
import type { Forecast, Provenance } from "../../lib/farm/types";

export interface WeatherResp { forecast: Forecast; provenance: Provenance }

const ICONS: Record<WeatherIcon, typeof Sun> = { sun: Sun, partly: CloudSun, cloud: Cloud, fog: CloudFog, drizzle: CloudDrizzle, rain: CloudRain, storm: CloudLightning };
// Icon colour and the soft background of the weather cards follow the weather, so it reads at a glance.
export const GLYPH_COLOR: Record<WeatherIcon, string> = { sun: "#d98e04", partly: "#4a88b8", cloud: "#5b6672", fog: "#7a8da3", drizzle: "#1b6aa5", rain: "#1b6aa5", storm: "#4b3f8f" };
export const TINT: Record<WeatherIcon, string> = { sun: "#fff3d0", partly: "#e6f2fb", cloud: "#e9edf2", fog: "#eceff3", drizzle: "#e0edf7", rain: "#d8e7f3", storm: "#d9dce9" };

export const WeatherGlyph = ({ code, size = 28 }: { code: number | null; size?: number }) => {
  const info = weatherInfo(code);
  const I = ICONS[info.icon];
  return <I size={size} aria-label={info.label} role="img" style={{ color: GLYPH_COLOR[info.icon] }} />;
};

export const n = (v: number | null, d = 0) => (v == null ? "-" : v.toFixed(d));
export const weekday = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-PH", { weekday: "short" });
export const monthDay = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" });
