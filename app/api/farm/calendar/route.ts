import { NextRequest, NextResponse } from "next/server";
import { cacheHeaders, errorResponse, guard } from "../../../lib/farm/apiHelpers";
import { summarizeMonthly } from "../../../lib/farm/climate";
import { getDailyHistory } from "../../../lib/farm/openMeteo";
import { buildCalendarDetailed, DISCLAIMER } from "../../../lib/farm/recommendation";
import { parseCrop, parseIrrigation } from "../../../lib/farm/validation";

// Public: historical suitability of all 12 months for a crop at a location, with the full
// recommendation for each month (so picking a month needs no further request).
export async function GET(req: NextRequest) {
  const g = guard(req);
  if (g instanceof NextResponse) return g;
  const p = req.nextUrl.searchParams;
  const crop = parseCrop(p.get("crop"));
  if (!crop) return NextResponse.json({ error: "crop must be 'rice' or 'corn'." }, { status: 400 });

  const hist = await getDailyHistory(g.coords, 10);
  if (!hist.ok) return errorResponse(hist.error);

  const { months } = summarizeMonthly(hist.data);
  const { calendar, recommendations } = buildCalendarDetailed({
    crop,
    irrigation: parseIrrigation(p.get("irrigation")),
    coordinates: g.coords,
    climate: months,
  });
  return NextResponse.json(
    { crop, calendar, recommendations, months, disclaimer: DISCLAIMER },
    { headers: cacheHeaders(hist.provenance.stale ? 0 : 3600) }
  );
}
