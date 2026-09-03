import { API_URL } from './config';

let lastPingAt = 0;

/**
 * Fire-and-forget GET /api/health to wake a scaled-to-zero Container App
 * before the user does anything that needs it. Fires unconditionally, even
 * before a token is read, because its biggest win isn't the signed-in case
 * (the background getMe() verify warms the container on its own within a
 * few ms of this) - it's a signed-out user about to press "Přihlásit", and
 * an anonymous first-time visitor on /join/CODE, the app's most
 * latency-visible entry point since there's nothing cached to show them.
 */
export function warmUp(): void {
  const now = Date.now();
  if (now - lastPingAt < 5 * 60 * 1000) return;
  lastPingAt = now;
  let signal: AbortSignal | undefined;
  try {
    signal = typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(20000) : undefined;
  } catch {
    signal = undefined;
  }
  fetch(`${API_URL}/health`, { signal }).catch(() => {});
}

warmUp();
