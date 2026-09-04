import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { api } from '../lib/api';
import { isPushSupported, isWebPushSupported, routeForPushPayload, type PushPayload } from '../lib/push';

/**
 * Mounted once, only while the user is authenticated.
 * - registers/refreshes the push token (Expo or FCM web) with the backend
 * - handles notification taps (cold start + warm)
 * Renders nothing.
 *
 * isPushSupported/isWebPushSupported are per-platform constants (never change
 * at runtime), so branching on them here to pick a different component -
 * rather than bailing out of individual hooks inside one component - doesn't
 * break the rules of hooks: a given mounted instance always takes the same
 * branch.
 */
export default function PushGate() {
  if (isPushSupported) return <PushGateNative />;
  if (isWebPushSupported) return <PushGateWeb />;
  return null;
}

function PushGateNative() {
  // Register on mount of the authenticated tree. This covers BOTH cold
  // start with a valid stored JWT and a fresh login/register, because
  // RootLayout mounts this component in either case.
  useEffect(() => {
    let cancelled = false;
    api.registerPushToken().then(token => {
      if (!cancelled && token) {
        console.log('[push] registered:', token);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Foreground receipt. The handler configured in _layout already shows
  // a banner; this is only a hook point for refreshing in-app data later.
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(() => {
      // Screens refetch via useFocusEffect; nothing global needed today.
    });
    return () => sub.remove();
  }, []);

  // Taps. useLastNotificationResponse covers the cold-start case (app
  // killed, launched by the notification) as well as warm taps, which
  // addNotificationResponseReceivedListener alone races on. Native-only:
  // on web this calls a method the native module doesn't implement, which
  // is exactly why this whole component only mounts when isPushSupported.
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!response) return; // undefined = pending, null = none

    const id = response.notification.request.identifier;
    if (handled.current === id) return; // the hook re-yields the same object
    handled.current = id;

    const data = response.notification.request.content.data as Partial<PushPayload> | undefined;
    routeForPushPayload(data);
  }, [response]);

  return null;
}

function PushGateWeb() {
  // Same registration lifecycle as PushGateNative - api.registerPushToken()
  // branches internally on isWebPushSupported and calls getFcmWebTokenAsync.
  useEffect(() => {
    let cancelled = false;
    api.registerPushToken().then(token => {
      if (!cancelled && token) {
        console.log('[push] registered:', token);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Web notification taps happen in the service worker (it runs independently
  // of the page), which relays them here via postMessage - see the
  // `notificationclick` handler in public/firebase-messaging-sw.js.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'push-notification-click') return;
      routeForPushPayload(event.data.payload as Partial<PushPayload> | undefined);
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  return null;
}
