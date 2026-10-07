import React from 'react';
import { View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import OfflineBanner, { useOfflineBannerVisible } from './OfflineBanner';
import NotificationPermissionBanner, { useNotificationBanner } from './NotificationPermissionBanner';

/**
 * Lišty nahoře (offline, povolení oznámení) nad obsahem appky. Obsah pod
 * nimi posunou, místo aby ho překryly a braly ťuknutí ikonám v hlavičce.
 *
 * Horní safe area si vezme první viditelná lišta. Obsahu pod ní se pak
 * insets.top podstrčí jako 0 - obrazovky (index.tsx, hlavičky Stacku) si
 * jinak odsazení pod status bar přidají ještě jednou.
 */
export default function TopBanners({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const offline = useOfflineBannerVisible();
  const notify = useNotificationBanner();
  const anyVisible = offline || notify.visible;

  return (
    <View className="flex-1">
      {offline && <OfflineBanner topInset={insets.top} />}
      {notify.visible && (
        <NotificationPermissionBanner
          topInset={offline ? 0 : insets.top}
          enable={notify.enable}
          dismiss={notify.dismiss}
        />
      )}
      <SafeAreaInsetsContext.Provider value={anyVisible ? { ...insets, top: 0 } : insets}>
        {children}
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}
