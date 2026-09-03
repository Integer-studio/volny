import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

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
 */
export default function BootSplash({ visible }: { visible: boolean }) {
  const [stage, setStage] = useState<'none' | 'spinner' | 'slow'>('none');

  useEffect(() => {
    if (!visible) {
      setStage('none');
      return;
    }
    const t1 = setTimeout(() => setStage('spinner'), 600);
    const t2 = setTimeout(() => setStage('slow'), 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [visible]);

  if (!visible) return null;

  return (
    <View
      pointerEvents="auto"
      className="absolute inset-0 justify-center items-center bg-[#FCFBF8]"
    >
      {stage !== 'none' && <ActivityIndicator size="large" color="#EE6C4D" />}
      {stage === 'slow' && (
        <Text className="text-gray-400 text-sm mt-4">Server se probouzí, chvilku to potrvá…</Text>
      )}
    </View>
  );
}
