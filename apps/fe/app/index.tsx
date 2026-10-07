import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
import ArrowRight from "lucide-react-native/icons/arrow-right";
import { api, FreeEntry, UserDto } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { parseServerDate } from "../lib/date";
import { formatTime, isTomorrow } from "../lib/time";
import { useNow } from "../hooks/useNow";
import UserRow from "../components/UserRow";
import GroupBadge from "../components/GroupBadge";
import FreeDial from "../components/FreeDial";
import Reveal from "../components/Reveal";
import FadeIn from "../components/FadeIn";
import ProfileSheet from "../components/ProfileSheet";
import BottomFade from "../components/BottomFade";
import { useToast } from "../components/Toast";
import { useAsyncData } from "../hooks/useAsyncData";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { useRealtimeRefetch, useRefreshInterval } from "../hooks/useRealtime";
import { useDeferredPending } from "../hooks/useDeferredPending";
import { useSlowActionNotice } from "../hooks/useSlowActionNotice";
import { errorMessage } from "../lib/errors";
import { isOnboardingStep } from "../lib/tour";
import { useTour, useTourTarget } from "../components/tour/TourProvider";
import TourOverlay from "../components/tour/TourOverlay";
import { makeTourDummyEntry, TOUR_DUMMY_ID } from "../components/tour/dummy";

export default function Index() {
  const { me, refreshMe } = useAuth();
  const { show } = useToast();
  const insets = useSafeAreaInsets();
  const tour = useTour();
  const friendsIconTarget = useTourTarget("friendsIcon");
  const groupsIconTarget = useTourTarget("groupsIcon");
  const dummyTarget = useTourTarget("dummy");
  const scrollRef = useRef<ScrollView>(null);
  /** Ukázkový volný přítel - jen v posledních krocích průvodce, nikdy z API. */
  const showDummy = tour.step === "dummy" || tour.step === "dummyContact";
  const dummyEntry = useMemo(() => (showDummy ? makeTourDummyEntry() : null), [showDummy]);

  // Úvodní kroky průvodce po registraci mají vlastní obrazovku.
  useEffect(() => {
    if (isOnboardingStep(tour.step)) router.replace("/onboarding");
  }, [tour.step]);

  // Hydrated from me.activeFreeTime (see auth-context / GET /users/me) so a
  // reload shows the real server state instead of always resetting to "not
  // free" - the previous version held this as local-only state with no
  // hydration at all.
  //
  // `isFree` = volno je založené: běží, nebo je naplánované dopředu (task
  // 0008). Naplánované má `freeFrom` v budoucnu; běžící `null`.
  const initial = statusFromMe(me);
  const [isFree, setIsFree] = useState(initial.isFree);
  const [freeFrom, setFreeFrom] = useState<Date | null>(initial.start);
  const [freeUntil, setFreeUntil] = useState<Date | null>(initial.until);
  // Zápis stavu je optimistický a tapy se neblokují, takže se requesty
  // neposílají jeden za každé ťuknutí. Drží se poslední potvrzený stav ze
  // serveru a poslední chtěný stav z UI a syncStatus() mezi nimi po jednom
  // requestu dorovnává (viz task 0025). Dvojťuk nebo tažení prstence během
  // POSTu tak nikdy nepošle souběžné requesty ani druhé volno.
  const confirmedStatus = useRef<FreeState>(initial);
  const desiredStatus = useRef<FreeState | null>(null);
  const syncing = useRef(false);
  // Drives FreeButton's gray -> orange crossfade; owned here so its initial
  // value follows the hydrated isFree.
  const fade = useRef(new Animated.Value(isFree ? 1 : 0)).current;

  // Průvodce: klepnutí na tlačítko během kroku "kolečko" ho posune taky -
  // kolečko tím uživatel zvládl. Krok "tlačítko" je hotový, jakmile je
  // volno zapnuté; kdo si průvodce spustí znovu z nastavení a volno už má,
  // ten ho tedy přeskočí, místo aby musel volno ukončit.
  const { advance, step: tourStep } = tour;
  const prevFree = useRef(isFree);
  useEffect(() => {
    const changed = prevFree.current !== isFree;
    prevFree.current = isFree;
    if (changed) advance("ring");
    if (isFree) advance("button");
  }, [isFree, tourStep, advance]);

  // Ukázkový přítel se objeví v seznamu pod prstencem, který na menších
  // displejích leží pod hranou - dorolovat k němu, ať na něj nápověda vidí.
  useEffect(() => {
    if (tourStep !== "dummy") return;
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 350);
    return () => clearTimeout(t);
  }, [tourStep]);

  useEffect(() => {
    if (!me) return;
    const server = statusFromMe(me);
    // Během dorovnávání je server jen mezistav - UI drží chtěný stav a
    // syncStatus si potvrzený stav vede sám.
    if (syncing.current) return;
    confirmedStatus.current = server;
    setIsFree(server.isFree);
    setFreeFrom(server.start);
    setFreeUntil(server.until);
  }, [
    me?.activeFreeTime?.freeUntil,
    me?.upcomingFreeTime?.freeSince,
    me?.upcomingFreeTime?.freeUntil,
  ]);

  // Naplánované volno začne samo (backend ho přátelům ohlásí) - lokálně se
  // jen přepne na běžící a dotáhne se stav ze serveru.
  useEffect(() => {
    if (!freeFrom) return;
    const ms = freeFrom.getTime() - Date.now();
    const t = setTimeout(() => {
      setFreeFrom(null);
      if (isActive(confirmedStatus.current)) {
        confirmedStatus.current = { ...confirmedStatus.current, start: null };
      }
      refreshMe().catch(() => {});
    }, Math.max(0, ms));
    return () => clearTimeout(t);
  }, [freeFrom]);

  // Local expiry so the header doesn't keep claiming "Jsem Volný" past the
  // window's end while the app stays open with no user action to trigger a refetch.
  useEffect(() => {
    if (!isFree || !freeUntil) return;
    const ms = freeUntil.getTime() - Date.now();
    if (ms <= 0) {
      setIsFree(false);
      setFreeFrom(null);
      setFreeUntil(null);
      return;
    }
    const t = setTimeout(() => {
      setIsFree(false);
      setFreeFrom(null);
      setFreeUntil(null);
    }, ms);
    return () => clearTimeout(t);
  }, [isFree, freeUntil]);

  const [pendingCount, setPendingCount] = useState(0);
  const [profileId, setProfileId] = useState<string | null>(null);
  // Zbývá pod hranou obrazovky ještě obsah? Řídí odstín u dolní hrany.
  // Počítá se i z rozměrů, ne jen při rolování - na malé obrazovce je seznam
  // pod ohybem hned od začátku (task 0024).
  const [canScrollMore, setCanScrollMore] = useState(false);
  const scrollMetrics = useRef({ offset: 0, viewport: 0, content: 0 });
  const updateCanScrollMore = (patch: Partial<typeof scrollMetrics.current>) => {
    const m = Object.assign(scrollMetrics.current, patch);
    setCanScrollMore(m.viewport > 0 && m.offset + m.viewport < m.content - 2);
  };
  const now = useNow();

  // No spinner at all if this resolves in under 600ms (useDeferredPending,
  // inside useAsyncData) - and the previous list stays on screen through a
  // refetch or a transient error instead of flashing empty. cacheKey makes
  // this survive a cold start too: freeSince/freeUntil are cached as plain
  // ISO strings (JSON can't carry Date), so `revive` reconstructs them - and
  // since every entry carries its own freeUntil, stale/expired rows are
  // simply filtered out below rather than trusted against a cache TTL.
  const freeList = useAsyncData<FreeEntry[]>(
    () => api.getFreeNow(),
    [isFree],
    {
      // Nevolný uživatel seznam nevidí - dřív se tu vracelo `[]`, které
      // přepsalo cache a po označení se ukázalo "Zatím nikdo z přátel."
      // místo načítání.
      enabled: isFree,
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

  const refreshIntervalMs = useRefreshInterval();
  useAutoRefresh(freeList.reload, { intervalMs: refreshIntervalMs, enabled: isFree });
  useRealtimeRefetch(["FreeChanged"], () => {
    if (isFree) {
      freeList.reload();
      laterList.reload();
    }
  });

  // Kdo bude volný později (task 0008) - naplánovaná volna, která ještě
  // nezačala. Sekce se ukazuje jen když v ní někdo je: prázdné "nikdo" by
  // vedle seznamu "Kdo je také volný" jen zabíralo místo.
  const laterList = useAsyncData<FreeEntry[]>(
    () => api.getFreeLater(),
    [isFree],
    {
      enabled: isFree,
      cacheKey: "freeLater",
      revive: (raw) =>
        (raw as any[]).map((r) => ({
          ...r,
          freeSince: new Date(r.freeSince),
          freeUntil: new Date(r.freeUntil),
        })) as FreeEntry[],
    },
  );
  useAutoRefresh(laterList.reload, { intervalMs: refreshIntervalMs, enabled: isFree });
  const freeNowIds = new Set(friends.map((f) => f.user.id));
  // Komu plán už začal, ten patří do horního seznamu - realtime signál ze
  // serveru ho tam přesune, ale lokálně se nečeká.
  const later = (laterList.data ?? []).filter(
    (f) => f.freeSince.getTime() > now.getTime() && !freeNowIds.has(f.user.id),
  );

  const connections = useAsyncData(
    () => Promise.all([api.getAllFriends(), api.getGroups()]),
    [],
    { cacheKey: "connectionsSummary" },
  );
  const connectionCount =
    (connections.data?.[0]?.length ?? 0) + (connections.data?.[1]?.length ?? 0);
  // "Zatím nikoho nemáš." jen podle čerstvě načtených přátel a skupin - ne
  // podle staré cache ani když načtení selhalo.
  const hasNoConnections =
    connections.data !== undefined && !connections.isStale && connectionCount === 0;
  // Spinner i pro seznam, který už nějaká (prázdná) data má - jinak by se
  // během načítání po označení ukázalo prázdno.
  const showFreeSpinner = useDeferredPending(
    freeList.pending && friends.length === 0,
  );

  // Latest-wins guard: a slower earlier response must not overwrite a newer one.
  const pendingSeq = useRef(0);
  const loadPendingCount = useCallback(() => {
    const seq = ++pendingSeq.current;
    api
      .getPendingRequests()
      .then((reqs) => {
        if (seq === pendingSeq.current) setPendingCount(reqs.length);
      })
      .catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPendingCount();
      return () => {
        pendingSeq.current++;
      };
    }, [loadPendingCount]),
  );
  useRealtimeRefetch(["FriendsChanged", "FriendRequestReceived"], () => {
    loadPendingCount();
    connections.reload();
  });

  // No spinner/disabled state for the first ~1s (useDeferredPending below) -
  // the circle already shows the result the moment you tap it, so a loading
  // state on top of that would just contradict what's on screen for a
  // normal, fast request. But past 1s of continuous pending, showLoading
  // flips true and the dial's button disables further taps and shows its overlay,
  // and past 4s useSlowActionNotice puts up the shared cold-start toast - a
  // cold container no longer leaves the button looking "done" with no
  // indication the write hasn't actually landed yet.
  const [statusPending, setStatusPending] = useState(false);
  const showLoading = useDeferredPending(statusPending, 1000);
  useSlowActionNotice(statusPending);

  /**
   * Dorovná server na `desiredStatus`, jeden request po druhém. Request se
   * volí podle potvrzeného stavu v tu chvíli, ne podle toho, co uživatel
   * zrovna zmáčkl:
   * - konec volna → `DELETE`;
   * - volno, když žádné neběží → `POST /freetimes` (nové volno, notifikace);
   * - jiný začátek nebo konec založeného volna → `PUT` přes `updateMyStatus`.
   *   `POST` by na backendu založil druhé překrývající se volno a přátelům by
   *   podruhé odešla notifikace "má teď volno".
   *
   * Zapnutí a hned vypnutí během prvního requestu tedy pošle POST a DELETE
   * za sebou, nikdy souběžně.
   */
  const syncStatus = async () => {
    if (syncing.current) return;
    syncing.current = true;
    setStatusPending(true);
    let failure: unknown = null;
    while (
      desiredStatus.current &&
      !sameStatus(desiredStatus.current, confirmedStatus.current)
    ) {
      const want = desiredStatus.current;
      const have = confirmedStatus.current;
      try {
        if (!want.isFree) await api.setMyStatus(false);
        else if (!isActive(have))
          await api.setMyStatus(true, want.until ?? undefined, want.start ?? undefined);
        else if (want.until)
          await api.updateMyStatus(want.until, startChange(have, want));
        confirmedStatus.current = want;
      } catch (e) {
        // Mezitím přišla novější volba - zkusí se rovnou ta.
        if (desiredStatus.current !== want) continue;
        failure = e;
        break;
      }
    }
    desiredStatus.current = null;
    syncing.current = false;
    setStatusPending(false);

    if (failure) {
      const back = confirmedStatus.current;
      setIsFree(back.isFree);
      setFreeFrom(back.start);
      setFreeUntil(back.until);
      show(errorMessage(failure, "Nepodařilo se uložit stav."), "error");
      return;
    }
    // Zápis prošel. Selhání následného GET /users/me už nic nevrací ani
    // nehlásí - uživatel na serveru stav má, a další ťuknutí by jinak
    // založilo druhé volno.
    refreshMe().catch(() => {});
  };

  const applyStatus = (
    nextFree: boolean,
    until: Date | null,
    start: Date | null = null,
  ) => {
    setIsFree(nextFree);
    setFreeFrom(start);
    setFreeUntil(until);
    desiredStatus.current = { isFree: nextFree, start, until };
    syncStatus();
  };

  return (
    <View className="flex-1 bg-[#FCFBF8]">
      <View style={{ paddingTop: insets.top }} className="bg-[#FCFBF8]">
        {/* Odsazení je větší než u obsahu níž (24 vs 16 px od kraje):
            ikony potřebují víc vzduchu, aby nevypadaly přilepené ke
            hraně. Drží se symetricky na obou stranách, jinak by levá
            a pravá ikona sedla jinak. */}
        <View className="flex-row items-center justify-between px-2 py-2">
          <Pressable
            onPress={() => router.push("/settings")}
            accessibilityRole="button"
            accessibilityLabel="Nastavení"
            className="p-2"
          >
            <SettingsIcon size={22} color="#000" />
          </Pressable>

          <View className="flex-row items-center gap-3">
            <Pressable
              ref={groupsIconTarget}
              onPress={() => router.push("/groups")}
              accessibilityRole="button"
              accessibilityLabel="Skupiny"
              className="p-2"
            >
              <Users size={22} color="#000" />
            </Pressable>
            <Pressable
              ref={friendsIconTarget}
              onPress={() => router.push("/search")}
              accessibilityRole="button"
              accessibilityLabel="Přátelé"
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
          ref={scrollRef}
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
            updateCanScrollMore({
              offset: contentOffset.y,
              viewport: layoutMeasurement.height,
              content: contentSize.height,
            });
          }}
          onLayout={(e) =>
            updateCanScrollMore({ viewport: e.nativeEvent.layout.height })
          }
          onContentSizeChange={(_w, h) => updateCanScrollMore({ content: h })}
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
          <FreeDial
            isFree={isFree}
            freeFrom={freeFrom}
            freeUntil={freeUntil}
            fade={fade}
            pending={showLoading}
            now={now}
            onConfirm={(until, start) => applyStatus(true, until, start)}
            onChangeSlot={(start, until) => applyStatus(true, until, start)}
            onEnd={() => applyStatus(false, null)}
            onPick={() => advance("ring")}
          />

          <Reveal
            visible={isFree || showDummy}
            delayMs={180}
            className="w-full mt-6 flex-1"
          >
            {/* Odstupy drž shodné se seznamem presetů v PresetList - oba
              seznamy se v témže místě střídají, takže rozdíl by se projevil
              jako poskočení obsahu při přepnutí stavu. */}
            <Text className="text-gray-400 font-medium text-xs tracking-widest uppercase mb-2">
              Kdo je také volný
            </Text>

            {dummyEntry && (
              <View ref={dummyTarget} collapsable={false}>
                <UserRow
                  user={dummyEntry.user}
                  subtitle={"Do " + formatTime(dummyEntry.freeUntil)}
                  onPress={() => {
                    setProfileId(TOUR_DUMMY_ID);
                    advance("dummy");
                  }}
                />
              </View>
            )}

            {freeList.error && !freeList.pending && (
              <Pressable
                onPress={freeList.reload}
                accessibilityRole="button"
                className="bg-red-50 rounded-xl px-3 py-2 mb-3"
              >
                <Text className="text-red-500 text-xs">
                  {friends.length > 0
                    ? "Nepodařilo se načíst — zobrazuji poslední známý stav. Zkusit znovu."
                    : "Nepodařilo se načíst, kdo je volný. Zkusit znovu."}
                </Text>
              </Pressable>
            )}

            {showFreeSpinner ? (
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
            ) : !freeList.settled ||
              freeList.pending ||
              freeList.error ||
              showDummy ? null : hasNoConnections ? (
              <FadeIn>
                <Text className="text-gray-400 text-base mb-1">
                  Zatím nikoho nemáš.
                </Text>
                {/* Šipka jako ikona, ne znak "→": ten systémové písmo nemá
                    a prohlížeč ho dokreslil cizím fontem. Řádky mají výšku
                    dotykového cíle, ať se do sebe nemačkají. */}
                <EmptyStateLink
                  label="Přidej přátele"
                  onPress={() => router.push("/search")}
                />
                <EmptyStateLink
                  label="Připoj se ke skupině"
                  onPress={() => router.push("/groups")}
                />
              </FadeIn>
            ) : (
              <FadeIn>
                <Text className="text-gray-300 text-base">
                  Zatím nikdo z přátel.
                </Text>
              </FadeIn>
            )}

            {later.length > 0 && (
              <FadeIn>
                <Text className="text-gray-400 font-medium text-xs tracking-widest uppercase mt-6 mb-2">
                  Později
                </Text>
                {later.map((entry) => (
                  <UserRow
                    key={entry.user.id}
                    user={entry.user}
                    subtitle={`Od ${withDay(entry.freeSince, now)} do ${withDay(entry.freeUntil, now)}`}
                    badge={<GroupBadge via={entry.via} />}
                    onPress={() => setProfileId(entry.user.id)}
                  />
                ))}
              </FadeIn>
            )}
          </Reveal>
        </ScrollView>

        {/* Scrollbary jsou skryté, takže bez tohohle nic nenapovídá, že seznam
          volných přátel pokračuje pod hranou obrazovky. */}
        <BottomFade visible={canScrollMore} />
      </View>

      <TourOverlay screen="index" />

      <ProfileSheet
        userId={profileId}
        onClose={() => {
          if (profileId === TOUR_DUMMY_ID) advance("dummyContact");
          setProfileId(null);
        }}
      />
    </View>
  );
}

/** `start` je naplánovaný začátek v budoucnu (task 0008); `null` = od teď / už běží. */
type FreeState = { isFree: boolean; start: Date | null; until: Date | null };

function statusFromMe(me: UserDto | null | undefined): FreeState {
  if (me?.activeFreeTime) {
    return { isFree: true, start: null, until: parseServerDate(me.activeFreeTime.freeUntil) };
  }
  if (me?.upcomingFreeTime) {
    return {
      isFree: true,
      start: parseServerDate(me.upcomingFreeTime.freeSince),
      until: parseServerDate(me.upcomingFreeTime.freeUntil),
    };
  }
  return { isFree: false, start: null, until: null };
}

/**
 * Volno, které na serveru opravdu ještě je - běžící nebo naplánované (ne jen
 * dosud nevypršelé lokálně).
 */
function isActive(s: FreeState): boolean {
  return s.isFree && (s.until == null || s.until.getTime() > Date.now());
}

const sameTime = (a: Date | null, b: Date | null) =>
  (a?.getTime() ?? null) === (b?.getTime() ?? null);

function sameStatus(a: FreeState, b: FreeState): boolean {
  if (!a.isFree) return !isActive(b);
  return isActive(b) && sameTime(a.until, b.until) && sameTime(a.start, b.start);
}

/**
 * Jaký začátek poslat v `PUT`. Beze změny nic - backend si nechá původní a
 * běžící volno neztratí, odkdy trvá. Naplánovaný začátek stažený na "teď"
 * se posílá jako teď, aby ho backend hned spustil.
 */
function startChange(have: FreeState, want: FreeState): Date | undefined {
  if (sameTime(have.start, want.start)) return undefined;
  return want.start ?? new Date();
}

const withDay = (d: Date, now: Date) =>
  formatTime(d) + (isTomorrow(d, now) ? " (zítra)" : "");

function EmptyStateLink({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      className="flex-row items-center self-start gap-1.5 py-2.5 active:opacity-70"
    >
      <Text className="text-[#EE6C4D] font-medium text-base">{label}</Text>
      <ArrowRight size={16} color="#EE6C4D" strokeWidth={2.25} />
    </Pressable>
  );
}
