import { NextRequest, NextResponse } from "next/server";
import { cacheHeaders, errorResponse, guard } from "../../../lib/farm/apiHelpers";
import { summarizeMonthly } from "../../../lib/farm/climate";
import { getDailyHistory, getForecast } from "../../../lib/farm/openMeteo";
import { recommend } from "../../../lib/farm/recommendation";
import { parseCrop, parseIrrigation, parseMonth } from "../../../lib/farm/validation";

// Public: planting recommendation.
//   mode=historical&month=1..12 -> is that month generally favorable (multi-year climate)
//   mode=current                -> plant in the next few days? (adds the short-range forecast)
export async function GET(req: NextRequest) {
  const g = guard(req);
  if (g instanceof NextResponse) return g;
  const p = req.nextUrl.searchParams;

  const crop = parseCrop(p.get("crop"));
  if (!crop) return NextResponse.json({ error: "crop must be 'rice' or 'corn'." }, { status: 400 });
  const mode = p.get("mode") === "current" ? "current" : "historical";
  const now = new Date();
  const month = mode === "current" ? now.getUTCMonth() + 1 : parseMonth(p.get("month"));
  if (!month) return NextResponse.json({ error: "month must be 1-12." }, { status: 400 });

  const [hist, fc] = await Promise.all([
    getDailyHistory(g.coords, 10),
    mode === "current" ? getForecast(g.coords) : Promise.resolve(null),
  ]);

  const rec = recommend({
    crop,
    irrigation: parseIrrigation(p.get("irrigation")),
    plantingMonth: month,
    coordinates: g.coords,
    mode,
    climate: hist.ok ? summarizeMonthly(hist.data).months : null,
    forecast: fc?.ok ? fc.data : null,
    now,
  });
  if (!hist.ok && rec.assessment === "insufficient_data" && hist.error.code !== "no_data") {
    return errorResponse(hist.error);
  }
  const stale = (hist.ok && hist.provenance.stale) || (fc?.ok && fc.provenance.stale);
  return NextResponse.json(
    {
      recommendation: rec,
      dataStatus: {
        history: hist.ok ? hist.provenance : hist.error,
        forecast: fc ? (fc.ok ? fc.provenance : fc.error) : null,
      },
    },
    { headers: cacheHeaders(stale ? 0 : mode === "current" ? 600 : 3600) }
  );
}
