import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import X from 'lucide-react-native/icons/x';
import Circle from 'lucide-react-native/icons/circle';
import UserPlus from 'lucide-react-native/icons/user-plus';
import Users from 'lucide-react-native/icons/users';
import { getOnboardingDismissedSync, setOnboardingDismissed } from '../lib/onboarding';

type Props = {
  name: string;
  /** Friends + groups count - the card hides itself as soon as this is > 0, dismissed or not. */
  connectionCount: number;
  /** True once the connections fetch this mount has settled (see useAsyncData) - the card stays hidden until then instead of briefly showing for a viewer who actually has connections. */
  connectionsSettled: boolean;
};

export default function OnboardingCard({ name, connectionCount, connectionsSettled }: Props) {
  const [dismissed, setDismissed] = useState(getOnboardingDismissedSync);

  if (dismissed || !connectionsSettled || connectionCount > 0) return null;

  const dismiss = () => {
    setDismissed(true);
    setOnboardingDismissed();
  };

  return (
    <View className="w-full bg-white rounded-2xl border border-gray-100 px-5 py-4 mb-6">
      <View className="flex-row items-start justify-between mb-3">
        <Text className="text-gray-900 font-bold text-lg flex-1">Vítej, {name}!</Text>
        <Pressable onPress={dismiss} hitSlop={8} className="p-1 -mr-1 -mt-1">
          <X size={18} color="#aaa" />
        </Pressable>
      </View>

      <View className="flex-row items-center mb-3">
        <Circle size={18} color="#EE6C4D" />
        <Text className="text-gray-600 text-sm ml-3 flex-1">Klepnutím na kruh se označ jako volný.</Text>
      </View>

      <Pressable onPress={() => router.push('/search')} className="flex-row items-center mb-3 active:opacity-70">
        <UserPlus size={18} color="#EE6C4D" />
        <Text className="text-gray-600 text-sm ml-3 flex-1">Přidej si přátele.</Text>
      </Pressable>

      <Pressable onPress={() => router.push('/groups')} className="flex-row items-center active:opacity-70">
        <Users size={18} color="#EE6C4D" />
        <Text className="text-gray-600 text-sm ml-3 flex-1">Vytvoř skupinu nebo se připoj kódem.</Text>
      </Pressable>
    </View>
  );
}
