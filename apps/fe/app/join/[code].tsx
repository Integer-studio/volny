import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Users from 'lucide-react-native/icons/users';
import X from 'lucide-react-native/icons/x';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useSlowActionNotice } from '../../hooks/useSlowActionNotice';
import { useToast } from '../../components/Toast';
import { setPendingInvite, clearPendingInvite } from '../../lib/pending-invite';

export default function JoinGroup() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { status, homeRoute } = useAuth();
  const { show } = useToast();
  const [joining, setJoining] = useState(false);
  useSlowActionNotice(joining);

  const preview = useAsyncData(() => api.previewInvite(code), [code]);

  useEffect(() => {
    // Stash the code before anything else can navigate away (e.g. a
    // Stack.Protected redirect to sign-in) - it must survive a full
    // register->login round trip and a page reload/relaunch.
    setPendingInvite(code);
  }, [code]);

  useEffect(() => {
    // A dead code (group deleted, invite regenerated) can never succeed -
    // without this, the stored pending invite would keep sending the user
    // back to this same "invalid invite" screen on every future app load.
    if (preview.error instanceof ApiError && preview.error.status === 404) {
      clearPendingInvite();
    }
  }, [preview.error]);

  const dismiss = () => {
    clearPendingInvite();
    router.replace(homeRoute);
  };

  const handleJoin = async () => {
    setJoining(true);
    try {
      const detail = await api.joinGroup(code);
      await clearPendingInvite();
      router.replace(`/groups/${detail.id}`);
    } catch {
      show('Připojení se nezdařilo.', 'error');
    } finally {
      setJoining(false);
    }
  };

  if (preview.showSpinner && preview.data === undefined) {
    return (
      <View className="flex-1 bg-[#FCFBF8] items-center justify-center">
        <ActivityIndicator size="large" color="#EE6C4D" />
      </View>
    );
  }

  if (!preview.data) {
    return (
      <View className="flex-1 bg-[#FCFBF8] items-center justify-center px-8">
        <Text className="text-gray-900 text-lg font-medium text-center mb-2">Neplatná pozvánka</Text>
        <Text className="text-gray-400 text-center mb-8">Tento odkaz už nefunguje, nebo nikdy nefungoval.</Text>
        <Pressable onPress={dismiss} className="bg-gray-900 py-3 px-6 rounded-xl active:opacity-80">
          <Text className="text-white font-medium">Zpět domů</Text>
        </Pressable>
      </View>
    );
  }

  const p = preview.data;

  return (
    <View className="flex-1 bg-[#FCFBF8] items-center justify-center px-8">
      {status === 'signedIn' && (
        <Pressable onPress={dismiss} className="absolute top-4 right-4 p-2" hitSlop={8}>
          <X size={22} color="#888" />
        </Pressable>
      )}
      <View className="w-20 h-20 rounded-full bg-[#EE6C4D]/10 items-center justify-center mb-6">
        <Users size={32} color="#EE6C4D" />
      </View>
      <Text className="text-2xl font-bold text-gray-900 text-center mb-2">{p.name}</Text>
      <Text className="text-gray-400 text-center mb-8">
        {p.memberCount} {p.memberCount === 1 ? 'člen' : 'členů'}{p.ownerName ? ` · založil ${p.ownerName}` : ''}
      </Text>

      {status === 'signedIn' && p.alreadyMember && (
        <Pressable onPress={() => clearPendingInvite().then(() => router.replace('/groups'))} className="bg-gray-900 py-4 px-8 rounded-xl active:opacity-80">
          <Text className="text-white font-bold text-base">Už jsi členem — zobrazit</Text>
        </Pressable>
      )}
      {status === 'signedIn' && !p.alreadyMember && (
        <Pressable onPress={handleJoin} disabled={joining} className="bg-[#EE6C4D] py-4 px-8 rounded-xl active:opacity-80">
          {joining ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-base">Připojit se ke skupině</Text>}
        </Pressable>
      )}
      {status === 'signedOut' && (
        <>
          <Text className="text-gray-500 text-center mb-4">Pro připojení se přihlas nebo zaregistruj.</Text>
          <Pressable onPress={() => router.push('/sign-in')} className="bg-[#EE6C4D] py-4 px-8 rounded-xl active:opacity-80">
            <Text className="text-white font-bold text-base">Přihlásit se / registrovat</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
