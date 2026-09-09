import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  Platform,
  ScrollView,
  ActivityIndicator,
  Animated,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SettingsIcon from "lucide-react-native/icons/settings";
import UserPlus from "lucide-react-native/icons/user-plus";
import Users from "lucide-react-native/icons/users";
import { api, FreeEntry } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { parseServerDate } from "../lib/date";
import { formatTime } from "../lib/time";
import { useNow } from "../hooks/useNow";
import UserRow from "../components/UserRow";
import GroupBadge from "../components/GroupBadge";
import OnboardingCard from "../components/OnboardingCard";
import FreeDial from "../components/FreeDial";
import StatusHeadline from "../components/StatusHeadline";
import Reveal from "../components/Reveal";
import FadeIn from "../components/FadeIn";
import ProfileSheet from "../components/ProfileSheet";
import BottomFade from "../components/BottomFade";
import { useToast } from "../components/Toast";
import { useAsyncData } from "../hooks/useAsyncData";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { useDeferredPending } from "../hooks/useDeferredPending";
import { useSlowActionNotice } from "../hooks/useSlowActionNotice";
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
  // Shared between FreeDial's button and StatusHeadline so the circle and the
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
  const [profileId, setProfileId] = useState<string | null>(null);
  // Zbývá pod hranou obrazovky ještě obsah? Řídí odstín u dolní hrany.
  const [canScrollMore, setCanScrollMore] = useState(false);
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

  // No spinner/disabled state for the first ~1s (useDeferredPending below) -
  // the circle already shows the result the moment you tap it, so a loading
  // state on top of that would just contradict what's on screen for a
  // normal, fast request. But past 1s of continuous pending, showLoading
  // flips true and the dial's button disables further taps and shows its overlay,
  // and past 4s useSlowActionNotice puts up the shared cold-start toast - a
  // cold container no longer leaves the button looking "done" with no
  // indication the write hasn't actually landed yet. Rollback still happens
  // on failure, but only for the most recent tap: runId makes an older
  // (possibly slower) response's rollback/success/pending-clear a no-op once
  // a newer one has already landed.
  const [statusPending, setStatusPending] = useState(false);
  const showLoading = useDeferredPending(statusPending, 1000);
  useSlowActionNotice(statusPending);

  /**
   * `mode: "extend"` posouvá konec už běžícího volna, takže musí jít přes
   * `PUT /freetimes/{id}`, ne přes `POST` - ten na backendu vždy zakládá nový
   * záznam, čímž by vzniklo druhé překrývající se volno a přátelům by
   * podruhé odešla notifikace "má teď volno".
   */
  const applyStatus = (
    nextFree: boolean,
    until: Date | null,
    mode: "set" | "extend" = "set",
  ) => {
    const prevFree = isFree;
    const prevUntil = freeUntil;
    const runId = ++statusRunId.current;
    setIsFree(nextFree);
    setFreeUntil(until);
    setStatusPending(true);
    (async () => {
      try {
        if (mode === "extend" && until) await api.extendMyStatus(until);
        else await api.setMyStatus(nextFree, until ?? undefined);
        if (statusRunId.current === runId) await refreshMe();
      } catch (e) {
        if (statusRunId.current !== runId) return;
        setIsFree(prevFree);
        setFreeUntil(prevUntil);
        show(errorMessage(e, "Nepodařilo se uložit stav."), "error");
      } finally {
        if (statusRunId.current === runId) setStatusPending(false);
      }
    })();
  };

  return (
    <View className="flex-1 bg-[#FCFBF8]">
      <View style={{ paddingTop: insets.top }} className="bg-[#FCFBF8]">
        {/* Odsazení je větší než u obsahu níž (24 vs 16 px od kraje):
            ikony potřebují víc vzduchu, aby nevypadaly přilepené ke
            hraně. Drží se symetricky na obou stranách, jinak by levá
            a pravá ikona sedla jinak. */}
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

      {/* Obal kvůli odstínu u dolní hrany - ten musí ležet nad rolovanou
          oblastí, ne v ní, aby se s obsahem neposouval. */}
      <View className="flex-1">
        <ScrollView
          className="flex-1"
          // Obsah se do plochy vejde, ale ScrollView si i tak drží scrollbar
          // a nechá se přetáhnout za konec (na webu overscroll, na nativu
          // bounce). Pro obrazovku, která je z principu na jednu výšku, to jen
          // rozbíjí dojem - proto indikátory pryč a přetahování zakázané.
          // Rolování samo funguje dál, kdyby seznam volných přátel narostl.
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } =
              e.nativeEvent;
            setCanScrollMore(
              contentOffset.y + layoutMeasurement.height <
                contentSize.height - 2,
            );
          }}
          scrollEventThrottle={16}
          bounces={false}
          overScrollMode="never"
          style={
            Platform.OS === "web"
              ? ({ overscrollBehavior: "none" } as object)
              : undefined
          }
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: "center",
            paddingTop: 12,
            paddingHorizontal: 16,
          }}
        >
          <StatusHeadline fade={fade} />

          <OnboardingCard
            name={me?.name ?? ""}
            connectionCount={connectionCount}
            connectionsSettled={connections.settled}
          />

          <FreeDial
            isFree={isFree}
            freeUntil={freeUntil}
            fade={fade}
            pending={showLoading}
            now={now}
            onConfirm={(until) => applyStatus(true, until)}
            onChangeEnd={(until) => applyStatus(true, until, "extend")}
            onEnd={() => applyStatus(false, null)}
          />

          <Reveal visible={isFree} delayMs={180} className="w-full mt-6 flex-1">
            {/* Odstupy drž shodné se seznamem presetů v PresetList - oba
              seznamy se v témže místě střídají, takže rozdíl by se projevil
              jako poskočení obsahu při přepnutí stavu. */}
            <Text className="text-gray-400 font-medium text-xs tracking-widest uppercase mb-2">
              Kdo je také volný
            </Text>

            {freeList.error && (
              <Pressable
                onPress={freeList.reload}
                className="bg-red-50 rounded-xl px-3 py-2 mb-3"
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
              <FadeIn>
                <Text className="text-gray-300 text-base mb-2">
                  Zatím nikoho nemáš.
                </Text>
                <Pressable
                  onPress={() => router.push("/search")}
                  className="mb-1"
                >
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
                <Text className="text-gray-300 text-base">
                  Zatím nikdo z přátel.
                </Text>
              </FadeIn>
            )}
          </Reveal>
        </ScrollView>

        {/* Scrollbary jsou skryté, takže bez tohohle nic nenapovídá, že seznam
          volných přátel pokračuje pod hranou obrazovky. */}
        <BottomFade visible={canScrollMore} />
      </View>

      <ProfileSheet userId={profileId} onClose={() => setProfileId(null)} />
    </View>
  );
}
