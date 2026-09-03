import React from 'react';
import { Text, View } from 'react-native';
import type { ConnectionSource } from '../lib/api';

/**
 * Renders nothing for a friend - the badge exists to explain why someone who
 * ISN'T a friend shows up in the free-list (they share a group). A friend who
 * also happens to share a group stays badge-free on purpose.
 */
export default function GroupBadge({ via }: { via: ConnectionSource[] }) {
  if (via.some(v => v.kind === 'friend')) return null;
  const groups = via.filter(v => v.kind === 'group' && v.groupName);
  if (groups.length === 0) return null;

  const label = groups.length === 1
    ? groups[0].groupName!
    : `${groups[0].groupName} +${groups.length - 1}`;

  return (
    <View className="px-2 py-0.5 rounded-full bg-[#EE6C4D]/10">
      <Text className="text-[#EE6C4D] text-[10px] font-semibold" numberOfLines={1}>
        {label.length > 14 ? label.slice(0, 13) + '…' : label}
      </Text>
    </View>
  );
}
