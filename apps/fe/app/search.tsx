import React, { useState, useEffect } from "react";
import { View, TextInput, Pressable, ScrollView, ActivityIndicator, Text } from "react-native";
import Search from "lucide-react-native/icons/search";
import Check from "lucide-react-native/icons/check";
import X from "lucide-react-native/icons/x";
import Trash2 from "lucide-react-native/icons/trash-2";
import UserPlus from "lucide-react-native/icons/user-plus";
import QrCode from "lucide-react-native/icons/qr-code";
import Copy from "lucide-react-native/icons/copy";
import Share2 from "lucide-react-native/icons/share-2";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import QRCodeSvg from "react-native-qrcode-svg";
import { api, UserSummary } from "../lib/api";
import UserRow from "../components/UserRow";
import BottomSheet from "../components/BottomSheet";
import { useAsyncData } from "../hooks/useAsyncData";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { useToast } from "../components/Toast";
import { useAuth } from "../lib/auth-context";
import { errorMessage } from "../lib/errors";
import { buildFriendInviteUrl, shareFriendInvite, copyFriendInviteLink } from "../lib/friend-invite-link";

export default function SearchScreen() {
  const { show } = useToast();
  const { me } = useAuth();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [addedDict, setAddedDict] = useState<Record<string, boolean>>({});
  const [hiddenFriendIds, setHiddenFriendIds] = useState<Set<string>>(new Set());
  const [hiddenRequestIds, setHiddenRequestIds] = useState<Set<string>>(new Set());

  const [qrVisible, setQrVisible] = useState(false);
  const [myCode, setMyCode] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const myInvite = useAsyncData(() => api.getMyFriendInviteCode(), []);

  useEffect(() => {
    if (myInvite.data) setMyCode(myInvite.data);
  }, [myInvite.data]);

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
      show('Nový kód vygenerován. Starý přestal fungovat.');
    } catch {
      show('Nepodařilo se vygenerovat nový kód.', 'error');
    } finally {
      setRegenerating(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  // pending flips true the moment debouncedQuery changes (fetch start), so
  // the 600ms no-spinner grace period in useAsyncData is measured from the
  // actual request, not from the keystroke - composing it with the 400ms
  // debounce above would otherwise hide the spinner for up to 1000ms.
  const search = useAsyncData<UserSummary[]>(
    () => (debouncedQuery ? api.searchUsers(debouncedQuery) : Promise.resolve([])),
    [debouncedQuery]
  );
  const results = search.data ?? [];

  const friendsAndPending = useAsyncData<[UserSummary[], UserSummary[]]>(
    () => Promise.all([api.getAllFriends(), api.getPendingRequests()]),
    [],
    { cacheKey: 'friendsAndPending' }
  );
  useAutoRefresh(friendsAndPending.reload, { intervalMs: 30_000 });
  const loadingFriends = friendsAndPending.data === undefined && friendsAndPending.showSpinner;
  const myFriends = (friendsAndPending.data?.[0] ?? []).filter(f => !hiddenFriendIds.has(f.id));
  const pendingRequests = (friendsAndPending.data?.[1] ?? []).filter(u => !hiddenRequestIds.has(u.id));

  const handleAdd = async (userId: string) => {
    setAddedDict(prev => ({ ...prev, [userId]: true }));
    try {
      await api.addFriend(userId);
      friendsAndPending.reload();
    } catch {
      setAddedDict(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleRemove = async (userId: string) => {
    setHiddenFriendIds(prev => new Set(prev).add(userId));
    try {
      await api.removeFriend(userId);
    } catch {
      setHiddenFriendIds(prev => { const next = new Set(prev); next.delete(userId); return next; });
    }
  };

  const handleAccept = async (userId: string) => {
    setHiddenRequestIds(prev => new Set(prev).add(userId));
    try {
      await api.acceptRequest(userId);
      friendsAndPending.reload();
    } catch (e) {
      setHiddenRequestIds(prev => { const next = new Set(prev); next.delete(userId); return next; });
      show(errorMessage(e, 'Přijetí žádosti se nezdařilo.'), 'error');
    }
  };

  const handleReject = async (userId: string) => {
    setHiddenRequestIds(prev => new Set(prev).add(userId));
    try {
      await api.rejectRequest(userId);
    } catch (e) {
      setHiddenRequestIds(prev => { const next = new Set(prev); next.delete(userId); return next; });
      show(errorMessage(e, 'Odmítnutí žádosti se nezdařilo.'), 'error');
    }
  };

  return (
    <View className="flex-1 bg-[#FCFBF8] p-4">
      <View className="flex-row items-center mb-6">
        <View className="flex-1 flex-row items-center bg-gray-100 p-3 rounded-2xl mr-2">
          <Search size={20} color="#888" className="mr-2" />
          <TextInput
            className="flex-1 text-base text-gray-800"
            placeholder="Vyhledat uživatele..."
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            style={{ paddingVertical: 0 }}
          />
        </View>
        <Pressable
          onPress={() => setQrVisible(true)}
          className="p-3 bg-gray-100 rounded-2xl active:opacity-80"
        >
          <QrCode size={20} color="#888" />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Hledání výsledků */}
        {query.trim().length > 0 && (
          <View className="mb-8">
            <Text className="text-gray-400 text-xs font-bold tracking-widest mb-4">VÝSLEDKY HLEDÁNÍ</Text>
            {search.showSpinner && search.data === undefined ? (
              <ActivityIndicator size="small" color="#000" className="mt-2" />
            ) : results.length > 0 ? (
              results.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  right={
                    <Pressable
                      onPress={() => !addedDict[user.id] && handleAdd(user.id)}
                      className={`p-2 rounded-full ${addedDict[user.id] ? 'bg-gray-100' : 'bg-[#EE6C4D]'}`}
                    >
                      {addedDict[user.id] ? (
                        <Check size={18} color="#666" />
                      ) : (
                        <UserPlus size={18} color="#fff" />
                      )}
                    </Pressable>
                  }
                />
              ))
            ) : (
              <Text className="text-gray-400 text-sm mt-1">Nenalezeni žádní uživatelé.</Text>
            )}
          </View>
        )}

        {/* Žádosti o přátelství */}
        {!loadingFriends && pendingRequests.length > 0 && (
          <View className="mb-8">
            <Text className="text-gray-400 text-xs font-bold tracking-widest mb-4">ŽÁDOSTI O PŘÁTELSTVÍ</Text>
            {pendingRequests.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                right={
                  <View className="flex-row items-center">
                    <Pressable
                      onPress={() => handleReject(user.id)}
                      className="p-2 bg-gray-100 rounded-full mr-2"
                    >
                      <X size={18} color="#666" />
                    </Pressable>
                    <Pressable
                      onPress={() => handleAccept(user.id)}
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

        {/* Moji přátelé */}
        {loadingFriends ? (
          <ActivityIndicator size="small" color="#000" className="mt-2" />
        ) : (
          <View className="mb-8 mt-2">
            <Text className="text-gray-400 text-xs font-bold tracking-widest mb-4">MOJI PŘÁTELÉ</Text>
            {myFriends.length > 0 ? (
              myFriends.map((friend) => (
                <UserRow
                  key={friend.id}
                  user={friend}
                  right={
                    <Pressable
                      onPress={() => handleRemove(friend.id)}
                      className="p-2 bg-red-50 rounded-full"
                    >
                      <Trash2 size={16} color="#ef4444" />
                    </Pressable>
                  }
                />
              ))
            ) : (
              <Text className="text-gray-400 text-sm mt-1">Zatím nemáš žádné přátele.</Text>
            )}
          </View>
        )}

      </ScrollView>

      <BottomSheet visible={qrVisible} onClose={() => setQrVisible(false)}>
        <View className="items-center">
          <Text className="text-gray-400 text-sm font-medium mb-6">
            Naskenováním tě ostatní přidají do přátel
          </Text>
          {myCode ? (
            <>
              <View className="bg-white p-4 rounded-2xl">
                <QRCodeSvg value={buildFriendInviteUrl(myCode)} size={220} />
              </View>
              <Text className="text-gray-900 text-lg font-semibold tracking-wide mt-6">
                {myCode}
              </Text>
              <Text className="text-gray-400 text-xs mt-1">Platí 24 hodin</Text>
              <View className="flex-row mt-6 w-full">
                <Pressable onPress={handleCopyMyCode} className="flex-1 flex-row items-center justify-center bg-gray-100 py-3 rounded-xl mr-2 active:opacity-80">
                  <Copy size={16} color="#333" />
                  <Text className="text-gray-800 font-medium ml-2">Kopírovat</Text>
                </Pressable>
                <Pressable onPress={handleShareMyCode} className="flex-1 flex-row items-center justify-center bg-gray-100 py-3 rounded-xl mx-1 active:opacity-80">
                  <Share2 size={16} color="#333" />
                  <Text className="text-gray-800 font-medium ml-2">Sdílet</Text>
                </Pressable>
                <Pressable onPress={handleRegenerateMyCode} disabled={regenerating} className="flex-row items-center justify-center bg-gray-100 py-3 px-3 rounded-xl ml-2 active:opacity-80">
                  {regenerating ? <ActivityIndicator color="#333" /> : <RefreshCw size={16} color="#333" />}
                </Pressable>
              </View>
            </>
          ) : (
            <ActivityIndicator size="large" color="#EE6C4D" />
          )}
        </View>
      </BottomSheet>
    </View>
  );
}
