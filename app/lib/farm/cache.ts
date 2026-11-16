// Small in-memory TTL cache with in-flight de-duplication, stale-while-revalidate and stale
// fallback. Per server instance only; the persistent layer is Next.js's own fetch cache (see
// `revalidateSec` in http.ts). Callers only use `cached`.
//
//   age < ttlMs                 -> served as is
//   ttlMs <= age < ttlMs + swr  -> served instantly, refreshed in the background
//   older                       -> reloaded (the caller waits); if that fails the old value is
//                                  served and flagged stale instead of showing an error

interface Entry<T> {
  value: T;
  storedAt: number;
}

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<Entry<unknown>>>();
const MAX_ENTRIES = 500;

/** Starts (or joins) the single load for `key`. The result is stored here, not by the caller, so a
 *  caller that gives up waiting (see getForecast) still leaves the value in the cache. */
function refresh<T>(key: string, load: () => Promise<T>): Promise<Entry<T>> {
  let p = inflight.get(key) as Promise<Entry<T>> | undefined;
  if (!p) {
    p = load()
      .then(value => {
        const entry: Entry<T> = { value, storedAt: Date.now() };
        if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value as string);
        store.set(key, entry);
        return entry;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, p as Promise<Entry<unknown>>);
  }
  return p;
}

export async function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
  opts: { swrMs?: number } = {}
): Promise<{ value: T; stale: boolean; storedAt: number }> {
  const hit = store.get(key) as Entry<T> | undefined;
  const age = hit ? Date.now() - hit.storedAt : Infinity;
  if (hit && age < ttlMs) return { value: hit.value, stale: false, storedAt: hit.storedAt };
  if (hit && age < ttlMs + (opts.swrMs ?? 0)) {
    refresh(key, load).catch(() => { /* keep serving the old value; the next request tries again */ });
    return { value: hit.value, stale: false, storedAt: hit.storedAt };
  }
  try {
    const e = await refresh(key, load);
    return { value: e.value, stale: false, storedAt: e.storedAt };
  } catch (err) {
    // Provider failed: serve the last known value (flagged stale) instead of nothing.
    if (hit) return { value: hit.value, stale: true, storedAt: hit.storedAt };
    throw err;
  }
}

export function clearFarmCache() {
  store.clear();
  inflight.clear();
}
