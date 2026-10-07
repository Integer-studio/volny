import React, { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Users from 'lucide-react-native/icons/users';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { useAsyncData } from '../../hooks/useAsyncData';
import InviteLoadError from '../../components/InviteLoadError';
import { setPendingInvite, clearPendingInvite } from '../../lib/pending-invite';

export default function JoinGroup() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { status, homeRoute } = useAuth();

  // Signed-out visitors only: a signed-in user is sent straight home, where
  // PendingInviteGate shows the accept/decline sheet (task 0021).
  const preview = useAsyncData(() => api.previewInvite(code), [code]);

  useEffect(() => {
    // Stash the code before anything else can navigate away (e.g. a
    // Stack.Protected redirect to sign-in) - it must survive a full
    // register->login round trip and a page reload/relaunch. Signed in, the
    // stash is also what wakes PendingInviteGate up.
    let cancelled = false;
    setPendingInvite(code).then(() => {
      if (!cancelled && status === 'signedIn') router.replace('/');
    });
    return () => { cancelled = true; };
  }, [code, status]);

  useEffect(() => {
    // A dead code (group deleted, invite regenerated) can never succeed -
    // without this, the stored pending invite would keep sending the user
    // back to this same "invalid invite" screen on every future app load.
    if (status !== 'signedIn' && preview.error instanceof ApiError && preview.error.status === 404) {
      clearPendingInvite();
    }
  }, [preview.error, status]);

  const dismiss = () => {
    clearPendingInvite();
    router.replace(homeRoute);
  };

  if (status === 'signedIn') {
    return <View className="flex-1 bg-[#FCFBF8]" />;
  }

  if (!preview.data) {
    return (
      <InviteLoadError
        error={preview.pending ? null : preview.error}
        showSpinner={preview.showSpinner}
        onRetry={preview.reload}
        onHome={dismiss}
      />
    );
  }

  const p = preview.data;

  return (
    <View className="flex-1 bg-[#FCFBF8] items-center justify-center px-8">
      <View className="w-20 h-20 rounded-full bg-[#EE6C4D]/10 items-center justify-center mb-6">
        <Users size={32} color="#EE6C4D" />
      </View>
      <Text className="text-2xl font-bold text-gray-900 text-center mb-2">{p.name}</Text>
      <Text className="text-gray-400 text-center mb-8">
        {p.memberCount} {p.memberCount === 1 ? 'člen' : 'členů'}{p.ownerName ? ` · založil ${p.ownerName}` : ''}
      </Text>

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
