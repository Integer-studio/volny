import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, TextInput, Pressable, ScrollView, ActivityIndicator, Text } from "react-native";
import Search from "lucide-react-native/icons/search";
import Check from "lucide-react-native/icons/check";
import X from "lucide-react-native/icons/x";
import UserMinus from "lucide-react-native/icons/user-minus";
import UserPlus from "lucide-react-native/icons/user-plus";
import QrCode from "lucide-react-native/icons/qr-code";
import Copy from "lucide-react-native/icons/copy";
import Share2 from "lucide-react-native/icons/share-2";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import QRCodeSvg from "react-native-qrcode-svg";
import { api, UserRelation, UserSearchResult, UserSummary } from "../lib/api";
import UserRow from "../components/UserRow";
import BottomSheet from "../components/BottomSheet";
import Button from "../components/Button";
import ProfileSheet from "../components/ProfileSheet";
import Reveal from "../components/Reveal";
import { useAsyncData } from "../hooks/useAsyncData";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { useRealtimeRefetch, useRefreshInterval } from "../hooks/useRealtime";
import { useSlowActionNotice } from "../hooks/useSlowActionNotice";
import { useToast } from "../components/Toast";
import { useAuth } from "../lib/auth-context";
import { errorMessage } from "../lib/errors";
import { useFocusEffect } from "expo-router";
import { useTour, useTourTarget } from "../components/tour/TourProvider";
import TourOverlay from "../components/tour/TourOverlay";
import { buildFriendInviteUrl, shareFriendInvite, copyFriendInviteLink } from "../lib/friend-invite-link";

/** Kratší dotaz backend nehledá (UsersController.Search). */
const MIN_QUERY = 2;
/** Jak dlouho jde odmítnutí žádosti vrátit, než se opravdu odešle. */
const REJECT_UNDO_MS = 5000;

type MyQrContentProps = {
  code: string | null;
  size: number;
  regenerating: boolean;
  onCopy: () => void;
  onShare: () => void;
  onRegenerate: () => Promise<void>;
};

// Shared by the inline card (idle state) and the BottomSheet (while searching).
function MyQrContent({ code, size, regenerating, onCopy, onShare, onRegenerate }: MyQrContentProps) {
  // Nový kód zneplatní všechny už rozeslané odkazy i QR - proto až po
  // potvrzení, ne jedním ťuknutím na ikonu (task 0030).
  const [confirming, setConfirming] = useState(false);

  if (!code) {
    return (
      <View className="items-center justify-center" style={{ height: size }}>
        <ActivityIndicator size="large" color="#EE6C4D" />
      </View>
    );
  }
  return (
    <View className="items-center w-full">
      <View className="bg-white p-3 rounded-2xl">
        <QRCodeSvg value={buildFriendInviteUrl(code)} size={size} />
      </View>
      {confirming ? (
        <View className="mt-5 w-full">
          <Text className="text-gray-500 text-sm text-center mb-3">
            Starý odkaz i QR kód přestanou fungovat.
          </Text>
          <View className="flex-row">
            <Button
              label="Zrušit"
              variant="secondary"
              disabled={regenerating}
              onPress={() => setConfirming(false)}
              className="flex-1 mr-2"
            />
            <Button
              label="Vygenerovat nový"
              loading={regenerating}
              onPress={() => onRegenerate().finally(() => setConfirming(false))}
              className="flex-1 ml-2"
            />
          </View>
        </View>
      ) : (
        <View className="flex-row mt-5 w-full">
          <Button label="Kopírovat" variant="secondary" icon={Copy} onPress={onCopy} className="flex-1 mr-2" />
          <Button label="Sdílet" variant="secondary" icon={Share2} onPress={onShare} className="flex-1 mx-1" />
          <Pressable
            onPress={() => setConfirming(true)}
            accessibilityRole="button"
            accessibilityLabel="Vygenerovat nový odkaz"
            className="flex-row items-center justify-center bg-gray-100 py-3 px-3 rounded-xl ml-2 active:opacity-80"
          >
            <RefreshCw size={16} color="#333" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

/** Šedý popisek místo akce ("Přátelé", "Odesláno"). */
function RowNote({ children }: { children: string }) {
  return <Text className="text-gray-400 text-sm font-medium mr-2">{children}</Text>;
}

export default function SearchScreen() {
  const { show } = useToast();
  const { me } = useAuth();
  const { advance } = useTour();
  const qrTarget = useTourTarget("friendsQr");
  useFocusEffect(useCallback(() => advance("friendsIcon"), [advance]));
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  // Vztah k uživateli změněný tady na obrazovce (odeslaná/zrušená žádost)
  // - výsledky hledání se kvůli tomu znovu nenačítají.
  const [relationOverrides, setRelationOverrides] = useState<Record<string, UserRelation>>({});
  // Uživatelé, u kterých právě běží nějaká akce (přidat, zrušit, odebrat...).
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [hiddenFriendIds, setHiddenFriendIds] = useState<Set<string>>(new Set());
  const [hiddenRequestIds, setHiddenRequestIds] = useState<Set<string>>(new Set());
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  useSlowActionNotice(busyIds.size > 0);

  const [qrVisible, setQrVisible] = useState(false);
  const [myCode, setMyCode] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const myInvite = useAsyncData(() => api.getMyFriendInviteCode(), []);

  useEffect(() => {
    if (myInvite.data) setMyCode(myInvite.data);
  }, [myInvite.data]);

  const trimmed = query.trim();
  const isSearching = trimmed.length > 0;

  const handleCopyMyCode = async () => {
    if (!myCode) return;
    const result = await copyFriendInviteLink(myCode);
    show(result === 'copied' ? 'Odkaz zkopírován.' : 'Kopírování se nezdařilo.', result === 'copied' ? 'success' : 'error');
  };

  const handleShareMyCode = async () => {
    if (!myCode) return;
    const result = await shareFriendInvite(myCode, me?.name ?? '');
    if (result === 'copied') show('Odkaz zkopírován.');
    else if (result === 'failed') show('Sdílení se nezdařilo.', 'error');
  };

  const handleRegenerateMyCode = async () => {
    setRegenerating(true);
    try {
      const fresh = await api.regenerateFriendInviteCode();
      setMyCode(fresh);
      show('Nový odkaz vygenerován. Starý přestal fungovat.');
    } catch (e) {
      show(errorMessage(e, 'Nepodařilo se vygenerovat nový odkaz.'), 'error');
    } finally {
      setRegenerating(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  const search = useAsyncData<UserSearchResult[]>(
    () => (debouncedQuery.length >= MIN_QUERY ? api.searchUsers(debouncedQuery) : Promise.resolve([])),
    [debouncedQuery]
  );
  const results = search.data ?? [];
  // Čerstvé výsledky ze serveru už vztahy znají, lokální přepisy jsou pryč.
  useEffect(() => setRelationOverrides({}), [search.data]);
  // Spinner hned při psaní, ne až po debounce a 600ms prodlevě - jinak
  // "nikdo nenalezen" problikl dřív, než se vůbec hledalo (task 0026).
  const searchBusy = trimmed !== debouncedQuery || search.pending;

  const lists = useAsyncData<[UserSummary[], UserSummary[], UserSummary[]]>(
    () => Promise.all([api.getAllFriends(), api.getPendingRequests(), api.getOutgoingRequests()]),
    [],
    { cacheKey: 'friendsPage' }
  );
  useAutoRefresh(lists.reload, { intervalMs: useRefreshInterval() });
  useRealtimeRefetch(['FriendsChanged', 'FriendRequestReceived'], lists.reload);
  const myFriends = (lists.data?.[0] ?? []).filter(f => !hiddenFriendIds.has(f.id));
  const pendingRequests = (lists.data?.[1] ?? []).filter(u => !hiddenRequestIds.has(u.id));
  const outgoingRequests = (lists.data?.[2] ?? []).filter(u => relationOverrides[u.id] !== 'none');

  const setBusy = (id: string, on: boolean) =>
    setBusyIds(prev => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const setRelation = (id: string, relation: UserRelation) =>
    setRelationOverrides(prev => ({ ...prev, [id]: relation }));
  const unhide = (setter: typeof setHiddenFriendIds, id: string) =>
    setter(prev => { const next = new Set(prev); next.delete(id); return next; });

  const handleAdd = async (user: UserSummary) => {
    setBusy(user.id, true);
    try {
      const result = await api.addFriend(user.id);
      if (result === 'accepted') {
        setRelation(user.id, 'friend');
        show(`Teď jste přátelé s ${user.name}.`);
      } else {
        setRelation(user.id, 'outgoing');
        show(`Žádost odeslána uživateli ${user.name}.`);
      }
      lists.reload();
    } catch (e) {
      show(errorMessage(e, 'Žádost se nepodařilo odeslat.'), 'error');
    } finally {
      setBusy(user.id, false);
    }
  };

  const handleCancel = async (user: UserSummary) => {
    setBusy(user.id, true);
    try {
      await api.cancelRequest(user.id);
      setRelation(user.id, 'none');
      show('Žádost zrušena.');
      lists.reload();
    } catch (e) {
      show(errorMessage(e, 'Žádost se nepodařilo zrušit.'), 'error');
    } finally {
      setBusy(user.id, false);
    }
  };

  const handleRemove = async (user: UserSummary) => {
    setBusy(user.id, true);
    try {
      await api.removeFriend(user.id);
      setHiddenFriendIds(prev => new Set(prev).add(user.id));
      setRelation(user.id, 'none');
      setConfirmRemoveId(null);
      show(`${user.name} už není mezi přáteli.`);
    } catch (e) {
      show(errorMessage(e, 'Odebrání se nezdařilo.'), 'error');
    } finally {
      setBusy(user.id, false);
    }
  };

  const handleAccept = async (user: UserSummary) => {
    setHiddenRequestIds(prev => new Set(prev).add(user.id));
    setRelation(user.id, 'friend');
    try {
      await api.acceptRequest(user.id);
      show(`Teď jste přátelé s ${user.name}.`);
      lists.reload();
    } catch (e) {
      unhide(setHiddenRequestIds, user.id);
      setRelation(user.id, 'incoming');
      show(errorMessage(e, 'Přijetí žádosti se nezdařilo.'), 'error');
    }
  };

  // Odmítnutí se odešle až po REJECT_UNDO_MS - do té doby ho jde z toastu
  // vrátit. Žádost od druhého by po skutečném odmítnutí už obnovit nešlo.
  const pendingRejects = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const sendReject = async (user: UserSummary) => {
    pendingRejects.current.delete(user.id);
    try {
      await api.rejectRequest(user.id);
    } catch (e) {
      unhide(setHiddenRequestIds, user.id);
      show(errorMessage(e, 'Odmítnutí žádosti se nezdařilo.'), 'error');
    }
  };
  const handleReject = (user: UserSummary) => {
    setHiddenRequestIds(prev => new Set(prev).add(user.id));
    pendingRejects.current.set(user.id, setTimeout(() => sendReject(user), REJECT_UNDO_MS));
    show('Žádost odmítnuta.', 'success', REJECT_UNDO_MS, {
      label: 'Vrátit',
      onPress: () => {
        const t = pendingRejects.current.get(user.id);
        if (t) clearTimeout(t);
        pendingRejects.current.delete(user.id);
        unhide(setHiddenRequestIds, user.id);
      },
    });
  };
  // Odchod z obrazovky odmítnutí neruší - jen ho odešle hned.
  useEffect(() => () => {
    pendingRejects.current.forEach(clearTimeout);
    pendingRejects.current.forEach((_t, id) => { api.rejectRequest(id).catch(() => {}); });
  }, []);

  const relationOf = (user: UserSearchResult): UserRelation =>
    hiddenFriendIds.has(user.id) ? 'none' : relationOverrides[user.id] ?? user.relation;

  const renderSearchAction = (user: UserSearchResult) => {
    const busy = busyIds.has(user.id);
    switch (relationOf(user)) {
      case 'friend':
        return <RowNote>Přátelé</RowNote>;
      case 'outgoing':
        return (
          <View className="flex-row items-center">
            <RowNote>Odesláno</RowNote>
            <Button
              label="Zrušit"
              size="sm"
              variant="secondary"
              loading={busy}
              onPress={() => handleCancel(user)}
              accessibilityLabel={`Zrušit žádost pro ${user.name}`}
            />
          </View>
        );
      case 'incoming':
        return (
          <Button
            label="Přijmout"
            size="sm"
            icon={Check}
            loading={busy}
            onPress={() => handleAccept(user)}
            accessibilityLabel={`Přijmout žádost od ${user.name}`}
          />
        );
      default:
        return (
          <Button
            label="Přidat"
            size="sm"
            icon={UserPlus}
            loading={busy}
            onPress={() => handleAdd(user)}
            accessibilityLabel={`Přidat ${user.name} do přátel`}
          />
        );
    }
  };

  /** Načítání / chyba / prázdno pro seznamy přátel a žádostí (task 0026). */
  const listsFailed = lists.error != null && lists.data === undefined;

  return (
    <View className="flex-1 bg-[#FCFBF8] p-4">
      <View className="flex-row items-center mb-6">
        <View className={`flex-1 flex-row items-center bg-gray-100 p-3 rounded-2xl ${isSearching ? 'mr-2' : ''}`}>
          <Search size={20} color="#888" className="mr-2" />
          <TextInput
            className="flex-1 text-base text-gray-800"
            placeholder="Vyhledat uživatele..."
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Vyhledat uživatele"
            style={{ paddingVertical: 0 }}
          />
          {isSearching && (
            <Pressable
              onPress={() => setQuery("")}
              accessibilityRole="button"
              accessibilityLabel="Vymazat hledání"
              hitSlop={8}
            >
              <X size={18} color="#888" />
            </Pressable>
          )}
        </View>
        {/* While searching the inline card is hidden; the code stays one tap away. */}
        <Reveal visible={isSearching}>
          <Pressable
            onPress={() => setQrVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Můj QR kód"
            className="p-3 bg-gray-100 rounded-2xl active:opacity-80"
          >
            <QrCode size={20} color="#888" />
          </Pressable>
        </Reveal>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Můj QR kód */}
        <Reveal visible={!isSearching}>
          <View ref={qrTarget} className="bg-white rounded-3xl p-5 mb-8 items-center">
            <Text className="text-gray-500 text-sm font-medium mb-4">
              Ukaž kamarádovi, ať si tě naskenuje
            </Text>
            <MyQrContent
              code={myCode}
              size={180}
              regenerating={regenerating}
              onCopy={handleCopyMyCode}
              onShare={handleShareMyCode}
              onRegenerate={handleRegenerateMyCode}
            />
          </View>
        </Reveal>

        {/* Hledání výsledků */}
        {isSearching && (
          <View className="mb-8">
            <View className="flex-row items-center mb-4">
              <Text className="text-gray-400 text-xs font-bold tracking-widest">VÝSLEDKY HLEDÁNÍ</Text>
              {trimmed.length >= MIN_QUERY && searchBusy && (
                <ActivityIndicator size="small" color="#999" className="ml-2" />
              )}
            </View>
            {trimmed.length < MIN_QUERY ? (
              <Text className="text-gray-400 text-sm mt-1">Napiš aspoň {MIN_QUERY} znaky jména nebo přezdívky.</Text>
            ) : search.error && !searchBusy ? (
              <Pressable onPress={search.reload} accessibilityRole="button" className="bg-red-50 rounded-xl px-3 py-2">
                <Text className="text-red-500 text-sm">Hledání se nezdařilo. Zkusit znovu</Text>
              </Pressable>
            ) : results.length > 0 ? (
              results.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  onPress={() => setProfileId(user.id)}
                  right={renderSearchAction(user)}
                />
              ))
            ) : searchBusy ? null : (
              <Text className="text-gray-400 text-sm mt-1">Nikoho takového jsme nenašli.</Text>
            )}
          </View>
        )}

        {/* Žádosti o přátelství */}
        {pendingRequests.length > 0 && (
          <View className="mb-8">
            <Text className="text-gray-400 text-xs font-bold tracking-widest mb-4">ŽÁDOSTI O PŘÁTELSTVÍ</Text>
            {pendingRequests.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                onPress={() => setProfileId(user.id)}
                right={
                  <View className="flex-row items-center">
                    <Pressable
                      onPress={() => handleReject(user)}
                      accessibilityRole="button"
                      accessibilityLabel={`Odmítnout žádost od ${user.name}`}
                      className="p-2 bg-gray-100 rounded-full mr-2"
                    >
                      <X size={18} color="#666" />
                    </Pressable>
                    <Pressable
                      onPress={() => handleAccept(user)}
                      accessibilityRole="button"
                      accessibilityLabel={`Přijmout žádost od ${user.name}`}
                      className="p-2 bg-[#EE6C4D] rounded-full"
                    >
                      <Check size={18} color="#fff" />
                    </Pressable>
                  </View>
                }
              />
            ))}
          </View>
        )}

        {/* Odeslané žádosti */}
        {outgoingRequests.length > 0 && (
          <View className="mb-8">
            <Text className="text-gray-400 text-xs font-bold tracking-widest mb-4">ODESLANÉ ŽÁDOSTI</Text>
            {outgoingRequests.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                onPress={() => setProfileId(user.id)}
                right={
                  <Button
                    label="Zrušit"
                    size="sm"
                    variant="secondary"
                    loading={busyIds.has(user.id)}
                    onPress={() => handleCancel(user)}
                    accessibilityLabel={`Zrušit žádost pro ${user.name}`}
                  />
                }
              />
            ))}
          </View>
        )}

        {/* Moji přátelé */}
        <View className="mb-8 mt-2">
          <Text className="text-gray-400 text-xs font-bold tracking-widest mb-4">MOJI PŘÁTELÉ</Text>
          {lists.error && lists.data !== undefined && (
            <Pressable onPress={lists.reload} accessibilityRole="button" className="bg-red-50 rounded-xl px-3 py-2 mb-3">
              <Text className="text-red-500 text-xs">
                Nepodařilo se načíst — zobrazuji poslední známý stav. Zkusit znovu.
              </Text>
            </Pressable>
          )}
          {lists.showSpinner ? (
            <ActivityIndicator size="small" color="#000" className="mt-2" />
          ) : listsFailed ? (
            <Pressable onPress={lists.reload} accessibilityRole="button" className="bg-red-50 rounded-xl px-3 py-2">
              <Text className="text-red-500 text-sm">Přátele se nepodařilo načíst. Zkusit znovu</Text>
            </Pressable>
          ) : lists.data === undefined ? null : myFriends.length > 0 ? (
            myFriends.map((friend) => (
              <UserRow
                key={friend.id}
                user={friend}
                onPress={() => setProfileId(friend.id)}
                right={
                  confirmRemoveId === friend.id ? (
                    <View className="flex-row items-center">
                      <Button
                        label="Zpět"
                        size="sm"
                        variant="secondary"
                        disabled={busyIds.has(friend.id)}
                        onPress={() => setConfirmRemoveId(null)}
                        className="mr-2"
                      />
                      <Button
                        label="Odebrat"
                        size="sm"
                        variant="destructive"
                        loading={busyIds.has(friend.id)}
                        onPress={() => handleRemove(friend)}
                        accessibilityLabel={`Opravdu odebrat ${friend.name} z přátel`}
                      />
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => setConfirmRemoveId(friend.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Odebrat ${friend.name} z přátel`}
                      className="p-2 bg-red-50 rounded-full"
                    >
                      <UserMinus size={16} color="#ef4444" />
                    </Pressable>
                  )
                }
              />
            ))
          ) : (
            <Text className="text-gray-400 text-sm mt-1">Zatím nemáš žádné přátele.</Text>
          )}
        </View>

      </ScrollView>

      <BottomSheet visible={qrVisible} onClose={() => setQrVisible(false)}>
        <View className="items-center">
          <Text className="text-gray-400 text-sm font-medium mb-6">
            Naskenováním tě ostatní přidají do přátel
          </Text>
          <MyQrContent
            code={myCode}
            size={220}
            regenerating={regenerating}
            onCopy={handleCopyMyCode}
            onShare={handleShareMyCode}
            onRegenerate={handleRegenerateMyCode}
          />
        </View>
      </BottomSheet>

      <ProfileSheet
        userId={profileId}
        onClose={() => {
          setProfileId(null);
          // Ze sheetu mohl přidat, přijmout nebo odebrat - srovnat seznamy.
          lists.reload();
          search.reload();
        }}
      />

      <TourOverlay screen="search" />
    </View>
  );
}
