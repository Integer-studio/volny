import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Switch } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Copy from 'lucide-react-native/icons/copy';
import Share2 from 'lucide-react-native/icons/share-2';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import QRCode from 'react-native-qrcode-svg';
import { api, ApiError, GroupDetail as GroupDetailModel } from '../../lib/api';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useToast } from '../../components/Toast';
import Button from '../../components/Button';
import { useSlowActionNotice } from '../../hooks/useSlowActionNotice';
import FormField from '../../components/FormField';
import UserRow from '../../components/UserRow';
import BottomSheet from '../../components/BottomSheet';
import ProfileSheet from '../../components/ProfileSheet';
import FadeIn from '../../components/FadeIn';
import { shareInvite, copyInviteLink, buildInviteUrl } from '../../lib/invite-link';
import { fieldError, errorMessage } from '../../lib/errors';
import { useAutosaveField } from '../../hooks/useAutosaveField';
import { groupSharingHint } from '../../lib/group-sharing';

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
      return {
        ...g,
        // Cache z doby před taskem 0021 pole nemá; výchozí stav na BE je zapnuto.
        sharesWithGroup: g.sharesWithGroup ?? true,
        members: g.members.map(m => ({ ...m, joinedAt: new Date(m.joinedAt) })),
      };
    },
  });

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmingRegenerate, setConfirmingRegenerate] = useState(false);
  // Smazání / opuštění: zamyká tlačítka, ať dvojťuk nepošle dva requesty.
  const [destroying, setDestroying] = useState(false);
  const [sharingSaving, setSharingSaving] = useState(false);
  // Zapnutí sdílení odhalí kontakt - chce potvrzení, vypnutí ne.
  const [confirmingShareOn, setConfirmingShareOn] = useState(false);
  useSlowActionNotice(destroying || regenerating || sharingSaving);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [qrVisible, setQrVisible] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  // Optimistická hodnota přepínače sdílení; null = ber to, co přišlo z BE.
  const [sharing, setSharing] = useState<boolean | null>(null);

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
    const gone = group.error instanceof ApiError && (group.error.status === 404 || group.error.status === 403);
    return (
      <View className="flex-1 bg-[#FCFBF8] items-center justify-center px-6">
        <Text className="text-gray-400 text-center mb-6">
          {gone ? 'Skupina neexistuje, nebo v ní už nejsi.' : 'Skupinu se nepodařilo načíst.'}
        </Text>
        {gone ? (
          <Button label="Zpět na skupiny" variant="secondary" onPress={() => router.replace('/groups')} />
        ) : (
          <Button label="Zkusit znovu" loading={group.pending} onPress={group.reload} />
        )}
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
    setConfirmingRegenerate(false);
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

  const sharesWithGroup = sharing ?? data.sharesWithGroup;

  const saveSharing = async (value: boolean) => {
    setConfirmingShareOn(false);
    setSharing(value);
    setSharingSaving(true);
    try {
      await api.setGroupSharing(id, value);
      setReloadTick(t => t + 1);
    } catch {
      // Zpět na poslední hodnotu ze serveru, ne na `!value` - přepínač je
      // během ukládání zamčený, ale serverová hodnota je jistota.
      setSharing(null);
      show('Změna sdílení se nezdařila.', 'error');
    } finally {
      setSharingSaving(false);
    }
  };

  const handleSharingChange = (value: boolean) => {
    if (value) setConfirmingShareOn(true);
    else saveSharing(false);
  };

  const handleDelete = async () => {
    setDestroying(true);
    try {
      await api.deleteGroup(id);
      show('Skupina smazána.');
      router.replace('/groups');
    } catch {
      show('Smazání se nezdařilo.', 'error');
    } finally {
      setDestroying(false);
    }
  };

  const handleLeave = async () => {
    setDestroying(true);
    try {
      await api.leaveGroup(id);
      show(`Už nejsi ve skupině ${data.name}.`);
      router.replace('/groups');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        show('Vlastník nemůže skupinu opustit.', 'error');
      } else {
        show('Opuštění se nezdařilo.', 'error');
      }
      setConfirmingLeave(false);
    } finally {
      setDestroying(false);
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
          accessibilityRole="button"
          accessibilityLabel="Zvětšit QR kód pozvánky"
          className="p-1.5 bg-white rounded-lg border border-gray-100 active:opacity-70"
        >
          <QRCode value={buildInviteUrl(code)} size={64} />
        </Pressable>
      </View>
      <View className={`flex-row ${confirmingRegenerate ? 'mb-3' : 'mb-8'}`}>
        <Button label="Kopírovat" variant="secondary" icon={Copy} onPress={handleCopy} className="flex-1 mr-2" />
        <Button label="Sdílet" variant="secondary" icon={Share2} onPress={handleShare} className="flex-1 mx-1" />
        {data.isOwner && (
          <Pressable
            onPress={() => setConfirmingRegenerate(true)}
            disabled={regenerating || confirmingRegenerate}
            accessibilityRole="button"
            accessibilityLabel="Vygenerovat nový odkaz"
            className="flex-row items-center justify-center bg-gray-100 py-3 px-3 rounded-xl ml-2 active:opacity-80">
            {regenerating ? <ActivityIndicator color="#333" /> : <RefreshCw size={16} color="#333" />}
          </Pressable>
        )}
      </View>
      {confirmingRegenerate && (
        <View className="mb-8">
          <Text className="text-gray-600 text-center mb-3">
            Vygenerovat nový odkaz? Starý odkaz, kód i QR kód přestanou fungovat.
          </Text>
          <View className="flex-row">
            <Button label="Zpět" variant="secondary" onPress={() => setConfirmingRegenerate(false)} className="flex-1 mr-2" />
            <Button label="Vygenerovat" onPress={handleRegenerate} className="flex-1 ml-2" />
          </View>
        </View>
      )}

      {/* Task 0021: jeden přepínač pro volno i kontakt, vzájemný - přes
          skupinu se dva členové vidí jen když ho mají zapnutý oba. */}
      <Text className="text-gray-400 text-xs font-bold tracking-widest mb-3">SDÍLENÍ</Text>
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-gray-800 font-medium flex-1 mr-3">Sdílet volno a kontakt se skupinou</Text>
        <Switch
          value={sharesWithGroup}
          onValueChange={handleSharingChange}
          disabled={sharingSaving || confirmingShareOn}
          trackColor={{ false: '#E5E7EB', true: '#EE6C4D' }}
          thumbColor="#fff"
          // Viz settings.tsx - barva zapnutého jezdce na react-native-web.
          {...({ activeThumbColor: '#fff' } as object)}
          accessibilityLabel="Sdílet volno a kontakt se skupinou"
          accessibilityState={{ busy: sharingSaving }}
        />
      </View>
      {confirmingShareOn ? (
        <View className="mb-8">
          <Text className="text-gray-600 text-center mb-3">
            Členové skupiny uvidí, kdy máš volno, i tvůj telefon a Instagram.
          </Text>
          <View className="flex-row">
            <Button label="Zpět" variant="secondary" onPress={() => setConfirmingShareOn(false)} className="flex-1 mr-2" />
            <Button label="Sdílet" onPress={() => saveSharing(true)} className="flex-1 ml-2" />
          </View>
        </View>
      ) : (
        <Text className="text-gray-400 text-xs mb-8">
          {groupSharingHint(sharesWithGroup)}
        </Text>
      )}

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
            <Button label="Smazat skupinu" variant="destructiveOutline" onPress={() => setConfirmingDelete(true)} />
          ) : (
            <View>
              <Text className="text-gray-600 text-center mb-3">Smazat skupinu pro všechny členy?</Text>
              <View className="flex-row">
                <Button label="Zrušit" variant="secondary" disabled={destroying} onPress={() => setConfirmingDelete(false)} className="flex-1 mr-2" />
                <Button label="Smazat" variant="destructive" loading={destroying} onPress={handleDelete} className="flex-1 ml-2" />
              </View>
            </View>
          )
        ) : !confirmingLeave ? (
          <Button label="Opustit skupinu" variant="destructiveOutline" onPress={() => setConfirmingLeave(true)} />
        ) : (
          <View>
            <Text className="text-gray-600 text-center mb-3">Opravdu chceš opustit tuto skupinu?</Text>
            <View className="flex-row">
              <Button label="Zrušit" variant="secondary" disabled={destroying} onPress={() => setConfirmingLeave(false)} className="flex-1 mr-2" />
              <Button label="Opustit" variant="destructive" loading={destroying} onPress={handleLeave} className="flex-1 ml-2" />
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
          {/* Stejné akce jako u QR přítele - kdo QR otevře, často chce
              odkaz rovnou poslat. */}
          <View className="flex-row mt-6 self-stretch">
            <Button label="Kopírovat" variant="secondary" icon={Copy} onPress={handleCopy} className="flex-1 mr-2" />
            <Button label="Sdílet" variant="secondary" icon={Share2} onPress={handleShare} className="flex-1 ml-2" />
          </View>
        </View>
      </BottomSheet>

      <ProfileSheet userId={profileId} onClose={() => setProfileId(null)} />
    </ScrollView>
  );
}
