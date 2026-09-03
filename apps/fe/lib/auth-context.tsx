import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { api, ApiError, setUnauthorizedHandler, type UserDto } from './api';
import * as Storage from './storage';
import { hydrateCache, readCacheSync, writeCache, clearCache } from './cache';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type AuthValue = {
  status: AuthStatus;
  me: UserDto | null;
  /** True once a getMe() has actually succeeded this session - false while `me` is only the cached value from a previous session. */
  verified: boolean;
  /** True when the last background verify/refresh failed for a reason other than 401 (network down, container still cold). Never implies signedOut. */
  offline: boolean;
  /**
   * '/' only resolves while status !== 'signedOut' (see app/_layout.tsx's
   * Stack.Protected guards) - router.replace('/') while actually signed out
   * targets a route with no match among the currently available screens and
   * silently does nothing. Derive the target here so no call site has to
   * re-derive (and risk getting) this wrong - this is exactly the bug fixed
   * in the "Zpět domů" button on the invalid-invite screen.
   */
  homeRoute: '/' | '/sign-in';
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

// Blocking-probe fallback only (token present, no cached `me` - first launch
// on a new device, or after a cache wipe). The optimistic path below never
// waits on this.
const RETRY_DELAYS_MS = [2000, 4000, 8000];
// Patient background re-verify once already signed in optimistically - never
// gives up, never signs out on its own (only a real 401 does that).
const BACKGROUND_RETRY_DELAYS_MS = [1000, 3000, 8000, 20000];
const BACKGROUND_POLL_MS = 60_000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [me, setMe] = useState<UserDto | null>(null);
  const [verified, setVerified] = useState(false);
  const [offline, setOffline] = useState(false);
  const alive = useRef(true);
  const userIdRef = useRef<string | null>(null);
  const backgroundTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (backgroundTimer.current) clearTimeout(backgroundTimer.current);
    };
  }, []);

  const cacheMe = useCallback((user: UserDto) => {
    if (userIdRef.current) writeCache(userIdRef.current, 'me', user);
  }, []);

  // Used only by the 401 handler (a real session expiry). Deliberately does
  // NOT clear the cache - it's namespaced per user id so it can never leak
  // to a different account, and keeping it means the next login for the
  // same user is instant instead of a cold blocking probe. Only the
  // explicit signOut() button below clears it (a different person may use
  // this device next).
  const signOutInternal = useCallback(() => {
    if (backgroundTimer.current) clearTimeout(backgroundTimer.current);
    if (!alive.current) return;
    setMe(null);
    setVerified(false);
    setOffline(false);
    setStatus('signedOut');
  }, []);

  const verifyInBackground = useCallback(() => {
    let attempt = 0;

    const attemptVerify = async () => {
      try {
        const user = await api.getMe();
        if (!alive.current) return;
        setMe(user);
        setVerified(true);
        setOffline(false);
        cacheMe(user);
      } catch (e) {
        if (!alive.current) return;
        if (e instanceof ApiError && e.status === 401) {
          // api.request() already ran the global 401 handler (logout +
          // setUnauthorizedHandler below), which calls signOutInternal.
          return;
        }
        setOffline(true);
        const delay = BACKGROUND_RETRY_DELAYS_MS[attempt] ?? BACKGROUND_POLL_MS;
        attempt++;
        backgroundTimer.current = setTimeout(attemptVerify, delay);
      }
    };

    attemptVerify();
  }, [cacheMe]);

  // Blocking fallback: no cached `me` to enter optimistically with (first
  // launch on a new device, or after a cache wipe). Only a 401 means
  // signedOut; any other failure (network error, 502/503/504 from a cold
  // Container App) retries with backoff before giving up.
  const blockingProbe = useCallback(async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        const user = await api.getMe();
        if (!alive.current) return;
        // Establish the cache namespace and persist userId - without this,
        // a token-but-no-userId session (or a fresh cache wipe) would take
        // this blocking path on every single future boot, never earning the
        // optimistic one.
        userIdRef.current = String(user.userID);
        await Storage.setItem('userId', userIdRef.current).catch(() => {});
        await hydrateCache(userIdRef.current);
        if (!alive.current) return;
        setMe(user);
        setVerified(true);
        setStatus('signedIn');
        cacheMe(user);
        return;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          if (!alive.current) return;
          setStatus('signedOut');
          return;
        }
        if (attempt >= RETRY_DELAYS_MS.length) {
          if (!alive.current) return;
          setStatus('signedOut');
          return;
        }
        await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt]));
      }
    }
  }, [cacheMe]);

  const boot = useCallback(async () => {
    const [token, userId] = await Promise.all([
      Storage.getItem('userToken').catch(() => null),
      Storage.getItem('userId').catch(() => null),
    ]);

    if (!token) {
      if (alive.current) setStatus('signedOut');
      return;
    }

    if (!userId) {
      // Upgrade from a build before userId persistence, or storage
      // inconsistency - fall back to the blocking path. Once it succeeds,
      // userId is persisted (api.login/getMe do this) and every future boot
      // takes the optimistic path.
      await blockingProbe();
      return;
    }

    userIdRef.current = userId;
    await hydrateCache(userId);
    api.hydrateSession({ token, userId: Number(userId) });

    const cached = readCacheSync<UserDto>(userId, 'me');
    if (cached) {
      if (!alive.current) return;
      setMe(cached.data);
      setStatus('signedIn');
      verifyInBackground();
    } else {
      await blockingProbe();
    }
  }, [blockingProbe, verifyInBackground]);

  useEffect(() => {
    boot();
  }, [boot]);

  // Re-verify when the app returns to the foreground while offline, so a
  // resolved network outage or a woken-up container clears the banner
  // without waiting for the next background poll tick.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && offline && status === 'signedIn') {
        if (backgroundTimer.current) clearTimeout(backgroundTimer.current);
        verifyInBackground();
      }
    });
    return () => sub.remove();
  }, [offline, status, verifyInBackground]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      signOutInternal();
    });
    return () => setUnauthorizedHandler(null);
  }, [signOutInternal]);

  const value: AuthValue = {
    status,
    me,
    verified,
    offline,
    homeRoute: status === 'signedOut' ? '/sign-in' : '/',
    signIn: async (username, password) => {
      await api.login(username, password);
      const user = await api.getMe();
      const userId = api.getCurrentUserId();
      userIdRef.current = userId != null ? String(userId) : null;
      if (userIdRef.current) await hydrateCache(userIdRef.current);
      setMe(user);
      setVerified(true);
      setOffline(false);
      setStatus('signedIn');
      cacheMe(user);
    },
    signUp: async (username, password, name) => {
      await api.register(username, password, name);
      const user = await api.getMe();
      const userId = api.getCurrentUserId();
      userIdRef.current = userId != null ? String(userId) : null;
      if (userIdRef.current) await hydrateCache(userIdRef.current);
      setMe(user);
      setVerified(true);
      setOffline(false);
      setStatus('signedIn');
      cacheMe(user);
    },
    signOut: async () => {
      // Flip the UI to signed-out immediately - previously this awaited two
      // network calls (unregister push token, then logout) before updating
      // anything, so on a cold server the button did nothing visible for up
      // to ~15s. unregisterPushToken needs a still-valid JWT, so it has to
      // run before api.logout() clears it; capped at 2s so a slow/failed
      // request can never hold up the actual sign-out.
      if (backgroundTimer.current) clearTimeout(backgroundTimer.current);
      setStatus('signedOut');
      setMe(null);
      setVerified(false);
      setOffline(false);
      clearCache();
      await Promise.race([
        api.unregisterPushToken().catch(() => {}),
        new Promise(resolve => setTimeout(resolve, 2000)),
      ]);
      await api.logout();
    },
    refreshMe: async () => {
      const user = await api.getMe();
      setMe(user);
      setVerified(true);
      setOffline(false);
      cacheMe(user);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
