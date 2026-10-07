import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Button from './Button';

type Props = {
  visible: boolean;
  /** Blokující ověření přihlášení to vzdalo (server neodpovídá, ne 401). */
  failed?: boolean;
  onRetry?: () => void;
  onSignOut?: () => void;
};

/**
 * Overlay shown while auth status is "loading". With optimistic auth entry
 * (auth-context.tsx), a returning user with a token AND a cached `me` skips
 * this entirely - "loading" is then just two local storage reads plus one
 * cache hydration, single-digit ms, and this renders nothing at all thanks
 * to the staging below. It still earns its place for the cases optimistic
 * entry can't cover: the very first launch on a new device, or after a
 * cache wipe, where there's no cached `me` to show and the blocking
 * getMe() probe can genuinely take 5-15s against a cold Container App.
 * Staged so a warm case never flashes and a cold case doesn't read as a
 * hang: <600ms nothing extra, 600ms-4s spinner, >4s spinner + explanation.
 * When the probe gives up (`failed`), it shows a retry instead of silently
 * switching to the login screen - the stored token is probably still valid.
 */
export default function BootSplash({ visible, failed = false, onRetry, onSignOut }: Props) {
  const [stage, setStage] = useState<'none' | 'spinner' | 'slow'>('none');

  useEffect(() => {
    if (!visible || failed) {
      setStage('none');
      return;
    }
    const t1 = setTimeout(() => setStage('spinner'), 600);
    const t2 = setTimeout(() => setStage('slow'), 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [visible, failed]);

  if (!visible) return null;

  return (
    <View
      pointerEvents="auto"
      className="absolute inset-0 justify-center items-center bg-[#FCFBF8] px-8"
    >
      {failed ? (
        <>
          <Text className="text-gray-800 text-lg font-bold text-center">Server neodpovídá</Text>
          <Text className="text-gray-500 text-center mt-2 mb-6">
            Nepodařilo se ověřit přihlášení. Zkontroluj připojení a zkus to znovu.
          </Text>
          {onRetry && <Button label="Zkusit znovu" onPress={onRetry} />}
          {onSignOut && (
            <Pressable onPress={onSignOut} accessibilityRole="button" className="mt-4 p-2">
              <Text className="text-gray-500">Přihlásit se jiným účtem</Text>
            </Pressable>
          )}
        </>
      ) : (
        <>
          {stage !== 'none' && <ActivityIndicator size="large" color="#EE6C4D" />}
          {stage === 'slow' && (
            <Text className="text-gray-400 text-sm mt-4">Server se probouzí, chvilku to potrvá…</Text>
          )}
        </>
      )}
    </View>
  );
}
