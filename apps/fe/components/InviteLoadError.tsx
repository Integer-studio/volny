import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { ApiError } from '../lib/api';
import Button from './Button';

type Props = {
  /** Chyba náhledu pozvánky, nebo null, když se ještě načítá. */
  error: Error | null;
  showSpinner: boolean;
  onRetry: () => void;
  onHome: () => void;
};

/**
 * Stav obrazovky pozvánky (skupina i přítel), dokud nemá náhled: načítání,
 * "Neplatná pozvánka" jen při 404, jinak chyba s "Zkusit znovu" (task 0026).
 * Dřív se při síťové chybě - a na prvních 600 ms před spinnerem - ukazovalo
 * "Neplatná pozvánka" i u platného odkazu.
 */
export default function InviteLoadError({ error, showSpinner, onRetry, onHome }: Props) {
  if (!error) {
    return (
      <View className="flex-1 bg-[#FCFBF8] items-center justify-center">
        {showSpinner && <ActivityIndicator size="large" color="#EE6C4D" />}
      </View>
    );
  }

  const invalid = error instanceof ApiError && error.status === 404;

  return (
    <View className="flex-1 bg-[#FCFBF8] items-center justify-center px-8">
      <Text className="text-gray-900 text-lg font-medium text-center mb-2">
        {invalid ? 'Neplatná pozvánka' : 'Pozvánku se nepodařilo načíst'}
      </Text>
      <Text className="text-gray-400 text-center mb-8">
        {invalid
          ? 'Tento odkaz už nefunguje, nebo nikdy nefungoval.'
          : 'Server neodpovídá nebo jsi offline. Zkus to prosím znovu.'}
      </Text>
      {!invalid && <Button label="Zkusit znovu" onPress={onRetry} className="mb-3" />}
      <Button label="Zpět domů" variant={invalid ? 'primary' : 'secondary'} onPress={onHome} />
    </View>
  );
}
