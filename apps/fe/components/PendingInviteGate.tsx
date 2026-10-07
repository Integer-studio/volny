import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Switch } from 'react-native';
import Users from 'lucide-react-native/icons/users';
import { api, ApiError, GroupPreview } from '../lib/api';
import { getPendingInvite, clearPendingInvite, onPendingInviteSet } from '../lib/pending-invite';
import { groupSharingHint } from '../lib/group-sharing';
import { isOnboardingStep } from '../lib/tour';
import { useTour } from './tour/TourProvider';
import { useToast } from './Toast';
import BottomSheet from './BottomSheet';

type Invite = { code: string; preview: GroupPreview };

/**
 * Mounted alongside PushGate in the authenticated tree. Picks up a group
 * invite code stashed by app/join/[code].tsx - either just now by a
 * signed-in user opening the link (that screen stashes and goes home), or
 * before a logged-out visitor was routed to sign-in/register (survives the
 * register->login round trip, a page reload on web, or an app relaunch).
 *
 * Instead of joining automatically, it shows a bottom sheet over the main
 * screen with accept/decline and the group sharing toggle (task 0021), so
 * the user decides about sharing their free status and contact before
 * they're in. Closing the sheet any other way counts as declining.
 *
 * Waits out part A of the post-registration tour (task 0019): someone who
 * registered via an invite sees the sheet after the intro/contact screens,
 * when their phone/IG is already filled in, and the tour hints continue once
 * the sheet is gone.
 */
export default function PendingInviteGate() {
  const { show } = useToast();
  const tour = useTour();
  const blockedByTour = isOnboardingStep(tour.step);

  const [checkTick, setCheckTick] = useState(0);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [visible, setVisible] = useState(false);
  const [sharing, setSharing] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => onPendingInviteSet(() => setCheckTick(t => t + 1)), []);

  useEffect(() => {
    if (blockedByTour) return;
    let cancelled = false;
    getPendingInvite().then(async code => {
      if (cancelled || !code) return;
      try {
        const preview = await api.previewInvite(code);
        if (cancelled) return;
        if (preview.alreadyMember) {
          await clearPendingInvite();
          show(`Ve skupině ${preview.name} už jsi.`);
          return;
        }
        setSharing(true);
        setInvite({ code, preview });
        setVisible(true);
      } catch (e) {
        if (cancelled) return;
        // A dead code (group deleted, invite regenerated) can never succeed,
        // and a stored one would otherwise reopen this on every app load.
        await clearPendingInvite();
        show(
          e instanceof ApiError && e.status === 404 ? 'Pozvánka do skupiny už neplatí.' : 'Pozvánku se nepodařilo načíst.',
          'error',
        );
      }
    });
    return () => { cancelled = true; };
  }, [blockedByTour, checkTick, show]);

  const decline = useCallback(async () => {
    setVisible(false);
    await clearPendingInvite();
  }, []);

  const accept = async () => {
    if (!invite) return;
    setJoining(true);
    try {
      const detail = await api.joinGroup(invite.code, sharing);
      await clearPendingInvite();
      setVisible(false);
      show(`Připojeno do skupiny ${detail.name}.`);
    } catch {
      show('Připojení do skupiny se nezdařilo.', 'error');
    } finally {
      setJoining(false);
    }
  };

  if (!invite) return null;
  const p = invite.preview;

  return (
    <BottomSheet visible={visible} onClose={decline}>
      <View className="items-center mb-6">
        <View className="w-16 h-16 rounded-full bg-[#EE6C4D]/10 items-center justify-center mb-4">
          <Users size={28} color="#EE6C4D" />
        </View>
        <Text className="text-gray-400 text-xs font-bold tracking-widest mb-1">POZVÁNKA DO SKUPINY</Text>
        <Text className="text-2xl font-bold text-gray-900 text-center">{p.name}</Text>
      </View>

      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-gray-800 font-medium flex-1 mr-3">Sdílet volno a kontakt se skupinou</Text>
        <Switch
          value={sharing}
          onValueChange={setSharing}
          disabled={joining}
          trackColor={{ false: '#E5E7EB', true: '#EE6C4D' }}
          thumbColor="#fff"
          // Viz settings.tsx - barva zapnutého jezdce na react-native-web.
          {...({ activeThumbColor: '#fff' } as object)}
          accessibilityLabel="Sdílet volno a kontakt se skupinou"
        />
      </View>
      <Text className="text-gray-400 text-xs mb-8">
        {groupSharingHint(sharing)} Změnit to můžeš kdykoli v detailu skupiny.
      </Text>

      <View className="flex-row">
        <Pressable
          onPress={decline}
          disabled={joining}
          className="flex-1 bg-gray-100 py-4 rounded-xl items-center mr-2 active:opacity-80"
        >
          <Text className="text-gray-700 font-medium text-base">Odmítnout</Text>
        </Pressable>
        <Pressable
          onPress={accept}
          disabled={joining}
          className="flex-1 bg-[#EE6C4D] py-4 rounded-xl items-center ml-2 active:opacity-80"
        >
          {joining ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-base">Přijmout</Text>}
        </Pressable>
      </View>
    </BottomSheet>
  );
}
