import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { api } from './api';
import { isPushSupported, isWebPushSupported } from './push';
import { isIOS, isStandalone } from './platform-web';

/**
 * Stav oznámení na tomhle zařízení, sjednocený pro web i APK (task 0029):
 * - `needsInstall` - Safari na iOS v kartě, push jde jen z aplikace z plochy,
 * - `unsupported` - prohlížeč bez Push API, nativní iOS,
 * - `default` - ještě nerozhodnuto, jde se zeptat,
 * - `granted` / `denied`.
 *
 * Zavřený dialog bez volby zůstává `default` - není to "zablokováno" a jde
 * se zeptat znovu.
 */
export type NotificationStatus = 'needsInstall' | 'unsupported' | 'default' | 'granted' | 'denied';

function webStatus(): NotificationStatus {
  if (isIOS() && !isStandalone()) return 'needsInstall';
  if (!isWebPushSupported || typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

export async function getNotificationStatus(): Promise<NotificationStatus> {
  if (Platform.OS === 'web') return webStatus();
  if (!isPushSupported) return 'unsupported';
  try {
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return 'granted';
    // Android po dvou odmítnutích systémový dialog už neukáže.
    return status === 'denied' && !canAskAgain ? 'denied' : 'default';
  } catch {
    return 'unsupported';
  }
}

/**
 * Požádá o povolení a zaregistruje zařízení. Volat přímo z klepnutí: na
 * webu se `Notification.requestPermission()` volá jako úplně první věc,
 * synchronně v handleru. Dřív mu předcházely dva dynamické importy
 * Firebase a Safari/Firefox pak gesto považovaly za vypršené.
 */
export async function enableNotifications(): Promise<NotificationStatus> {
  if (Platform.OS === 'web') {
    if (webStatus() !== 'default') return webStatus();
    const permission = await Notification.requestPermission();
    if (permission === 'granted') await api.registerPushToken().catch(() => null);
    return webStatus();
  }
  // Nativní getExpoPushTokenAsync si o povolení řekne sám.
  await api.registerPushToken().catch(() => null);
  return getNotificationStatus();
}

/** Aktuální stav, přečtený znovu při návratu do appky (povolení v nastavení systému). */
export function useNotificationStatus() {
  const [status, setStatus] = useState<NotificationStatus | null>(null);

  const refresh = useCallback(() => {
    getNotificationStatus().then(setStatus).catch(() => setStatus('unsupported'));
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', next => {
      if (next === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const enable = useCallback(async () => {
    const next = await enableNotifications();
    setStatus(next);
    return next;
  }, []);

  return { status, refresh, enable };
}

export type BrowserKind = 'safari' | 'firefox' | 'chromium' | 'other';

export function browserKind(): BrowserKind {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/Firefox|FxiOS/.test(ua)) return 'firefox';
  if (/Edg|Chrome|Chromium|CriOS|SamsungBrowser/.test(ua)) return 'chromium';
  if (/Safari/.test(ua)) return 'safari';
  return 'other';
}

/** Návod, jak oznámení odblokovat, podle platformy a prohlížeče. */
export function unblockInstructions(): string {
  if (Platform.OS !== 'web') {
    return 'Povol je v nastavení telefonu: Aplikace → Volný → Oznámení.';
  }
  if (isIOS()) {
    return 'Povol je v Nastavení iPhonu: Oznámení → Volný.';
  }
  switch (browserKind()) {
    case 'chromium':
      return 'Klepni na ikonu vlevo od adresy, otevři Oprávnění webu a u Oznámení zvol Povolit. Pak stránku obnov.';
    case 'firefox':
      return 'Klepni na ikonu zámku vlevo od adresy a u Odesílání oznámení zruš blokování. Pak stránku obnov.';
    case 'safari':
      return 'V Safari otevři Nastavení → Webové stránky → Oznámení a u Volného zvol Povolit.';
    default:
      return 'Povol je v nastavení webu v prohlížeči a stránku obnov.';
  }
}
