import { useEffect, useRef, useState } from 'react';

export type FieldState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

type Options<T> = {
  initial: string;
  save: (value: string) => Promise<T>;
  /** Local, synchronous validation - runs before any request, no round trip. */
  validate?: (value: string) => string | null;
  /** Server-side error for the value just saved (e.g. from ApiError.fieldErrors). */
  serverError?: (e: unknown) => string | null;
  debounceMs?: number;
  onSaved?: (result: T) => void;
};

/**
 * One field, one autosave pipeline: debounce while typing, save immediately
 * on blur, never overwrite what the user is typing with the server's
 * response (only `onSaved` propagates the result outward). Protected against
 * out-of-order responses the same way useAsyncData is (a run id ref).
 */
export function useAutosaveField<T>(opts: Options<T>) {
  const { initial, save, validate, serverError, debounceMs = 800, onSaved } = opts;
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<FieldState>('idle');
  const [error, setError] = useState<string | null>(null);

  const lastSaved = useRef(initial);
  const runId = useRef(0);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // If the initial value changes from outside (e.g. `me` arrives late) and
  // the user hasn't diverged from it yet, keep the field in sync.
  useEffect(() => {
    if (value === lastSaved.current) {
      lastSaved.current = initial;
      setValue(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const commit = (raw: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const trimmed = raw.trim();
    if (trimmed === lastSaved.current) {
      setState('idle');
      setError(null);
      return;
    }
    const localErr = validate?.(trimmed) ?? null;
    if (localErr) {
      setState('error');
      setError(localErr);
      return;
    }

    const myRunId = ++runId.current;
    setState('saving');
    setError(null);
    save(trimmed)
      .then(result => {
        if (!alive.current || myRunId !== runId.current) return;
        lastSaved.current = trimmed;
        setState('saved');
        if (savedTimer.current) clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => {
          if (alive.current && runId.current === myRunId) setState('idle');
        }, 2000);
        onSaved?.(result);
      })
      .catch(e => {
        if (!alive.current || myRunId !== runId.current) return;
        setState('error');
        setError(serverError?.(e) ?? 'Uložení se nezdařilo.');
      });
  };

  const onChangeText = (raw: string) => {
    setValue(raw);
    setState('dirty');
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => commit(raw), debounceMs);
  };

  const onBlur = () => commit(value);

  return { value, onChangeText, onBlur, state, error };
}
