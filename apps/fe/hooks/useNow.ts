import { useEffect, useState } from 'react';

/**
 * Re-renders every `intervalMs` (default 60s) so time-derived values (quick
 * "free until" offsets, relative labels, ...) stay correct as minutes/hours
 * pass, without recomputing on every unrelated render.
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
