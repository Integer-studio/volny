import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import UserPlus from 'lucide-react-native/icons/user-plus';
import X from 'lucide-react-native/icons/x';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useSlowActionNotice } from '../../hooks/useSlowActionNotice';
import { useToast } from '../../components/Toast';
import { setPendingFriendInvite, clearPendingFriendInvite } from '../../lib/pending-friend-invite';

export default function AddFriend() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { status, homeRoute } = useAuth();
  const { show } = useToast();
  const [adding, setAdding] = useState(false);
  useSlowActionNotice(adding);

  const preview = useAsyncData(() => api.previewFriendInvite(code), [code]);

  useEffect(() => {
    // Stash the code before anything else can navigate away (e.g. a
    // Stack.Protected redirect to sign-in) - it must survive a full
    // register->login round trip and a page reload/relaunch.
    setPendingFriendInvite(code);
  }, [code]);

  useEffect(() => {
    // A dead code (24h expired, or regenerated) can never succeed - without
    // this, the stored pending invite would keep sending the user back to
    // this same "invalid invite" screen on every future app load.
    if (preview.error instanceof ApiError && preview.error.status === 404) {
      clearPendingFriendInvite();
    }
  }, [preview.error]);

  const dismiss = () => {
    clearPendingFriendInvite();
    router.replace(homeRoute);
  };

  const handleAdd = async () => {
    setAdding(true);
    try {
      await api.acceptFriendInvite(code);
      await clearPendingFriendInvite();
      show('Přidáno do přátel.');
      router.replace('/search');
    } catch {
      show('Přidání se nezdařilo.', 'error');
    } finally {
      setAdding(false);
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
        <UserPlus size={32} color="#EE6C4D" />
      </View>
      <Text className="text-2xl font-bold text-gray-900 text-center mb-2">{p.name}</Text>
      <Text className="text-gray-400 text-center mb-8">@{p.username}</Text>

      {status === 'signedIn' && p.alreadyFriend && (
        <Pressable onPress={() => clearPendingFriendInvite().then(() => router.replace('/search'))} className="bg-gray-900 py-4 px-8 rounded-xl active:opacity-80">
          <Text className="text-white font-bold text-base">Už jste přátelé — zobrazit</Text>
        </Pressable>
      )}
      {status === 'signedIn' && !p.alreadyFriend && (
        <Pressable onPress={handleAdd} disabled={adding} className="bg-[#EE6C4D] py-4 px-8 rounded-xl active:opacity-80">
          {adding ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-base">Přidat do přátel</Text>}
        </Pressable>
      )}
      {status === 'signedOut' && (
        <>
          <Text className="text-gray-500 text-center mb-4">Pro přidání do přátel se přihlas nebo zaregistruj.</Text>
          <Pressable onPress={() => router.push('/sign-in')} className="bg-[#EE6C4D] py-4 px-8 rounded-xl active:opacity-80">
            <Text className="text-white font-bold text-base">Přihlásit se / registrovat</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
