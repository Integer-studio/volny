import { useEffect, useRef, useSyncExternalStore } from 'react';
import { onRealtime, type RealtimeEventName } from '../lib/realtime';
import { isRealtimeConnected, subscribeRealtimeConnected } from '../lib/realtimeStatus';

/**
 * Calls `handler` whenever any of `events` arrives, and also on `Resync`
 * (every (re)connect), since anything sent while disconnected was missed.
 */
export function useRealtimeRefetch(events: readonly RealtimeEventName[], handler: () => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const key = events.join(',');

  useEffect(() => {
    const names = new Set<RealtimeEventName>([...events, 'Resync']);
    const unsubs = [...names].map(e => onRealtime(e, () => handlerRef.current()));
    return () => unsubs.forEach(u => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

export function useRealtimeConnected(): boolean {
  return useSyncExternalStore(subscribeRealtimeConnected, isRealtimeConnected, isRealtimeConnected);
}

/** Fallback polling interval: rare while the hub is connected, frequent while it isn't. */
export function useRefreshInterval(): number {
  return useRealtimeConnected() ? 300_000 : 30_000;
}
