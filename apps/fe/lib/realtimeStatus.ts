/**
 * Connection state of the realtime hub, kept in its own dependency-free
 * module so lib/push.ts can read it without an import cycle
 * (api -> push -> realtime -> api).
 */
let connected = false;
const listeners = new Set<() => void>();

export function isRealtimeConnected(): boolean {
  return connected;
}

export function setRealtimeConnected(next: boolean): void {
  if (connected === next) return;
  connected = next;
  listeners.forEach(l => l());
}

export function subscribeRealtimeConnected(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
