import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * CROSS-REPO CONTRACT — the backend must send `channelId: "default"`
 * (or omit channelId) in every Expo push message. Android drops
 * notifications addressed to a channel that does not exist.
 */
export const ANDROID_CHANNEL_ID = 'default';

/** Remote push is Android-only in this app. Web + iOS are inert. */
export const isPushSupported = Platform.OS === 'android';

export type PushPayload =
  | { type: 'friend_request'; suggesterId?: string | number }
  | { type: 'friend_accepted'; friendId?: string | number }
  | { type: 'friend_imfree'; freeTimeId?: string | number };

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
