import React from 'react';
import { Text, View } from 'react-native';

export default function Avatar({ label, size = 'md' }: { label: string; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  const text = size === 'sm' ? 'text-sm' : 'text-base';
  return (
    <View className={`${box} rounded-full bg-[#EE6C4D]/10 items-center justify-center mr-3`}>
      <Text className={`text-[#EE6C4D] font-bold ${text}`}>{label.charAt(0).toUpperCase()}</Text>
    </View>
  );
}
