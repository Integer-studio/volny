import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import Users from 'lucide-react-native/icons/users';
import Plus from 'lucide-react-native/icons/plus';
import { api, ApiError } from '../../lib/api';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useToast } from '../../components/Toast';
import FormField from '../../components/FormField';
import FadeIn from '../../components/FadeIn';

function memberCountLabel(n: number): string {
  if (n === 1) return '1 člen';
  if (n >= 2 && n <= 4) return `${n} členové`;
  return `${n} členů`;
}

export default function GroupsList() {
  const { show } = useToast();
  const groups = useAsyncData(() => api.getGroups(), [], { cacheKey: 'groups' });
  useAutoRefresh(groups.reload, { intervalMs: 30_000 });

  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  const handleJoin = async () => {
    if (!code.trim()) return;
    setJoining(true);
    try {
      const detail = await api.joinGroup(code.trim());
      setCode('');
      router.push(`/groups/${detail.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        show('Neplatný kód pozvánky.', 'error');
      } else {
        show('Připojení se nezdařilo.', 'error');
      }
    } finally {
      setJoining(false);
    }
  };

  const list = groups.data ?? [];

  return (
    <View className="flex-1 bg-[#FCFBF8] px-6 pt-4">
      <View className="flex-row items-end mb-8">
        <View className="flex-1 mr-2">
          <FormField
            label="Připojit se kódem"
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            containerClassName="mb-0"
            style={{ height: 48 }}
          />
        </View>
        <Pressable
          onPress={handleJoin}
          disabled={joining || !code.trim()}
          className={`h-12 justify-center bg-gray-900 rounded-xl px-4 border border-gray-900 active:opacity-80 ${!code.trim() ? 'opacity-40' : ''}`}
        >
          {joining ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-medium text-base">Vstoupit</Text>}
        </Pressable>
      </View>

      <View className="flex-1">
        {groups.showSpinner ? (
          <ActivityIndicator size="small" color="#000" />
        ) : list.length > 0 ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <FadeIn>
              {list.map(g => (
                <Pressable
                  key={g.id}
                  onPress={() => router.push(`/groups/${g.id}`)}
                  className="flex-row items-center justify-between py-3 border-b border-gray-50"
                >
                  <View className="flex-row items-center flex-1">
                    <View className="w-10 h-10 rounded-full bg-[#EE6C4D]/10 items-center justify-center mr-3">
                      <Users size={18} color="#EE6C4D" />
                    </View>
                    <View>
                      <Text className="text-gray-900 font-medium text-base">{g.name}</Text>
                      <Text className="text-gray-400 text-sm">
                        {memberCountLabel(g.memberCount)}{g.isOwner ? ' · vlastník' : ''}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </FadeIn>
          </ScrollView>
        ) : groups.settled ? (
          <FadeIn>
            <Text className="text-gray-400 text-base">Zatím nejsi v žádné skupině.</Text>
          </FadeIn>
        ) : null}
      </View>

      <Pressable
        onPress={() => router.push('/groups/new')}
        className="flex-row items-center justify-center border border-[#EE6C4D] py-3 rounded-xl active:bg-[#EE6C4D]/5 mt-4 mb-6"
      >
        <Plus size={18} color="#EE6C4D" />
        <Text className="text-[#EE6C4D] font-medium ml-2">Vytvořit skupinu</Text>
      </Pressable>
    </View>
  );
}
