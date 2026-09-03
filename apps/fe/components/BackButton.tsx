import React from 'react';
import { Pressable } from 'react-native';
import { router } from 'expo-router';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import { useAuth } from '../lib/auth-context';

/**
 * headerLeft fallback for any screen that can be reached via a direct deep
 * link (e.g. /settings, /groups/5) with no navigation history - the native
 * header then has nothing to put in headerLeft on its own. `unstable_settings
 * = { anchor: 'index' }` in app/_layout.tsx fixes the common case, but this
 * is the guaranteed fallback for the case it can't cover (a signed-out user,
 * where `index` is guarded off and can't be the anchor). Never
 * router.replace('/') directly - see homeRoute's docstring in auth-context.
 */
export default function BackButton() {
  const { homeRoute } = useAuth();
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace(homeRoute))}
      className="p-2"
      hitSlop={8}
    >
      <ChevronLeft size={26} color="#000" />
    </Pressable>
  );
}
