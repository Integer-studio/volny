import AsyncStorage from '@react-native-async-storage/async-storage';

// Bump this whenever a cached DTO's shape changes - every key from an older
// schema is dropped at the next hydrateCache() rather than risking a stale
// shape reaching a screen that assumes the new one.
const SCHEMA = 1;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days - just a backstop against a long-abandoned install, not a real TTL (see below)
const PREFIX = 'fc:';

type Envelope<T> = { ts: number; data: T };

// In-memory mirror, populated once by hydrateCache() before the app renders
// anything but BootSplash. React wants data synchronously for a first paint;
// AsyncStorage is async. Pre-hydrating into this Map is what makes
// readCacheSync actually synchronous - a bare in-memory mirror without the
// boot hydration step would only help the 2nd+ mount in a session, not the
// first paint after a cold start, which is the one that matters.
const mem = new Map<string, Envelope<unknown>>();
let hydratedFor: string | null = null;

function keyFor(userId: string, name: string): string {
  return `${PREFIX}v${SCHEMA}:u${userId}:${name}`;
}

/**
 * Reads every cache key for this user into the in-memory mirror. Also
 * evicts, in the same pass: keys from a different schema version, keys
 * belonging to a different user (so switching accounts on the same device
 * never leaks a list into the wrong session), and anything older than the
 * 14-day backstop.
 *
 * No real TTL beyond that backstop, deliberately: lists (groups, friends)
 * aren't time-sensitive and get overwritten within a second of the first
 * successful refetch; the free-people list *is* time-sensitive but is
 * self-invalidating - every entry carries its own freeUntil, so the
 * consumer filters on that instead of trusting a clock-based cache TTL.
 */
export async function hydrateCache(userId: string): Promise<void> {
  mem.clear();
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const ownKeys = allKeys.filter(k => k.startsWith(keyFor(userId, '')));
    const staleKeys = allKeys.filter(k => k.startsWith(PREFIX) && !k.startsWith(keyFor(userId, '')));

    if (staleKeys.length > 0) {
      AsyncStorage.multiRemove(staleKeys).catch(() => {});
    }

    if (ownKeys.length > 0) {
      const pairs = await AsyncStorage.multiGet(ownKeys);
      const now = Date.now();
      const expired: string[] = [];
      for (const [key, raw] of pairs) {
        if (!raw) continue;
        try {
          const envelope: Envelope<unknown> = JSON.parse(raw);
          if (now - envelope.ts > MAX_AGE_MS) {
            expired.push(key);
            continue;
          }
          mem.set(key, envelope);
        } catch {
          expired.push(key);
        }
      }
      if (expired.length > 0) AsyncStorage.multiRemove(expired).catch(() => {});
    }
  } catch {
    // AsyncStorage unavailable (rare) - proceed with an empty cache, every
    // screen falls back to its normal loading path.
  }
  hydratedFor = userId;
}

/** Synchronous only because hydrateCache() has already run for this userId - see its docstring. */
export function readCacheSync<T>(userId: string, name: string): { data: T; ts: number } | null {
  if (hydratedFor !== userId) return null;
  const envelope = mem.get(keyFor(userId, name)) as Envelope<T> | undefined;
  return envelope ? { data: envelope.data, ts: envelope.ts } : null;
}

/** Fire-and-forget: updates the in-memory mirror synchronously, persists in the background. */
export function writeCache<T>(userId: string, name: string, data: T): void {
  const key = keyFor(userId, name);
  const envelope: Envelope<T> = { ts: Date.now(), data };
  mem.set(key, envelope);
  AsyncStorage.setItem(key, JSON.stringify(envelope)).catch(() => {});
}

/**
 * Explicit sign-out clears. A background 401 deliberately does NOT clear -
 * the data is namespaced under that user's id so it can never leak to a
 * different account, and leaving it means an immediate re-login is instant
 * rather than a cold blocking probe.
 */
export async function clearCache(): Promise<void> {
  mem.clear();
  hydratedFor = null;
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const ownKeys = allKeys.filter(k => k.startsWith(PREFIX));
    if (ownKeys.length > 0) await AsyncStorage.multiRemove(ownKeys);
  } catch {
    // best-effort
  }
}
