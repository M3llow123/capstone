import { NextRequest, NextResponse } from "next/server";
import { guard } from "../../../lib/farm/apiHelpers";
import { fetchJson } from "../../../lib/farm/http";

// Public health check: calls each outside provider once (tiny request, no cache) and reports
// which ones work from THIS server. Open /api/farm/status?lat=15.54&lon=121.08 to diagnose.
async function probe(url: string) {
  const t0 = Date.now();
  try {
    await fetchJson(url, { timeoutMs: 20000, retries: 0 });
    return { ok: true, ms: Date.now() - t0 };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return { ok: false, ms: Date.now() - t0, code: err.code ?? "unknown", message: err.message ?? "Failed" };
  }
}

export async function GET(req: NextRequest) {
  const g = guard(req);
  if (g instanceof NextResponse) return g;
  const { lat, lon } = g.coords;
  const [forecast, history] = await Promise.all([
    probe(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m`),
    probe(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=2024-01-01&end_date=2024-01-03&daily=precipitation_sum`),
  ]);
  return NextResponse.json({
    "Open-Meteo forecast (weather tab)": forecast,
    "Open-Meteo history (calendar, rainfall, temperature, risk)": history,
  });
}