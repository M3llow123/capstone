"use client";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

export interface ApiState<T> {
  data: T | null;
  /** Only set when there is nothing to show. If an older copy exists it is kept and no error is raised. */
  error: string | null;
  /** True only while there is nothing to show yet (first load). */
  loading: boolean;
  /** True while an already-shown copy is being refreshed in the background. */
  refreshing: boolean;
  /** Forget the shown error and load again. */
  refetch: () => Promise<void>;
}

// One cache for the whole page, shared by every tab. A tab that is opened again shows what it had
// straight away, and a request that is already running is joined instead of repeated, so two tabs
// that need the same data cause one request. Requests are NOT cancelled when a tab closes: the
// answer still lands in the cache for the next time.
interface Entry { data?: unknown; at: number; error?: string; promise?: Promise<void> }

const store = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();
const MAX_ENTRIES = 60;
const TIMEOUT_MS = 60_000;

/** Default freshness: weather changes, so ask again after this long (shown data stays on screen meanwhile). */
export const TTL = { forecast: 10 * 60_000, recommendation: 30 * 60_000, calendar: 60 * 60_000, history: 24 * 60 * 60_000 };

const emit = (url: string) => listeners.get(url)?.forEach(f => f());
const put = (url: string, e: Entry) => {
  if (!store.has(url) && store.size >= MAX_ENTRIES) store.delete(store.keys().next().value as string);
  store.set(url, e);
  emit(url);
};

/** Fetch `url` into the shared cache. Joins a request that is already running. Never rejects. */
export function load(url: string): Promise<void> {
  const prev = store.get(url);
  if (prev?.promise) return prev.promise;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  const promise = fetch(url, { signal: ac.signal })
    .then(async r => {
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error ?? "Could not load data. Please try again.");
      put(url, { data: j, at: Date.now() });
    })
    .catch(e => {
      const message = (e as Error).name === "AbortError" ? "This is taking too long. Please try again." : (e as Error).message || "Could not load data.";
      const cur = store.get(url);
      put(url, { data: cur?.data, at: cur?.at ?? 0, error: message }); // keep any older copy on screen
    })
    .finally(() => clearTimeout(timer));

  put(url, { data: prev?.data, at: prev?.at ?? 0, promise }); // error cleared: this is a new attempt
  return promise;
}

const subscribe = (url: string | null) => (cb: () => void) => {
  if (!url) return () => {};
  let set = listeners.get(url);
  if (!set) listeners.set(url, (set = new Set()));
  set.add(cb);
  return () => { set!.delete(cb); if (!set!.size) listeners.delete(url); };
};

/** GET JSON from our own /api/farm routes. Pass null to skip. */
export function useApi<T>(url: string | null, ttlMs: number = TTL.recommendation): ApiState<T> {
  const sub = useMemo(() => subscribe(url), [url]);
  const entry = useSyncExternalStore(sub, () => (url ? store.get(url) : undefined), () => undefined);
  useEffect(() => {
    if (!url) return;
    const e = store.get(url);
    if (!e || (!e.promise && Date.now() - e.at > ttlMs)) void load(url); // a failed copy has at=0, so it is retried when the tab is opened again
  }, [url, ttlMs]);
  const refetch = useCallback(() => (url ? load(url) : Promise.resolve()), [url]);

  if (!url) return { data: null, error: null, loading: false, refreshing: false, refetch };
  const hasData = entry?.data !== undefined;
  return {
    data: hasData ? (entry!.data as T) : null,
    error: !hasData && entry?.error ? entry.error : null,
    loading: !hasData && !entry?.error,
    refreshing: hasData && !!entry?.promise,
    refetch,
  };
}
