import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { FIREBASE_VAPID_KEY, FIREBASE_WEB_CONFIG, isFirebaseWebConfigured } from './firebaseWebConfig';

/**
 * CROSS-REPO CONTRACT — the backend must send `channelId: "default"`
 * (or omit channelId) in every Expo push message. Android drops
 * notifications addressed to a channel that does not exist.
 */
export const ANDROID_CHANNEL_ID = 'default';

/** Remote push via Expo is Android-only in this app. Web has its own FCM-based
 * path below (isWebPushSupported); iOS is inert either way. */
export const isPushSupported = Platform.OS === 'android';

/** Web push via FCM. Requires a secure context (HTTPS or localhost) with
 * Service Worker + Push API support, and a completed Firebase Console setup. */
export const isWebPushSupported =
  Platform.OS === 'web' &&
  isFirebaseWebConfigured &&
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator &&
  typeof window !== 'undefined' &&
  'PushManager' in window;

export type PushPayload =
  | { type: 'friend_request'; suggesterId?: string | number }
  | { type: 'friend_accepted'; friendId?: string | number }
  | { type: 'friend_imfree'; freeTimeId?: string | number };

/**
 * Shared tap-routing logic, used by both the native tap handler
 * (Notifications.useLastNotificationResponse, in PushGateNative) and the web
 * one (a postMessage relayed from firebase-messaging-sw.js's
 * `notificationclick`, in PushGateWeb) — same PushPayload contract, same
 * destinations, on both platforms.
 */
export function routeForPushPayload(data: Partial<PushPayload> | undefined): void {
  switch (data?.type) {
    case 'friend_request':
    case 'friend_accepted':
      // /search is the "Přátelé" screen; it refetches on focus, so the
      // relevant request/friend appears immediately.
      router.push('/search');
      break;
    case 'friend_imfree':
      // The free-friends list lives on the home screen.
      router.dismissTo('/');
      break;
    default:
      break;
  }
}

function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

/**
 * SDK 57: `shouldShowAlert` is deprecated — use shouldShowBanner / shouldShowList.
 * Safe to call at module scope; on web the native module resolves to a no-op stub.
 */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/** Must run BEFORE requesting permissions / fetching the token (v57 docs). */
export async function ensureAndroidChannelAsync(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Oznámení',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#EE6C4D',
  });
}

/**
 * Returns an Expo push token ("ExponentPushToken[...]") or null.
 * Never throws — callers treat null as "push unavailable".
 */
export async function getExpoPushTokenAsync(): Promise<string | null> {
  if (!isPushSupported) return null; // web + iOS
  if (!Device.isDevice) return null; // emulator without Play Services

  try {
    // Creating the channel first is what makes the Android 13+
    // POST_NOTIFICATIONS system prompt behave correctly.
    await ensureAndroidChannelAsync();

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      // On Android 13+ this triggers the POST_NOTIFICATIONS runtime prompt.
      // The permission is already declared by expo-notifications' own manifest.
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('[push] Notification permission not granted:', finalStatus);
      return null;
    }

    const projectId = getProjectId();
    if (!projectId) {
      console.warn('[push] No EAS projectId in app config — cannot mint an Expo push token.');
      return null;
    }

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (e) {
    console.warn('[push] Failed to obtain Expo push token:', e);
    return null;
  }
}

/**
 * Returns an FCM web push token, or null. Never throws — same "null = push
 * unavailable" contract as getExpoPushTokenAsync. Dynamically imports the
 * Firebase SDK so it never ends up in the native (Android/iOS) bundle.
 */
export async function getFcmWebTokenAsync(): Promise<string | null> {
  if (!isWebPushSupported) return null;

  try {
    const { initializeApp, getApps } = await import('firebase/app');
    const { getMessaging, getToken } = await import('firebase/messaging');

    const app = getApps()[0] ?? initializeApp(FIREBASE_WEB_CONFIG);

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[push] Web notification permission not granted:', permission);
      return null;
    }

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    return token || null;
  } catch (e) {
    console.warn('[push] Failed to obtain FCM web token:', e);
    return null;
  }
}
