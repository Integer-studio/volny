import React from 'react';
import { Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth-context';

/**
 * Thin top banner for "signed in, but the last background verify failed for
 * a non-401 reason" (network down, container still cold) - distinct from
 * BootSplash, which is a blocking overlay: this must never block the UI, it
 * just tells the user their data may be stale. Tapping forces a re-verify by
 * simulating the same trigger a foreground transition would.
 */
export default function OfflineBanner() {
  const { offline, status, refreshMe } = useAuth();
  const insets = useSafeAreaInsets();

  if (!offline || status !== 'signedIn') return null;

  return (
    <Pressable
      onPress={() => { refreshMe().catch(() => {}); }}
      style={{ paddingTop: insets.top }}
      className="absolute top-0 left-0 right-0 bg-gray-900"
    >
      <Text className="text-white text-xs text-center py-1.5">
        Offline — zobrazuji poslední známý stav. Klepnutím zkusit znovu.
      </Text>
    </Pressable>
  );
}
