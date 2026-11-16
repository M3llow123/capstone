import { NextRequest, NextResponse } from "next/server";
import { cacheHeaders, errorResponse, guard } from "../../../lib/farm/apiHelpers";
import { getForecast } from "../../../lib/farm/openMeteo";

// Public: current weather + 16-day forecast for a farm's coordinates (forecast data, not observations).
export async function GET(req: NextRequest) {
  const g = guard(req);
  if (g instanceof NextResponse) return g;
  const r = await getForecast(g.coords);
  if (!r.ok) return errorResponse(r.error);
  return NextResponse.json({ forecast: r.data, provenance: r.provenance }, { headers: cacheHeaders(r.provenance.stale ? 0 : 600) });
}
