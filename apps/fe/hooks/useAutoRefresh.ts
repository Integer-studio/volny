import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useFocusEffect } from 'expo-router';

type Options = {
  intervalMs: number;
  enabled?: boolean;
};

/**
 * Refreshes on focus, on the app returning to the foreground, and then on a
 * fixed interval - but only while the screen is focused AND the app is
 * active, so polling never runs against a backgrounded/unfocused screen.
 */
export function useAutoRefresh(reload: () => void, { intervalMs, enabled = true }: Options): void {
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  const focusedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      reloadRef.current();
      return () => { focusedRef.current = false; };
    }, [])
  );

  useEffect(() => {
    if (!enabled) return;

    const onAppStateChange = (next: AppStateStatus) => {
      if (next === 'active' && focusedRef.current) reloadRef.current();
    };
    const sub = AppState.addEventListener('change', onAppStateChange);

    const interval = setInterval(() => {
      if (focusedRef.current && AppState.currentState === 'active') reloadRef.current();
    }, intervalMs);

    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [enabled, intervalMs]);
}
