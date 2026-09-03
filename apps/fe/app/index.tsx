import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Animated,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SettingsIcon from "lucide-react-native/icons/settings";
import UserPlus from "lucide-react-native/icons/user-plus";
import Users from "lucide-react-native/icons/users";
import Slider from "@react-native-community/slider";
import { api, FreeEntry } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { parseServerDate } from "../lib/date";
import { formatTime, hourOffset, isTomorrow } from "../lib/time";
import { useNow } from "../hooks/useNow";
import UserRow from "../components/UserRow";
import GroupBadge from "../components/GroupBadge";
import OnboardingCard from "../components/OnboardingCard";
import FreeButton from "../components/FreeButton";
import StatusHeadline from "../components/StatusHeadline";
import Reveal from "../components/Reveal";
import FadeIn from "../components/FadeIn";
import BottomSheet from "../components/BottomSheet";
import ProfileSheet from "../components/ProfileSheet";
import { useToast } from "../components/Toast";
import { useAsyncData } from "../hooks/useAsyncData";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { errorMessage } from "../lib/errors";

export default function Index() {
  const { me, refreshMe } = useAuth();
  const { show } = useToast();
  const insets = useSafeAreaInsets();

  // Hydrated from me.activeFreeTime (see auth-context / GET /users/me) so a
  // reload shows the real server state instead of always resetting to "not
  // free" - the previous version held this as local-only state with no
  // hydration at all.
  const [isFree, setIsFree] = useState(!!me?.activeFreeTime);
  const [freeUntil, setFreeUntil] = useState<Date | null>(
    me?.activeFreeTime ? parseServerDate(me.activeFreeTime.freeUntil) : null,
  );
  // Guards applyStatus against out-of-order responses now that it's
  // fire-and-forget (no pending flag to serialize taps on) - an older
  // request's rollback/success must never clobber a newer one's result.
  const statusRunId = useRef(0);
  // Shared between FreeButton and StatusHeadline so the circle and the
  // status text crossfade in lockstep instead of drifting apart - each
  // component drives its own scale/position, but there's only one fade.
  const fade = useRef(new Animated.Value(isFree ? 1 : 0)).current;

  useEffect(() => {
    if (me?.activeFreeTime) {
      setIsFree(true);
      setFreeUntil(parseServerDate(me.activeFreeTime.freeUntil));
    } else if (me) {
      setIsFree(false);
      setFreeUntil(null);
    }
  }, [me?.activeFreeTime?.freeUntil]);

  // Local expiry so the header doesn't keep claiming "Jsem Volný" past the
  // window's end while the app stays open with no user action to trigger a refetch.
  useEffect(() => {
    if (!isFree || !freeUntil) return;
    const ms = freeUntil.getTime() - Date.now();
    if (ms <= 0) {
      setIsFree(false);
      setFreeUntil(null);
      return;
    }
    const t = setTimeout(() => {
      setIsFree(false);
      setFreeUntil(null);
    }, ms);
    return () => clearTimeout(t);
  }, [isFree, freeUntil]);

  const [pendingCount, setPendingCount] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  // Index of the target hour, not a duration: 1 = the next full hour, 2 =
  // the one after that, etc. - see lib/time.ts hourOffset(). Replaces the
  // old "N hours from now" slider so every result lands on :00.
  const [hourIndex, setHourIndex] = useState(1);
  const now = useNow();

  // No spinner at all if this resolves in under 600ms (useDeferredPending,
  // inside useAsyncData) - and the previous list stays on screen through a
  // refetch or a transient error instead of flashing empty. cacheKey makes
  // this survive a cold start too: freeSince/freeUntil are cached as plain
  // ISO strings (JSON can't carry Date), so `revive` reconstructs them - and
  // since every entry carries its own freeUntil, stale/expired rows are
  // simply filtered out below rather than trusted against a cache TTL.
  const freeList = useAsyncData<FreeEntry[]>(
    () => (isFree ? api.getFreeNow() : Promise.resolve([])),
    [isFree],
    {
      cacheKey: "freeNow",
      revive: (raw) =>
        (raw as any[]).map((r) => ({
          ...r,
          freeSince: new Date(r.freeSince),
          freeUntil: new Date(r.freeUntil),
        })) as FreeEntry[],
    },
  );
  const friends = (freeList.data ?? []).filter(
    (f) => f.freeUntil.getTime() > now.getTime(),
  );

  useAutoRefresh(freeList.reload, { intervalMs: 30_000, enabled: isFree });

  const connections = useAsyncData(
    () => Promise.all([api.getAllFriends(), api.getGroups()]),
    [],
    { cacheKey: "connectionsSummary" },
  );
  const connectionCount =
    (connections.data?.[0]?.length ?? 0) + (connections.data?.[1]?.length ?? 0);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      api
        .getPendingRequests()
        .then((reqs) => {
          if (isActive) setPendingCount(reqs.length);
        })
        .catch(() => {});
      return () => {
        isActive = false;
      };
    }, []),
  );

  const applyStatus = (nextFree: boolean, until: Date | null) => {
    // Optimistic flip, fire-and-forget - the circle already shows the
    // result the moment you tap it, so a loading state on top of that would
    // just contradict what's on screen (and on a cold container it left the
    // button greyed out and unresponsive for up to ~15s). Rollback still
    // happens on failure, but only for the most recent tap: runId makes an
    // older (possibly slower) response's rollback or success a no-op once a
    // newer one has already landed.
    const prevFree = isFree;
    const prevUntil = freeUntil;
    const runId = ++statusRunId.current;
    setIsFree(nextFree);
    setFreeUntil(until);
    (async () => {
      try {
        await api.setMyStatus(nextFree, until ?? undefined);
        if (statusRunId.current === runId) await refreshMe();
      } catch (e) {
        if (statusRunId.current !== runId) return;
        setIsFree(prevFree);
        setFreeUntil(prevUntil);
        show(errorMessage(e, "Nepodařilo se uložit stav."), "error");
      }
    })();
  };

  const toggleFree = () => {
    if (isFree) {
      applyStatus(false, null);
    } else {
      setHourIndex(1);
      setModalVisible(true);
    }
  };

  const handleSetTime = () => {
    const untilDate = hourOffset(hourIndex, now);
    closeModal();
    applyStatus(true, untilDate);
  };

  const handleQuickSet = (offset: number) => {
    applyStatus(true, hourOffset(offset, now));
  };

  // BottomSheet itself runs the slide-down before calling this, so this just
  // flips the state that controls it.
  const closeModal = () => setModalVisible(false);

  const calculatedTime = useMemo(
    () => hourOffset(hourIndex, now),
    [hourIndex, now],
  );

  // Quick buttons: next full hour, +1, +2, +4 further - always a clock time
  // ("19:00"), never a duration ("3h"). Recomputed from `now` (ticks every
  // 60s via useNow) rather than on every render, so the labels don't drift.
  const quickOffsets = useMemo(
    () => [1, 2, 3, 5].map((n) => hourOffset(n, now)),
    [now],
  );

  return (
    <View className="flex-1 bg-[#FCFBF8]">
      <View style={{ paddingTop: insets.top }} className="bg-[#FCFBF8]">
        <View className="flex-row items-center justify-between px-2 py-2">
          <Pressable onPress={() => router.push("/settings")} className="p-2">
            <SettingsIcon size={22} color="#000" />
          </Pressable>

          <View className="flex-row items-center gap-3">
            <Pressable onPress={() => router.push("/groups")} className="p-2">
              <Users size={22} color="#000" />
            </Pressable>
            <Pressable
              onPress={() => router.push("/search")}
              className="p-2 relative"
            >
              <UserPlus size={22} color="#000" />
              {pendingCount > 0 && (
                <View className="absolute top-1 right-1 w-3 h-3 bg-[#EE6C4D] rounded-full border-2 border-white" />
              )}
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: "center",
          paddingTop: 24,
          paddingHorizontal: 16,
        }}
      >
        <StatusHeadline fade={fade} freeUntil={freeUntil} formatTime={formatTime} />

        <OnboardingCard
          name={me?.name ?? ""}
          connectionCount={connectionCount}
          connectionsSettled={connections.settled}
        />

        <FreeButton isFree={isFree} onPress={toggleFree} fade={fade} />

        <Reveal
          visible={!isFree}
          delayMs={180}
          className="flex-row w-full justify-between mt-10"
        >
          {quickOffsets.map((target, i) => (
            <Pressable
              key={i}
              onPress={() => handleQuickSet([1, 2, 3, 5][i])}
              className="flex-1 bg-white items-center p-3 rounded-xl active:bg-gray-50 mx-1 border border-gray-200"
            >
              <Text className="text-gray-800 font-semibold text-sm">
                {formatTime(target)}
              </Text>
              {isTomorrow(target, now) && (
                <Text className="text-gray-400 text-[10px] mt-1">zítra</Text>
              )}
            </Pressable>
          ))}
        </Reveal>

        <Reveal
          visible={isFree}
          delayMs={180}
          className="w-full mt-20 flex-1"
        >
          <Text className="text-gray-400 font-medium text-xs tracking-widest uppercase mb-4 ml-2">
            Kdo je také volný
          </Text>

          {freeList.error && (
            <Pressable
              onPress={freeList.reload}
              className="bg-red-50 rounded-xl px-3 py-2 mb-3 mx-2"
            >
              <Text className="text-red-500 text-xs">
                Nepodařilo se načíst — zobrazuji poslední známý stav. Zkusit
                znovu.
              </Text>
            </Pressable>
          )}

          {freeList.showSpinner ? (
            <ActivityIndicator size="small" color="#000" />
          ) : friends.length > 0 ? (
            <FadeIn>
              {friends.map((entry) => (
                <UserRow
                  key={entry.user.id}
                  user={entry.user}
                  subtitle={"Do " + formatTime(entry.freeUntil)}
                  badge={<GroupBadge via={entry.via} />}
                  onPress={() => setProfileId(entry.user.id)}
                />
              ))}
            </FadeIn>
          ) : !freeList.settled ? null : connectionCount === 0 ? (
            <FadeIn className="ml-2">
              <Text className="text-gray-300 text-base mb-2">
                Zatím nikoho nemáš.
              </Text>
              <Pressable onPress={() => router.push("/search")} className="mb-1">
                <Text className="text-[#EE6C4D] font-medium text-base">
                  Přidej přátele →
                </Text>
              </Pressable>
              <Pressable onPress={() => router.push("/groups")}>
                <Text className="text-[#EE6C4D] font-medium text-base">
                  Připoj se ke skupině →
                </Text>
              </Pressable>
            </FadeIn>
          ) : (
            <FadeIn>
              <Text className="text-gray-300 ml-2 text-base">
                Zatím nikdo z přátel.
              </Text>
            </FadeIn>
          )}
        </Reveal>
      </ScrollView>

      <BottomSheet visible={modalVisible} onClose={closeModal}>
        <View className="items-center mb-8">
          <Text className="text-gray-400 text-sm font-medium mb-1">
            Volný do
          </Text>
          <Text className="text-5xl font-light tracking-tight text-gray-900">
            {formatTime(calculatedTime)}
          </Text>
          {isTomorrow(calculatedTime, now) && (
            <Text className="text-gray-400 text-sm mt-1">zítra</Text>
          )}
        </View>

        <Slider
          style={{ width: "100%", height: 40, marginBottom: 32 }}
          minimumValue={1}
          maximumValue={24}
          step={1}
          value={hourIndex}
          onValueChange={setHourIndex}
          minimumTrackTintColor="#EE6C4D"
          maximumTrackTintColor="#f3f4f6"
          thumbTintColor="#EE6C4D"
        />

        <Pressable
          onPress={handleSetTime}
          className="bg-[#EE6C4D] py-4 rounded-full items-center active:opacity-80"
        >
          <Text className="text-white text-base font-medium">Potvrdit</Text>
        </Pressable>
      </BottomSheet>

      <ProfileSheet userId={profileId} onClose={() => setProfileId(null)} />
    </View>
  );
}
