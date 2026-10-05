import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as Storage from './storage';

/**
 * "Lubomír mode" (task 0013) - whether the app shows Lubomír Volný's photo
 * on the main button and in web push notifications. Opt-in: off unless the
 * user turned it on on this device, because using a real person's likeness
 * without consent is a legal risk (see the task file). Stored per device,
 * not per account - there is no BE endpoint for preferences.
 */
const KEY = 'lubomirMode';

// The web push service worker (public/firebase-messaging-sw.js) can't read
// localStorage, so the preference is mirrored into Cache Storage, which both
// the page and the SW can reach. Keep both names in sync with the SW.
const SW_CACHE = 'volny-prefs';
const SW_KEY = '/__prefs/lubomir-mode';

export const NOTIFICATION_ICON_LUBOMIR = '/icons/notification-lubomir.png';
export const NOTIFICATION_ICON_GENERIC = '/icons/notification-generic.png';

// Mirrors the provider's state for non-React callers (lib/push.ts's
// foreground notification handler).
let current = false;

export function notificationIcon(): string {
  return current ? NOTIFICATION_ICON_LUBOMIR : NOTIFICATION_ICON_GENERIC;
}

async function syncToServiceWorker(enabled: boolean): Promise<void> {
  if (Platform.OS !== 'web' || typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(SW_CACHE);
    await cache.put(SW_KEY, new Response(enabled ? 'on' : 'off'));
  } catch {
    // The SW falls back to the generic icon - the safe default.
  }
}

type LubomirModeContextValue = {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
};

const LubomirModeContext = createContext<LubomirModeContextValue>({
  enabled: false,
  setEnabled: () => {},
});

export function LubomirModeProvider({ children }: { children: React.ReactNode }) {
  // False until storage answers, so the photo never flashes for a user who
  // has it off.
  const [enabled, setEnabledState] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Storage.getItem(KEY)
      .catch(() => null)
      .then((raw) => {
        if (cancelled) return;
        const value = raw === 'on';
        current = value;
        setEnabledState(value);
        // Also covers a value set before the SW mirror existed.
        syncToServiceWorker(value);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setEnabled = useCallback((value: boolean) => {
    current = value;
    setEnabledState(value);
    Storage.setItem(KEY, value ? 'on' : 'off').catch(() => {});
    syncToServiceWorker(value);
  }, []);

  const ctx = useMemo(() => ({ enabled, setEnabled }), [enabled, setEnabled]);
  return <LubomirModeContext.Provider value={ctx}>{children}</LubomirModeContext.Provider>;
}

export function useLubomirMode(): LubomirModeContextValue {
  return useContext(LubomirModeContext);
}
