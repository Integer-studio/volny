import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Avatar from './Avatar';
import type { UserSummary } from '../lib/api';

type UserRowProps = {
  user: UserSummary;
  subtitle?: string;
  badge?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
};

export default function UserRow({ user, subtitle, badge, right, onPress }: UserRowProps) {
  const Container = onPress ? Pressable : View;
  return (
    <Container
      onPress={onPress}
      className="flex-row items-center justify-between py-2.5 border-b border-gray-50"
    >
      <View className="flex-row items-center flex-1 mr-2">
        <Avatar label={user.name} />
        <View className="flex-1">
          <View className="flex-row items-center flex-wrap">
            <Text className="text-gray-900 font-medium text-base leading-tight mr-2">{user.name}</Text>
            {badge}
          </View>
          <View className="flex-row items-center">
            <Text className="text-gray-400 text-sm leading-tight">@{user.username}</Text>
            {subtitle ? <Text className="text-gray-400 text-sm leading-tight">{'  ·  ' + subtitle}</Text> : null}
          </View>
        </View>
      </View>
      {right}
    </Container>
  );
}
