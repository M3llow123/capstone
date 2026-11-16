import { NextRequest, NextResponse } from "next/server";
import { parseCoordinates } from "./validation";
import type { Coordinates, FarmErrorCode } from "./types";

// Public endpoints (farmers / LGUs do not log in), so keep abuse in check: coordinates must be
// inside the Philippines, results are cached, and each client IP gets a modest request budget.
// The limiter is per server instance (best-effort); it is not a substitute for platform limits.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;
const hits = new Map<string, { n: number; reset: number }>();

function clientKey(req: NextRequest): string {
  return (
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local"
  );
}

export function rateLimited(req: NextRequest, now = Date.now()): boolean {
  const k = clientKey(req);
  const e = hits.get(k);
  if (!e || e.reset < now) {
    if (hits.size > 5000) hits.clear();
    hits.set(k, { n: 1, reset: now + WINDOW_MS });
    return false;
  }
  e.n++;
  return e.n > MAX_PER_WINDOW;
}

export function guard(req: NextRequest): { coords: Coordinates } | NextResponse {
  if (rateLimited(req)) {
    return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
  }
  const p = req.nextUrl.searchParams;
  const coords = parseCoordinates(p.get("lat"), p.get("lon"));
  if (!coords) {
    return NextResponse.json(
      { error: "Provide valid lat and lon inside the Philippines." },
      { status: 400 }
    );
  }
  return { coords };
}

const STATUS: Record<FarmErrorCode, number> = {
  invalid_input: 400, timeout: 504, network: 502, rate_limited: 503, upstream: 502, no_data: 404,
};

export function errorResponse(error: { code: FarmErrorCode; message: string }) {
  return NextResponse.json({ error: error.message, code: error.code }, { status: STATUS[error.code] });
}

/**
 * Headers that let a CDN / the browser reuse a response (all farm data is public and keyed by
 * location). Pass 0 for responses that must not be reused, such as ones built from stale data.
 */
export function cacheHeaders(seconds: number): HeadersInit {
  return seconds > 0
    ? { "Cache-Control": `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=${seconds * 6}` }
    : { "Cache-Control": "no-store" };
}
