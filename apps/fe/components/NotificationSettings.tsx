import React, { useState } from 'react';
import { Text, View } from 'react-native';
import Check from 'lucide-react-native/icons/check';
import { unblockInstructions, useNotificationStatus } from '../lib/notifications';
import Button from './Button';

/**
 * Sekce "Oznámení" v nastavení (task 0029) - jediná trvalá cesta zpět
 * k oznámením pro toho, kdo lištu zavřel, průvodce přeskočil nebo je na
 * iPhonu v Safari v kartě (tam lišta ani průvodce znovu krok s plochou
 * nenabídnou).
 */
export default function NotificationSettings() {
  const { status, enable } = useNotificationStatus();
  const [asking, setAsking] = useState(false);
  const [dismissedPrompt, setDismissedPrompt] = useState(false);

  if (status == null) return null;

  const onEnable = () => {
    setAsking(true);
    // enable() volá requestPermission synchronně - musí zůstat přímo v klepnutí.
    enable()
      .then(next => setDismissedPrompt(next === 'default'))
      .catch(() => {})
      .finally(() => setAsking(false));
  };

  return (
    <View className="mb-10">
      <Text className="text-gray-400 text-xs font-bold tracking-widest mb-3">OZNÁMENÍ</Text>
      {status === 'granted' && (
        <View className="flex-row items-center">
          <Check size={18} color="#22c55e" />
          <Text className="text-gray-800 ml-2">Oznámení jsou zapnutá.</Text>
        </View>
      )}
      {status === 'default' && (
        <>
          <Text className="text-gray-500 text-sm mb-3">
            Dáme ti vědět o žádostech o přátelství a o tom, kdy mají přátelé volno.
          </Text>
          <Button label="Zapnout oznámení" onPress={onEnable} loading={asking} />
          {dismissedPrompt && (
            <Text className="text-gray-500 text-sm mt-2">Dialog se zavřel bez volby. Zkus to znovu.</Text>
          )}
        </>
      )}
      {status === 'denied' && (
        <Text className="text-gray-500 text-sm">Oznámení jsou zablokovaná. {unblockInstructions()}</Text>
      )}
      {status === 'needsInstall' && (
        <Text className="text-gray-500 text-sm leading-5">
          Na iPhonu chodí oznámení jen do Volného přidaného na plochu: v Safari klepni na Sdílet, vyber Přidat
          na plochu, otevři Volný z plochy a oznámení zapni tam.
        </Text>
      )}
      {status === 'unsupported' && (
        <Text className="text-gray-500 text-sm">Na tomhle zařízení nebo v tomhle prohlížeči oznámení nejdou.</Text>
      )}
    </View>
  );
}
