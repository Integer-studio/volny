import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Re-renders every `intervalMs` (default 60s) so time-derived values (quick
 * "free until" offsets, relative labels, ...) stay correct as minutes/hours
 * pass, without recomputing on every unrelated render.
 *
 * Tiká zarovnaně na celé intervaly (u minuty na :00), ne od chvíle mountu -
 * jinak "za 5 min" kolem kotevních časů zaostávalo až o minutu. Po návratu
 * do appky se obnoví hned, interval mezitím mohl stát.
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(new Date());
      schedule();
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(tick, intervalMs - (Date.now() % intervalMs));
    };
    schedule();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') tick();
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [intervalMs]);
  return now;
}
