import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';

const BASE_URL = 'https://volny.intstudio.cz';

export function buildFriendInviteUrl(code: string): string {
  return `${BASE_URL}/add-friend/${code}`;
}

/**
 * Tries the native/web share sheet first; falls back to clipboard if sharing
 * is unsupported (react-native-web rejects when navigator.share is missing,
 * e.g. desktop Firefox or a non-secure context).
 */
export async function shareFriendInvite(code: string, myName: string): Promise<'shared' | 'copied' | 'failed'> {
  const url = buildFriendInviteUrl(code);
  const message = `Přidej si mě na Volný, ${myName}: ${url}`;

  try {
    await Share.share(Platform.OS === 'web' ? { message: url } : { message, url });
    return 'shared';
  } catch {
    return copyFriendInviteLink(code);
  }
}

export async function copyFriendInviteLink(code: string): Promise<'copied' | 'failed'> {
  try {
    // Read the value into a local const first - on web, navigator.clipboard
    // needs a user gesture and a secure context; awaiting anything before
    // the copy call (e.g. a network round trip) can make Safari reject it.
    const url = buildFriendInviteUrl(code);
    await Clipboard.setStringAsync(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
