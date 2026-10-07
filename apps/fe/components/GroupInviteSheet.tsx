import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Switch } from 'react-native';
import { router } from 'expo-router';
import Users from 'lucide-react-native/icons/users';
import { api, GroupPreview } from '../lib/api';
import { groupSharingHint } from '../lib/group-sharing';
import { useToast } from './Toast';
import BottomSheet from './BottomSheet';

type Props = {
  /** Kód pozvánky; `null` = sheet zavřený. */
  code: string | null;
  preview: GroupPreview | null;
  /** Odmítnutí i zavření jinak (tap mimo, Zpět na Androidu). */
  onDecline: () => void;
  /** Po úspěšném připojení, těsně před přechodem na detail skupiny. */
  onJoined?: () => void | Promise<void>;
};

/**
 * Pozvánka do skupiny (task 0022): přijmout/odmítnout + přepínač sdílení
 * volna a kontaktu se skupinou (task 0021). Sdílený odkazem
 * (PendingInviteGate) i zadáním kódu v app/groups/index.tsx. Po přijetí
 * vede na detail skupiny.
 */
export default function GroupInviteSheet({ code, preview, onDecline, onJoined }: Props) {
  const { show } = useToast();
  const [sharing, setSharing] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (code) setSharing(true);
  }, [code]);

  const accept = async () => {
    if (!code) return;
    setJoining(true);
    try {
      const detail = await api.joinGroup(code, sharing);
      await onJoined?.();
      router.push(`/groups/${detail.id}`);
    } catch {
      show('Připojení do skupiny se nezdařilo.', 'error');
    } finally {
      setJoining(false);
    }
  };

  return (
    <BottomSheet visible={code != null && preview != null} onClose={onDecline} dismissable={!joining}>
      {preview && (
        <>
          <View className="items-center mb-6">
            <View className="w-16 h-16 rounded-full bg-[#EE6C4D]/10 items-center justify-center mb-4">
              <Users size={28} color="#EE6C4D" />
            </View>
            <Text className="text-gray-400 text-xs font-bold tracking-widest mb-1">POZVÁNKA DO SKUPINY</Text>
            <Text className="text-2xl font-bold text-gray-900 text-center">{preview.name}</Text>
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
          <Text className="text-gray-500 text-sm leading-5 mb-8">
            {groupSharingHint(sharing)} Změnit to můžeš kdykoli v detailu skupiny.
          </Text>

          <View className="flex-row">
            <Pressable
              onPress={onDecline}
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
        </>
      )}
    </BottomSheet>
  );
}
