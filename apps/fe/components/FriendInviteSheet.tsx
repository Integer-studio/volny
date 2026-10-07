import React, { useState } from 'react';
import { Text, View } from 'react-native';
import UserPlus from 'lucide-react-native/icons/user-plus';
import { api, FriendInvitePreview } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useSlowActionNotice } from '../hooks/useSlowActionNotice';
import { useToast } from './Toast';
import BottomSheet from './BottomSheet';
import Button from './Button';

type Props = {
  /** Kód pozvánky; `null` = sheet zavřený. */
  code: string | null;
  preview: FriendInvitePreview | null;
  /** Odmítnutí i zavření jinak (tap mimo, Zpět na Androidu). */
  onDecline: () => void;
  onAccepted: () => void;
};

/**
 * Pozvánka do přátel z odkazu, otevřená po přihlášení (task 0030). Dřív
 * PendingFriendInviteGate přidal přítele bez dotazu - teď o tom rozhodne
 * uživatel, stejně jako u pozvánky do skupiny (GroupInviteSheet).
 */
export default function FriendInviteSheet({ code, preview, onDecline, onAccepted }: Props) {
  const { show } = useToast();
  const [accepting, setAccepting] = useState(false);
  useSlowActionNotice(accepting);

  const accept = async () => {
    if (!code || !preview) return;
    setAccepting(true);
    try {
      await api.acceptFriendInvite(code);
      show(`Teď jste přátelé s ${preview.name}.`);
      onAccepted();
    } catch (e) {
      show(errorMessage(e, 'Přidání do přátel se nezdařilo.'), 'error');
    } finally {
      setAccepting(false);
    }
  };

  return (
    <BottomSheet visible={code != null && preview != null} onClose={onDecline} dismissable={!accepting}>
      {preview && (
        <>
          <View className="items-center mb-8">
            <View className="w-16 h-16 rounded-full bg-[#EE6C4D]/10 items-center justify-center mb-4">
              <UserPlus size={28} color="#EE6C4D" />
            </View>
            <Text className="text-gray-400 text-xs font-bold tracking-widest mb-1">POZVÁNKA DO PŘÁTEL</Text>
            <Text className="text-2xl font-bold text-gray-900 text-center">{preview.name}</Text>
            <Text className="text-gray-400 text-center">@{preview.username}</Text>
          </View>

          <View className="flex-row">
            <Button label="Odmítnout" variant="secondary" disabled={accepting} onPress={onDecline} className="flex-1 mr-2" />
            <Button label="Přijmout" loading={accepting} onPress={accept} className="flex-1 ml-2" />
          </View>
        </>
      )}
    </BottomSheet>
  );
}
