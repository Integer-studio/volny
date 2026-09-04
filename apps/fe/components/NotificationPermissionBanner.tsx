import React, { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../lib/api';
import { needsWebNotificationPrompt } from '../lib/push';

/**
 * Web-only banner that asks for notification permission. This exists because
 * Notification.requestPermission() must run inside a direct user-gesture
 * handler - Firefox (and increasingly other browsers) silently refuses it
 * otherwise, with no dialog shown at all. PushGateWeb used to call this
 * automatically on mount, which is exactly that eager, non-gesture case.
 *
 * Once tapped, hides for the rest of this mount regardless of outcome -
 * there is no need to persist a "dismissed" flag: if permission ends up
 * 'denied', needsWebNotificationPrompt() (which only fires on 'default')
 * naturally stays false on every future mount too.
 */
export default function NotificationPermissionBanner() {
  const insets = useSafeAreaInsets();
  const [asked, setAsked] = useState(false);

  if (asked || !needsWebNotificationPrompt()) return null;

  const enable = () => {
    setAsked(true);
    api.registerPushToken().catch(() => {});
  };

  return (
    <Pressable
      onPress={enable}
      style={{ paddingTop: insets.top }}
      className="absolute top-0 left-0 right-0 bg-gray-900"
    >
      <Text className="text-white text-xs text-center py-1.5">
        Klepnutím povolíš oznámení o žádostech o přátelství a volných kamarádech.
      </Text>
    </Pressable>
  );
}
