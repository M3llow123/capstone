import dns from "node:dns";
import type { FarmErrorCode } from "./types";

// Server-only. Some Windows / home / school networks hang when connecting over IPv6, which shows up
// as "took too long" or "could not reach" for a provider that works fine in the browser. Trying
// IPv4 first avoids that and costs nothing elsewhere.
try { dns.setDefaultResultOrder("ipv4first"); } catch { /* older Node or locked-down runtime: keep the default */ }

export class FarmApiError extends Error {
  constructor(public code: FarmErrorCode, message: string) {
    super(message);
  }
}

interface Options {
  timeoutMs?: number;
  retries?: number;
  /**
   * Keep the response in Next.js's persistent fetch cache for this many seconds. After that the
   * old copy is still served instantly while a fresh one is fetched in the background, and it
   * survives server restarts. Without this the request always goes to the provider.
   */
  revalidateSec?: number;
  /** Retry after a timeout too. Off by default: a provider that is slow rarely answers faster the second time. */
  retryOnTimeout?: boolean;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * GET JSON with a hard timeout and limited retries (network errors, 429, 5xx).
 * `date` is when the provider produced the response (its Date header), or null if it sent none.
 */
export async function fetchJsonMeta<T>(url: string, opts: Options = {}): Promise<{ data: T; date: number | null }> {
  const { timeoutMs = 15000, retries = 1, revalidateSec, retryOnTimeout = false } = opts;
  let last = new FarmApiError("network", "Request failed.");

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let retryable = true;
    try {
      // `next` is Next.js's fetch extension; plain fetch (tests, scripts) ignores it.
      const init: RequestInit & { next?: { revalidate: number } } = {
        signal: ctrl.signal,
        headers: { Accept: "application/json" },
      };
      if (revalidateSec) init.next = { revalidate: revalidateSec };
      else init.cache = "no-store";
      const res = await fetch(url, init);
      if (res.ok) {
        const data = (await res.json()) as T;
        const d = Date.parse(res.headers.get("date") ?? "");
        return { data, date: Number.isFinite(d) ? d : null };
      }
      if (res.status === 429) last = new FarmApiError("rate_limited", "Data provider rate limit reached.");
      else if (res.status >= 500) last = new FarmApiError("upstream", `Data provider error (${res.status}).`);
      else {
        last = new FarmApiError("upstream", `Data provider rejected the request (${res.status}).`);
        retryable = false; // 4xx other than 429: retrying will not help
      }
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") {
        last = new FarmApiError("timeout", "Data provider took too long to respond.");
        retryable = retryOnTimeout;
      } else last = new FarmApiError("network", "Could not reach the data provider.");
    } finally {
      clearTimeout(timer);
    }
    if (!retryable) break;
    if (attempt < retries) await sleep(500 * (attempt + 1));
  }
  throw last;
}

export async function fetchJson<T>(url: string, opts: Options = {}): Promise<T> {
  return (await fetchJsonMeta<T>(url, opts)).data;
}
