import "../global.css";
import "../lib/nativewind-animated";
import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack } from "expo-router";
import { configureNotificationHandler } from "../lib/push";
import { AuthProvider, useAuth } from "../lib/auth-context";
import { ToastProvider } from "../components/Toast";
import BootSplash from "../components/BootSplash";
import OfflineBanner from "../components/OfflineBanner";
import NotificationPermissionBanner from "../components/NotificationPermissionBanner";
import PushGate from "../components/PushGate";
import PendingInviteGate from "../components/PendingInviteGate";
import PendingFriendInviteGate from "../components/PendingFriendInviteGate";
import BackButton from "../components/BackButton";
import { warmUp } from "../lib/warmup";

// SDK 57: shouldShowAlert is deprecated; banner + list replace it.
// Inert on web (expo-notifications resolves to a no-op stub there).
configureNotificationHandler();

// Fired once at module eval, i.e. before the first render - see warmUp()'s
// docstring for why this must not wait on auth state.
warmUp();

// Anchors the route tree on `index` so a direct deep link to e.g. /settings
// gets `index` prepended as a parent route and shows a working back arrow -
// verified against expo-router 57's source (getRoutesCore.js reads this at
// build time, independent of the runtime Stack.Protected guards below, so it
// cannot reintroduce the /join/undefined bug documented in the Navigation()
// comment). It doesn't help a signed-out user on /join/CODE, since `index`
// is guarded off there and can't be the anchor - BackButton is the
// guaranteed fallback for that case.
export const unstable_settings = { anchor: 'index' };

function Navigation() {
  const { status } = useAuth();

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') warmUp();
    });
    return () => sub.remove();
  }, []);

  return (
    <>
      {status === 'signedIn' && <PushGate />}
      {status === 'signedIn' && <PendingInviteGate />}
      {status === 'signedIn' && <PendingFriendInviteGate />}
      {status === 'signedIn' && <OfflineBanner />}
      {status === 'signedIn' && <NotificationPermissionBanner />}
      <Stack screenOptions={{ animation: 'slide_from_right', animationDuration: 220 }}>
        {/*
          Guard is "not signedOut", not "signedIn": while status is 'loading'
          (every page load, however briefly), BOTH Protected blocks would
          otherwise have guard=false, leaving join/[code] as the only screen
          anywhere in the Stack. Per the expo-router docs, a route with no
          match falls back to "the first available screen in the stack" -
          which then becomes join/[code] with no code, i.e. exactly the
          /join/undefined bug. Keeping this block "available" during loading
          too (BootSplash covers it visually) keeps index as the real anchor.

          Two ordering constraints follow from how expo-router actually picks
          that fallback (routeNames[0], in JSX declaration order) and MUST be
          preserved:
          - this "not signedOut" block must stay FIRST, so routeNames[0] is
            'index' whenever index is available.
          - join/[code] below must stay LAST, after the signedOut block. If it
            moved above sign-in, a signed-out user would get
            routeNames[0] === 'join/[code]' again - the bug is back verbatim.
          Also: never pass `initialRouteName` as a prop on <Stack> directly
          (as opposed to unstable_settings above) - react-navigation throws
          "Couldn't find a screen named '...'" for any auth state where that
          name isn't currently available, which is a guaranteed crash here.
        */}
        <Stack.Protected guard={status !== 'signedOut'}>
          {/* headerShown: false here - index.tsx renders its own top bar
              (settings/status/groups+search) inside the screen body, since
              the status line needs more room and styling than a native
              header title supports. */}
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen
            name="search"
            options={{
              title: "Přátelé", presentation: "modal", animation: "slide_from_bottom",
              headerShown: true,
              headerStyle: { backgroundColor: '#FCFBF8' },
              headerLeft: () => <BackButton />,
            }}
          />
          <Stack.Screen
            name="settings"
            options={{
              title: "Nastavení", presentation: "modal", animation: "slide_from_bottom",
              headerShown: true,
              headerStyle: { backgroundColor: '#FCFBF8' },
              headerLeft: () => <BackButton />,
            }}
          />
          <Stack.Screen
            name="groups/index"
            options={{
              title: "Skupiny", presentation: "modal", animation: "slide_from_bottom",
              headerShown: true,
              headerStyle: { backgroundColor: '#FCFBF8' },
              headerLeft: () => <BackButton />,
            }}
          />
          <Stack.Screen
            name="groups/new"
            options={{
              title: "Nová skupina",
              headerShown: true,
              headerStyle: { backgroundColor: '#FCFBF8' },
              headerLeft: () => <BackButton />,
            }}
          />
          <Stack.Screen
            name="groups/[id]"
            options={{
              title: "Skupina",
              headerShown: true,
              headerStyle: { backgroundColor: '#FCFBF8' },
              headerLeft: () => <BackButton />,
            }}
          />
        </Stack.Protected>
        <Stack.Protected guard={status === 'signedOut'}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
        {/* Public: reachable in every auth state, so an invite link never
            gets lost behind the Stack.Protected redirect (see docs - a
            guarded-off screen falls back to the anchor route). Must stay
            LAST in JSX - see the ordering comment above. */}
        <Stack.Screen
          name="join/[code]"
          options={{
            title: "Pozvánka",
            headerShown: true,
            headerStyle: { backgroundColor: '#FCFBF8' },
          }}
        />
        <Stack.Screen
          name="add-friend/[code]"
          options={{
            title: "Přidat přítele",
            headerShown: true,
            headerStyle: { backgroundColor: '#FCFBF8' },
          }}
        />
      </Stack>
      <BootSplash visible={status === 'loading'} />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Navigation />
      </ToastProvider>
    </AuthProvider>
  );
}
