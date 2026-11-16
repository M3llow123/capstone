import { NextRequest, NextResponse } from "next/server";
import { cacheHeaders, errorResponse, guard } from "../../../lib/farm/apiHelpers";
import { summarizeMonthly } from "../../../lib/farm/climate";
import { getDailyHistory } from "../../../lib/farm/openMeteo";

// Public: multi-year monthly climate statistics (ERA5 reanalysis via Open-Meteo).
export async function GET(req: NextRequest) {
  const g = guard(req);
  if (g instanceof NextResponse) return g;
  const years = Number(req.nextUrl.searchParams.get("years") ?? 10);
  const r = await getDailyHistory(g.coords, Number.isFinite(years) ? years : 10);
  if (!r.ok) return errorResponse(r.error);
  const { months, options } = summarizeMonthly(r.data);
  return NextResponse.json({ months, thresholds: options, provenance: r.provenance }, { headers: cacheHeaders(r.provenance.stale ? 0 : 86400) });
}
