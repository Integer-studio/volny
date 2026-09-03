import * as Storage from './storage';

const KEY = 'pendingInvite';
const TTL_MS = 24 * 60 * 60 * 1000;

type Stored = { code: string; ts: number };

// Defends against `${code}` template interpolation turning a JS `undefined`
// (e.g. a route param read before the router has resolved it) into the
// literal string "undefined" - which is truthy and would otherwise get
// stored and then replayed as a redirect target on every future app load.
function isValidCode(code: unknown): code is string {
  return typeof code === 'string' && code.length > 0 && code !== 'undefined' && code !== 'null';
}

export async function setPendingInvite(code: string): Promise<void> {
  if (!isValidCode(code)) return;
  try {
    await Storage.setItem(KEY, JSON.stringify({ code, ts: Date.now() } satisfies Stored));
  } catch {
    // best-effort - the join screen itself still works without this
  }
}

export async function getPendingInvite(): Promise<string | null> {
  try {
    const raw = await Storage.getItem(KEY);
    if (!raw) return null;
    const parsed: Stored = JSON.parse(raw);
    if (Date.now() - parsed.ts > TTL_MS || !isValidCode(parsed.code)) {
      await clearPendingInvite();
      return null;
    }
    return parsed.code;
  } catch {
    return null;
  }
}

export async function clearPendingInvite(): Promise<void> {
  try {
    await Storage.deleteItem(KEY);
  } catch {
    // ignore
  }
}
