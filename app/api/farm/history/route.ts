import { NextRequest, NextResponse } from "next/server";
import { cacheHeaders, errorResponse, guard } from "../../../lib/farm/apiHelpers";
import { buildHistoryResponse } from "../../../lib/farm/history";
import { getDailyHistory, historyRequest } from "../../../lib/farm/openMeteo";

// Public: the daily ERA5 data behind the planting calendar, with the monthly summary, the
// year-by-month rainfall matrix and the exact Open-Meteo request, so anyone can verify it.
// It goes through getDailyHistory, so it shares the cache with /api/farm/climate, /calendar and
// /recommendation: opening this page never makes a duplicate Open-Meteo request.
export async function GET(req: NextRequest) {
  const g = guard(req);
  if (g instanceof NextResponse) return g;
  // Only the two periods the page offers; anything else falls back to 10 (also keeps cache keys few).
  const years = Number(req.nextUrl.searchParams.get("years")) === 5 ? 5 : 10;
  const now = new Date();
  const r = await getDailyHistory(g.coords, years, now);
  if (!r.ok) return errorResponse(r.error);
  const { url } = historyRequest(g.coords, years, now);
  return NextResponse.json(buildHistoryResponse(r.data, r.provenance, { url, years }), {
    headers: cacheHeaders(r.provenance.stale ? 0 : 86400),
  });
}
