import React from 'react';
import { Pressable, Text } from 'react-native';
import { useAuth } from '../lib/auth-context';

/** Zda má být offline lišta vidět - čte ji TopBanners, aby pod ní posunul obsah. */
export function useOfflineBannerVisible(): boolean {
  const { offline, status } = useAuth();
  return offline && status === 'signedIn';
}

/**
 * Thin top banner for "signed in, but the last background verify failed for
 * a non-401 reason" (network down, container still cold) - distinct from
 * BootSplash, which is a blocking overlay: this must never block the UI, it
 * just tells the user their data may be stale. Tapping forces a re-verify by
 * simulating the same trigger a foreground transition would.
 *
 * Kreslí se v toku nad obsahem (TopBanners), ne absolutně přes něj - dřív
 * překrývala ikony v hlavičce a brala jim ťuknutí.
 */
export default function OfflineBanner({ topInset }: { topInset: number }) {
  const { refreshMe } = useAuth();

  return (
    <Pressable
      onPress={() => { refreshMe().catch(() => {}); }}
      style={{ paddingTop: topInset }}
      className="bg-gray-900"
      accessibilityRole="button"
    >
      <Text className="text-white text-xs text-center py-1.5">
        Offline — zobrazuji poslední známý stav. Klepnutím zkusit znovu.
      </Text>
    </Pressable>
  );
}
