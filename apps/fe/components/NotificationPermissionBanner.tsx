import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import X from 'lucide-react-native/icons/x';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { needsWebNotificationPrompt } from '../lib/push';
import { getItem, setItem } from '../lib/storage';
import { useTour } from './tour/TourProvider';

const DISMISSED_UNTIL_KEY = 'notificationBannerDismissedUntil';
/** Jak dlouho po zavření křížkem se lišta znovu neukáže. */
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

export type NotificationBannerState = {
  visible: boolean;
  enable: () => void;
  dismiss: () => void;
};

/**
 * Stav lišty s žádostí o povolení oznámení. Žije v TopBanners (ne v liště),
 * protože ten potřebuje vědět, jestli je vidět, aby pod ní posunul obsah.
 *
 * Once tapped, hides for the rest of this mount regardless of outcome -
 * there is no need to persist that: if permission ends up 'denied',
 * needsWebNotificationPrompt() (which only fires on 'default') naturally
 * stays false on every future mount too. Zavření křížkem se naopak ukládá,
 * jinak by lišta naskočila při každém načtení stránky.
 */
export function useNotificationBanner(): NotificationBannerState {
  const [asked, setAsked] = useState(false);
  // Do načtení uloženého zavření je lišta skrytá, ať neproblikne.
  const [dismissedUntil, setDismissedUntil] = useState<number | null>(null);
  // Během průvodce po registraci by lišta překryla jeho nápovědy - o
  // oznámení se tam stejně ptá krok "plocha + oznámení".
  const { step } = useTour();
  const { status } = useAuth();

  useEffect(() => {
    getItem(DISMISSED_UNTIL_KEY)
      .then(v => setDismissedUntil(Number(v) || 0))
      .catch(() => setDismissedUntil(0));
  }, []);

  const enable = useCallback(() => {
    setAsked(true);
    api.registerPushToken().catch(() => {});
  }, []);

  const dismiss = useCallback(() => {
    const until = Date.now() + DISMISS_MS;
    setDismissedUntil(until);
    setItem(DISMISSED_UNTIL_KEY, String(until)).catch(() => {});
  }, []);

  const visible =
    status === 'signedIn' &&
    !asked &&
    step == null &&
    dismissedUntil != null &&
    dismissedUntil <= Date.now() &&
    needsWebNotificationPrompt();

  return { visible, enable, dismiss };
}

/**
 * Web-only banner that asks for notification permission. This exists because
 * Notification.requestPermission() must run inside a direct user-gesture
 * handler - Firefox (and increasingly other browsers) silently refuses it
 * otherwise, with no dialog shown at all. PushGateWeb used to call this
 * automatically on mount, which is exactly that eager, non-gesture case.
 */
export default function NotificationPermissionBanner({
  topInset,
  enable,
  dismiss,
}: { topInset: number } & Omit<NotificationBannerState, 'visible'>) {
  return (
    <View style={{ paddingTop: topInset }} className="bg-gray-900 flex-row items-center">
      <Pressable onPress={enable} className="flex-1 pl-10" accessibilityRole="button">
        <Text className="text-white text-xs text-center py-1.5">
          Klepnutím povolíš oznámení o žádostech o přátelství a volných kamarádech.
        </Text>
      </Pressable>
      <Pressable
        onPress={dismiss}
        hitSlop={8}
        className="w-10 items-center justify-center py-1.5"
        accessibilityRole="button"
        accessibilityLabel="Zavřít"
      >
        <X size={14} color="#fff" />
      </Pressable>
    </View>
  );
}
