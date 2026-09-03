import React, { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import AtSign from 'lucide-react-native/icons/at-sign';
import Check from 'lucide-react-native/icons/check';
import Copy from 'lucide-react-native/icons/copy';
import Phone from 'lucide-react-native/icons/phone';
import UserMinus from 'lucide-react-native/icons/user-minus';
import UserPlus from 'lucide-react-native/icons/user-plus';
import X from 'lucide-react-native/icons/x';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { api } from '../lib/api';
import { useAsyncData } from '../hooks/useAsyncData';
import { useToast } from './Toast';
import { errorMessage } from '../lib/errors';
import BottomSheet from './BottomSheet';
import FadeIn from './FadeIn';

type Props = {
  /** The profile to show, or null to keep the sheet closed. */
  userId: string | null;
  onClose: () => void;
};

/**
 * Profile detail popup: contact info (only ever returned by the API when the
 * viewer is connected to this person) + friend add/remove. Only wired up
 * from the free-people list and a group's member list - see the onPress
 * callers in app/index.tsx and app/groups/[id].tsx. Deliberately NOT reachable
 * from app/search.tsx, where the people shown aren't connections yet.
 */
export default function ProfileSheet({ userId, onClose }: Props) {
  const { show } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const profile = useAsyncData(
    () => (userId ? api.getUserProfile(userId) : Promise.resolve(null)),
    [userId],
  );
  // Neither list this sheet is opened from ever includes the viewer
  // themselves, but guard it anyway rather than showing a nonsensical
  // "add yourself as a friend" button if that ever changes.
  const isSelf = userId != null && Number(userId) === api.getCurrentUserId();

  const handleClose = () => {
    setConfirmingRemove(false);
    onClose();
  };

  const runAction = async (action: () => Promise<void>, failMessage: string) => {
    setBusy(true);
    try {
      await action();
      profile.reload();
    } catch (e) {
      show(errorMessage(e, failMessage), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = () => userId && runAction(() => api.addFriend(userId), 'Nepodařilo se odeslat žádost.');
  const handleAccept = () => userId && runAction(() => api.acceptRequest(userId), 'Nepodařilo se přijmout žádost.');
  const handleReject = () => userId && runAction(() => api.rejectRequest(userId), 'Nepodařilo se odmítnout žádost.');
  const handleRemove = () =>
    userId &&
    runAction(async () => {
      await api.removeFriend(userId);
      setConfirmingRemove(false);
    }, 'Odebrání se nezdařilo.');

  const openContact = async (url: string, copyValue: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      // fall through to copy
    }
    try {
      await Clipboard.setStringAsync(copyValue);
      show('Zkopírováno do schránky.');
    } catch {
      show('Nepodařilo se otevřít ani zkopírovat.', 'error');
    }
  };

  return (
    <BottomSheet visible={!!userId} onClose={handleClose}>
      {profile.showSpinner ? (
        <View className="items-center py-8">
          <ActivityIndicator size="large" color="#EE6C4D" />
        </View>
      ) : !profile.data && !profile.settled ? (
        // Still within the pre-spinner grace window - stay blank rather than
        // flash "se nepodařilo načíst" for a fetch that's actually in flight.
        <View className="py-8" />
      ) : profile.data ? (
        <FadeIn className="items-center">
          {/* Avatar only ships sm/md sizes for list rows - a one-off larger
              circle here rather than adding an unused size variant there. */}
          <View className="w-20 h-20 rounded-full bg-[#EE6C4D]/10 items-center justify-center">
            <Text className="text-[#EE6C4D] font-bold text-3xl">
              {profile.data.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text className="text-gray-900 text-xl font-bold mt-3">{profile.data.name}</Text>
          <Text className="text-gray-400 text-sm mb-6">@{profile.data.username}</Text>

          {profile.data.sharedGroups.length > 0 && (
            <View className="flex-row flex-wrap justify-center mb-6">
              {profile.data.sharedGroups.map(g => (
                <View key={g.id} className="px-2.5 py-1 rounded-full bg-[#EE6C4D]/10 m-1">
                  <Text className="text-[#EE6C4D] text-xs font-semibold">{g.name}</Text>
                </View>
              ))}
            </View>
          )}

          {(profile.data.phone || profile.data.instagram) && (
            <View className="w-full mb-6">
              {profile.data.phone && (
                <Pressable
                  onPress={() => openContact(`tel:${profile.data!.phone}`, profile.data!.phone!)}
                  className="flex-row items-center bg-white border border-gray-200 rounded-xl px-4 py-3 mb-2 active:opacity-70"
                >
                  <Phone size={18} color="#EE6C4D" />
                  <Text className="text-gray-800 ml-3 flex-1">{profile.data.phone}</Text>
                  <Copy size={14} color="#ccc" />
                </Pressable>
              )}
              {profile.data.instagram && (
                <Pressable
                  onPress={() =>
                    openContact(`https://instagram.com/${profile.data!.instagram}`, `@${profile.data!.instagram}`)
                  }
                  className="flex-row items-center bg-white border border-gray-200 rounded-xl px-4 py-3 active:opacity-70"
                >
                  <AtSign size={18} color="#EE6C4D" />
                  <Text className="text-gray-800 ml-3 flex-1">@{profile.data.instagram}</Text>
                  <Copy size={14} color="#ccc" />
                </Pressable>
              )}
            </View>
          )}

          <View className="w-full">
            {isSelf ? (
              <View className="items-center">
                <Text className="text-gray-400 text-base mb-4">To jsi ty! 😛</Text>
                <Pressable
                  onPress={() => {
                    handleClose();
                    router.push('/settings');
                  }}
                  className="flex-row items-center justify-center bg-gray-100 py-3 px-5 rounded-xl active:opacity-80"
                >
                  <Text className="text-gray-800 font-medium">Upravit profil</Text>
                </Pressable>
              </View>
            ) : profile.data.isFriend ? (
              !confirmingRemove ? (
                <Pressable
                  onPress={() => setConfirmingRemove(true)}
                  className="flex-row items-center justify-center border border-red-200 py-3 rounded-xl active:bg-red-50"
                >
                  <UserMinus size={16} color="#ef4444" />
                  <Text className="text-red-500 font-medium ml-2">Odebrat z přátel</Text>
                </Pressable>
              ) : (
                <View className="flex-row">
                  <Pressable
                    onPress={() => setConfirmingRemove(false)}
                    className="flex-1 bg-gray-100 py-3 rounded-xl items-center mr-2 active:opacity-80"
                  >
                    <Text className="text-gray-700 font-medium">Zrušit</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleRemove}
                    disabled={busy}
                    className="flex-1 bg-red-500 py-3 rounded-xl items-center ml-2 active:opacity-80"
                  >
                    {busy ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-medium">Odebrat</Text>}
                  </Pressable>
                </View>
              )
            ) : profile.data.hasIncomingRequest ? (
              <View className="flex-row">
                <Pressable
                  onPress={handleReject}
                  disabled={busy}
                  className="flex-1 flex-row items-center justify-center bg-gray-100 py-3 rounded-xl mr-2 active:opacity-80"
                >
                  <X size={16} color="#333" />
                  <Text className="text-gray-700 font-medium ml-2">Odmítnout</Text>
                </Pressable>
                <Pressable
                  onPress={handleAccept}
                  disabled={busy}
                  className="flex-1 flex-row items-center justify-center bg-[#EE6C4D] py-3 rounded-xl ml-2 active:opacity-80"
                >
                  {busy ? <ActivityIndicator color="#fff" /> : <Check size={16} color="#fff" />}
                  <Text className="text-white font-medium ml-2">Přijmout</Text>
                </Pressable>
              </View>
            ) : profile.data.hasOutgoingRequest ? (
              <View className="py-3 rounded-xl items-center bg-gray-100">
                <Text className="text-gray-400 font-medium">Žádost odeslána</Text>
              </View>
            ) : (
              <Pressable
                onPress={handleAdd}
                disabled={busy}
                className="flex-row items-center justify-center bg-[#EE6C4D] py-3 rounded-xl active:opacity-80"
              >
                {busy ? <ActivityIndicator color="#fff" /> : <UserPlus size={16} color="#fff" />}
                <Text className="text-white font-medium ml-2">Přidat do přátel</Text>
              </Pressable>
            )}
          </View>
        </FadeIn>
      ) : (
        <FadeIn className="items-center py-8">
          <Text className="text-gray-400">Profil se nepodařilo načíst.</Text>
        </FadeIn>
      )}
    </BottomSheet>
  );
}
