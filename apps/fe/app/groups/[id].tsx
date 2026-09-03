import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Copy from 'lucide-react-native/icons/copy';
import Share2 from 'lucide-react-native/icons/share-2';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import QRCode from 'react-native-qrcode-svg';
import { api, ApiError, GroupDetail as GroupDetailModel } from '../../lib/api';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useToast } from '../../components/Toast';
import FormField from '../../components/FormField';
import UserRow from '../../components/UserRow';
import BottomSheet from '../../components/BottomSheet';
import ProfileSheet from '../../components/ProfileSheet';
import FadeIn from '../../components/FadeIn';
import { shareInvite, copyInviteLink, buildInviteUrl } from '../../lib/invite-link';
import { fieldError, errorMessage } from '../../lib/errors';
import { useAutosaveField } from '../../hooks/useAutosaveField';

function validateGroupName(v: string): string | null {
  return v.length < 1 || v.length > 100 ? 'Název musí mít 1-100 znaků.' : null;
}

export default function GroupDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { show } = useToast();
  const [reloadTick, setReloadTick] = useState(0);
  const group = useAsyncData<GroupDetailModel>(() => api.getGroup(id), [id, reloadTick], {
    cacheKey: `group:${id}`,
    revive: (raw) => {
      const g = raw as GroupDetailModel;
      return { ...g, members: g.members.map(m => ({ ...m, joinedAt: new Date(m.joinedAt) })) };
    },
  });

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [qrVisible, setQrVisible] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);

  const nameField = useAutosaveField({
    initial: group.data?.name ?? '',
    validate: validateGroupName,
    save: async (value) => {
      await api.renameGroup(id, value);
    },
    serverError: (e) => fieldError(e, 'name') ?? errorMessage(e, 'Uložení se nezdařilo.'),
    onSaved: () => show('Název uložen.'),
  });

  useEffect(() => {
    if (group.data) {
      setInviteCode(group.data.inviteCode);
    }
  }, [group.data]);

  if (group.showSpinner && group.data === undefined) {
    return (
      <View className="flex-1 bg-[#FCFBF8] items-center justify-center">
        <ActivityIndicator size="large" color="#EE6C4D" />
      </View>
    );
  }

  if (!group.data) {
    // Not settled yet (still within the pre-spinner grace window) - stay
    // blank rather than flash "se nepodařilo načíst" for a fetch that's
    // actually still in flight, mirroring the spinner branch above.
    if (!group.settled) {
      return <View className="flex-1 bg-[#FCFBF8]" />;
    }
    return (
      <View className="flex-1 bg-[#FCFBF8] items-center justify-center px-6">
        <Text className="text-gray-400 text-center">Skupinu se nepodařilo načíst.</Text>
      </View>
    );
  }

  const data = group.data;
  const code = inviteCode ?? data.inviteCode;

  const handleShare = async () => {
    const result = await shareInvite(code, data.name);
    if (result === 'copied') show('Odkaz zkopírován.');
    else if (result === 'failed') show('Sdílení se nezdařilo.', 'error');
  };

  const handleCopy = async () => {
    const result = await copyInviteLink(code);
    show(result === 'copied' ? 'Odkaz zkopírován.' : 'Kopírování se nezdařilo.', result === 'copied' ? 'success' : 'error');
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const fresh = await api.regenerateInvite(id);
      setInviteCode(fresh);
      show('Nový odkaz vygenerován. Starý přestal fungovat.');
    } catch {
      show('Nepodařilo se vygenerovat nový odkaz.', 'error');
    } finally {
      setRegenerating(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.deleteGroup(id);
      router.replace('/groups');
    } catch {
      show('Smazání se nezdařilo.', 'error');
    }
  };

  const handleLeave = async () => {
    try {
      await api.leaveGroup(id);
      router.replace('/groups');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        show('Vlastník nemůže skupinu opustit.', 'error');
      } else {
        show('Opuštění se nezdařilo.', 'error');
      }
      setConfirmingLeave(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-[#FCFBF8] px-6 pt-4" contentContainerStyle={{ paddingBottom: 48 }}>
      <FadeIn>
      {data.isOwner ? (
        <FormField
          label="Název skupiny"
          value={nameField.value}
          onChangeText={nameField.onChangeText}
          onBlur={nameField.onBlur}
          autoCapitalize="words"
          error={nameField.error}
          state={nameField.state}
          containerClassName="mb-8"
        />
      ) : (
        <Text className="text-2xl font-bold text-gray-900 mb-8">{data.name}</Text>
      )}

      <Text className="text-gray-400 text-xs font-bold tracking-widest mb-3">POZVÁNKA</Text>
      <View className="bg-white rounded-xl border border-gray-200 px-4 py-3 mb-3 flex-row items-center">
        <View className="flex-1 mr-3">
          <Text className="text-gray-400 text-xs mb-1">Kód</Text>
          <Text className="text-gray-900 text-lg font-semibold tracking-wide">{code}</Text>
          <Text className="text-gray-400 text-xs mt-2" numberOfLines={1}>{buildInviteUrl(code)}</Text>
        </View>
        <Pressable
          onPress={() => setQrVisible(true)}
          className="p-1.5 bg-white rounded-lg border border-gray-100 active:opacity-70"
        >
          <QRCode value={buildInviteUrl(code)} size={64} />
        </Pressable>
      </View>
      <View className="flex-row mb-8">
        <Pressable onPress={handleCopy} className="flex-1 flex-row items-center justify-center bg-gray-100 py-3 rounded-xl mr-2 active:opacity-80">
          <Copy size={16} color="#333" />
          <Text className="text-gray-800 font-medium ml-2">Kopírovat</Text>
        </Pressable>
        <Pressable onPress={handleShare} className="flex-1 flex-row items-center justify-center bg-gray-100 py-3 rounded-xl mx-1 active:opacity-80">
          <Share2 size={16} color="#333" />
          <Text className="text-gray-800 font-medium ml-2">Sdílet</Text>
        </Pressable>
        {data.isOwner && (
          <Pressable onPress={handleRegenerate} disabled={regenerating} className="flex-row items-center justify-center bg-gray-100 py-3 px-3 rounded-xl ml-2 active:opacity-80">
            {regenerating ? <ActivityIndicator color="#333" /> : <RefreshCw size={16} color="#333" />}
          </Pressable>
        )}
      </View>

      <Text className="text-gray-400 text-xs font-bold tracking-widest mb-3">
        ČLENOVÉ ({data.memberCount})
      </Text>
      <View className="mb-8">
        {data.members.map(m => (
          <UserRow
            key={m.id}
            user={m}
            subtitle={m.isOwner ? 'vlastník' : undefined}
            onPress={() => setProfileId(m.id)}
          />
        ))}
      </View>

      <View className="border-t border-gray-100 pt-6">
        {data.isOwner ? (
          !confirmingDelete ? (
            <Pressable onPress={() => setConfirmingDelete(true)} className="border border-red-200 py-3 rounded-xl items-center active:bg-red-50">
              <Text className="text-red-500 font-medium">Smazat skupinu</Text>
            </Pressable>
          ) : (
            <View>
              <Text className="text-gray-600 text-center mb-3">Smazat skupinu pro všechny členy?</Text>
              <View className="flex-row">
                <Pressable onPress={() => setConfirmingDelete(false)} className="flex-1 bg-gray-100 py-3 rounded-xl items-center mr-2 active:opacity-80">
                  <Text className="text-gray-700 font-medium">Zrušit</Text>
                </Pressable>
                <Pressable onPress={handleDelete} className="flex-1 bg-red-500 py-3 rounded-xl items-center ml-2 active:opacity-80">
                  <Text className="text-white font-medium">Smazat</Text>
                </Pressable>
              </View>
            </View>
          )
        ) : !confirmingLeave ? (
          <Pressable onPress={() => setConfirmingLeave(true)} className="border border-red-200 py-3 rounded-xl items-center active:bg-red-50">
            <Text className="text-red-500 font-medium">Opustit skupinu</Text>
          </Pressable>
        ) : (
          <View>
            <Text className="text-gray-600 text-center mb-3">Opravdu chceš opustit tuto skupinu?</Text>
            <View className="flex-row">
              <Pressable onPress={() => setConfirmingLeave(false)} className="flex-1 bg-gray-100 py-3 rounded-xl items-center mr-2 active:opacity-80">
                <Text className="text-gray-700 font-medium">Zrušit</Text>
              </Pressable>
              <Pressable onPress={handleLeave} className="flex-1 bg-red-500 py-3 rounded-xl items-center ml-2 active:opacity-80">
                <Text className="text-white font-medium">Opustit</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
      </FadeIn>

      <BottomSheet visible={qrVisible} onClose={() => setQrVisible(false)}>
        <View className="items-center">
          <Text className="text-gray-400 text-sm font-medium mb-6">
            Naskenuj a přidej se
          </Text>
          <View className="bg-white p-4 rounded-2xl">
            <QRCode value={buildInviteUrl(code)} size={220} />
          </View>
          <Text className="text-gray-900 text-lg font-semibold tracking-wide mt-6">
            {code}
          </Text>
        </View>
      </BottomSheet>

      <ProfileSheet userId={profileId} onClose={() => setProfileId(null)} />
    </ScrollView>
  );
}
