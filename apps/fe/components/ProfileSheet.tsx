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
import Button from './Button';
import FadeIn from './FadeIn';
import TipCard from './tour/TipCard';
import { useTour } from './tour/TourProvider';
import { TOUR_DUMMY_ID, TOUR_DUMMY_PROFILE } from './tour/dummy';

type Props = {
  /** The profile to show, or null to keep the sheet closed. */
  userId: string | null;
  onClose: () => void;
};

/**
 * Profile detail popup: contact info (only ever returned by the API when the
 * viewer is connected to this person) + friend add/remove. Opened from the
 * free-people list, a group's member list and search (app/search.tsx) - tam
 * hlavně proto, aby šlo poznat, kterého "Petra" člověk přidává (společné
 * skupiny). Kontakt API cizím lidem nevydá.
 */
export default function ProfileSheet({ userId, onClose }: Props) {
  const { show } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  // U ukázkového přítele místo vytáčení jen vysvětlení, přímo v listu u
  // kontaktů, kam uživatel zrovna ťukl.
  const [dummyNote, setDummyNote] = useState(false);

  const { skip } = useTour();
  // Ukázkový přítel z průvodce po registraci - jen na frontendu, bez API.
  const isDummy = userId === TOUR_DUMMY_ID;
  const fetched = useAsyncData(
    () => (userId && !isDummy ? api.getUserProfile(userId) : Promise.resolve(null)),
    [userId],
  );
  const profile = isDummy
    ? { ...fetched, data: TOUR_DUMMY_PROFILE, showSpinner: false, settled: true }
    : fetched;
  // Neither list this sheet is opened from ever includes the viewer
  // themselves, but guard it anyway rather than showing a nonsensical
  // "add yourself as a friend" button if that ever changes.
  const isSelf = userId != null && Number(userId) === api.getCurrentUserId();

  const handleClose = () => {
    setConfirmingRemove(false);
    setDummyNote(false);
    onClose();
  };

  const runAction = async (action: () => Promise<string | void>, failMessage: string) => {
    setBusy(true);
    try {
      const done = await action();
      if (done) show(done);
      profile.reload();
    } catch (e) {
      show(errorMessage(e, failMessage), 'error');
    } finally {
      setBusy(false);
    }
  };

  const name = profile.data?.name ?? '';
  const handleAdd = () =>
    userId &&
    runAction(async () => {
      const result = await api.addFriend(userId);
      return result === 'accepted' ? `Teď jste přátelé s ${name}.` : `Žádost odeslána uživateli ${name}.`;
    }, 'Nepodařilo se odeslat žádost.');
  const handleCancelRequest = () =>
    userId &&
    runAction(async () => {
      await api.cancelRequest(userId);
      return 'Žádost zrušena.';
    }, 'Žádost se nepodařilo zrušit.');
  const handleAccept = () =>
    userId &&
    runAction(async () => {
      await api.acceptRequest(userId);
      return `Teď jste přátelé s ${name}.`;
    }, 'Nepodařilo se přijmout žádost.');
  const handleReject = () => userId && runAction(() => api.rejectRequest(userId), 'Nepodařilo se odmítnout žádost.');
  const handleRemove = () =>
    userId &&
    runAction(async () => {
      await api.removeFriend(userId);
      setConfirmingRemove(false);
    }, 'Odebrání se nezdařilo.');

  const openContact = async (url: string, copyValue: string) => {
    if (isDummy) {
      setDummyNote(true);
      return;
    }
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
    <BottomSheet visible={!!userId} onClose={handleClose} dismissable={!busy}>
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

          {isDummy && (
            <View className="w-full mb-4">
              <TipCard
                step="dummyContact"
                title="Tady uvidíš jeho kontakt."
                body="Můžeš mu zavolat, nebo napsat na Instagram!"
                action="Hotovo"
                onAction={handleClose}
                onSkip={() => {
                  skip();
                  handleClose();
                }}
                outlined
              />
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

          {isDummy && dummyNote && (
            <Text className="text-gray-500 text-sm text-center -mt-3 mb-2">
              Tohle je jen ukázka – u skutečných přátel se ti otevře telefon nebo Instagram.
            </Text>
          )}

          <View className="w-full">
            {isDummy ? null : isSelf ? (
              <View className="items-center">
                <Text className="text-gray-400 text-base mb-4">To jsi ty! 😛</Text>
                <Button
                  label="Upravit profil"
                  variant="secondary"
                  onPress={() => {
                    handleClose();
                    router.push('/settings');
                  }}
                />
              </View>
            ) : profile.data.isFriend ? (
              !confirmingRemove ? (
                <Button
                  label="Odebrat z přátel"
                  variant="destructiveOutline"
                  icon={UserMinus}
                  onPress={() => setConfirmingRemove(true)}
                />
              ) : (
                <View className="flex-row">
                  <Button
                    label="Zrušit"
                    variant="secondary"
                    disabled={busy}
                    onPress={() => setConfirmingRemove(false)}
                    className="flex-1 mr-2"
                  />
                  <Button
                    label="Odebrat"
                    variant="destructive"
                    loading={busy}
                    onPress={handleRemove}
                    className="flex-1 ml-2"
                  />
                </View>
              )
            ) : profile.data.hasIncomingRequest ? (
              <View className="flex-row">
                <Button
                  label="Odmítnout"
                  variant="secondary"
                  icon={X}
                  disabled={busy}
                  onPress={handleReject}
                  className="flex-1 mr-2"
                />
                <Button
                  label="Přijmout"
                  icon={Check}
                  loading={busy}
                  onPress={handleAccept}
                  className="flex-1 ml-2"
                />
              </View>
            ) : profile.data.hasOutgoingRequest ? (
              <View className="flex-row items-center">
                <Text className="flex-1 text-gray-400 font-medium">Žádost odeslána</Text>
                <Button label="Zrušit žádost" variant="secondary" loading={busy} onPress={handleCancelRequest} />
              </View>
            ) : (
              <Button label="Přidat do přátel" icon={UserPlus} loading={busy} onPress={handleAdd} />
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
