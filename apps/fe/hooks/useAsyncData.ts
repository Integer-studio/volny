import { useEffect, useRef, useState, DependencyList } from 'react';
import { useDeferredPending } from './useDeferredPending';
import { readCacheSync, writeCache } from '../lib/cache';
import { api } from '../lib/api';

type AsyncDataState<T> = {
  data: T | undefined;
  error: Error | null;
  pending: boolean;
  showSpinner: boolean;
  /** True while `data` is still whatever came from the cache and no fetch has succeeded yet this mount. */
  isStale: boolean;
  /** Timestamp of the data currently shown - from the cache write, or Date.now() once a live fetch has succeeded. */
  dataTs: number | null;
  /**
   * True once the first fetch of this mount has finished, successfully or
   * not. An error/empty state is only meaningful to show once this is true -
   * rendering it earlier is what caused things like "Profil se nepodařilo
   * načíst." to flash on every open, during the (up to 600ms) gap before
   * showSpinner turns on.
   */
  settled: boolean;
  reload: () => void;
};

type Options<T> = {
  /** Enables persistent caching for this call under this key. Must vary with any dep the fetcher itself depends on (e.g. `group:${id}`), or a stale entry's data will seed the wrong id. */
  cacheKey?: string;
  /** Runs only on the cache-read path, to restore types JSON can't carry (e.g. Date). A throw here evicts the cached entry instead of crashing the screen. */
  revive?: (raw: unknown) => T;
};

/**
 * Fetches `fetcher()` whenever `deps` change, but never clears `data` on a
 * refetch or an error - only a successful call overwrites it. Combined with
 * useDeferredPending this gives "stale content + spinner only if it's
 * actually slow" instead of the list flashing empty on every refresh.
 *
 * With `opts.cacheKey`, `data` is additionally seeded synchronously from the
 * persistent cache on first mount (see lib/cache.ts - this relies on
 * hydrateCache() having already run in the auth bootstrap, so the read here
 * is a plain in-memory lookup, not a promise) and written back to it on
 * every successful fetch.
 */
export function useAsyncData<T>(fetcher: () => Promise<T>, deps: DependencyList, opts?: Options<T>): AsyncDataState<T> {
  const cacheKey = opts?.cacheKey;
  const revive = opts?.revive;

  const seedFromCache = (): { data: T | undefined; ts: number | null; stale: boolean } => {
    if (!cacheKey) return { data: undefined, ts: null, stale: false };
    const userId = api.getCurrentUserId();
    if (userId == null) return { data: undefined, ts: null, stale: false };
    const hit = readCacheSync<unknown>(String(userId), cacheKey);
    if (!hit) return { data: undefined, ts: null, stale: false };
    try {
      const data = (revive ? revive(hit.data) : hit.data) as T;
      return { data, ts: hit.ts, stale: true };
    } catch {
      return { data: undefined, ts: null, stale: false };
    }
  };

  const [seed] = useState(() => seedFromCache());
  const [data, setData] = useState<T | undefined>(seed.data);
  const [error, setError] = useState<Error | null>(null);
  const [pending, setPending] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);
  const [dataTs, setDataTs] = useState<number | null>(seed.ts);
  const [isStale, setIsStale] = useState(seed.stale);
  const [settled, setSettled] = useState(false);

  const alive = useRef(true);
  const runId = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // Re-seed if cacheKey itself changes (e.g. navigating from one group's
  // detail screen to another re-uses this hook instance under a new key).
  useEffect(() => {
    const seed = seedFromCache();
    setData(seed.data);
    setDataTs(seed.ts);
    setIsStale(seed.stale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  useEffect(() => {
    const myRunId = ++runId.current;
    setPending(true);
    fetcher()
      .then(result => {
        if (!alive.current || myRunId !== runId.current) return;
        setData(result);
        setError(null);
        setIsStale(false);
        setDataTs(Date.now());
        if (cacheKey) {
          const userId = api.getCurrentUserId();
          if (userId != null) writeCache(String(userId), cacheKey, result);
        }
      })
      .catch(e => {
        if (!alive.current || myRunId !== runId.current) return;
        setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (!alive.current || myRunId !== runId.current) return;
        setPending(false);
        setSettled(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadTick]);

  // Cache-seeded (or otherwise already-present) data suppresses the spinner
  // by construction - useDeferredPending's timer is cleared the instant its
  // input goes false, so a cache hit means the 600ms spinner is never even
  // scheduled. This replaces the `showSpinner && data === undefined` guard
  // every call site used to write out by hand.
  const showSpinner = useDeferredPending(pending && data === undefined);

  return { data, error, pending, showSpinner, isStale, dataTs, settled, reload: () => setReloadTick(t => t + 1) };
}
