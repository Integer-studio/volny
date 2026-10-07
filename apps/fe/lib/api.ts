import { Platform } from 'react-native';
import { getExpoPushTokenAsync, getFcmWebTokenAsync, isPushSupported, isWebPushSupported } from './push';
import * as Storage from './storage';
import { parseServerDate } from './date';
import { API_URL } from './config';
import type { PresetDef } from '../components/TimeRing/presets';

function toCamelCase(key: string): string {
  // ASP.NET ModelState keys are PascalCase property names ("Password") or a
  // JSON path for a deserialization failure ("$.startTime") - normalize both
  // to the camelCase names the FE actually uses in field-error lookups.
  const last = key.includes('.') ? key.slice(key.lastIndexOf('.') + 1) : key;
  return last.length > 0 ? last.charAt(0).toLowerCase() + last.slice(1) : last;
}

export class ApiError extends Error {
  /** Field-level messages from a ValidationProblemDetails 400, keys normalized to camelCase. */
  readonly fieldErrors?: Record<string, string[]>;
  /** Business-rule message from a hand-written `{ message: "..." }` error response. */
  readonly serverMessage?: string;

  constructor(public status: number, public body: string) {
    super(`API Error ${status}: ${body}`);

    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === 'object') {
        if (parsed.errors && typeof parsed.errors === 'object') {
          const fieldErrors: Record<string, string[]> = {};
          for (const [key, value] of Object.entries(parsed.errors as Record<string, unknown>)) {
            if (Array.isArray(value)) fieldErrors[toCamelCase(key)] = value.map(String);
          }
          this.fieldErrors = fieldErrors;
        }
        if (typeof parsed.message === 'string') {
          this.serverMessage = parsed.message;
        }
      }
    } catch {
      // Not JSON (e.g. a bare 500 with an empty body) - fieldErrors/serverMessage stay undefined.
    }
  }
}

/** Registrace prošla, ale navazující přihlášení ne - účet už existuje. */
export class RegisteredButLoginFailedError extends Error {
  constructor(public cause: unknown) {
    super('Registered, but the follow-up login failed');
    this.name = 'RegisteredButLoginFailedError';
  }
}

/**
 * Selhání, za kterým je nedostupný nebo probouzející se server (síť,
 * timeout, 502/503/504/408), ne chyba na straně uživatele.
 */
export function isServerUnavailable(e: unknown): boolean {
  if (e instanceof ApiError) return [408, 502, 503, 504].includes(e.status);
  return e instanceof Error && (e.name === 'AbortError' || e.name === 'TimeoutError' || e.name === 'TypeError');
}

export type UserSummary = { id: string; username: string; name: string };
/** Vztah k uživateli z hledání: přítel, žádost odeslaná mnou, žádost od něj. */
export type UserRelation = 'none' | 'friend' | 'outgoing' | 'incoming';
export type UserSearchResult = UserSummary & { relation: UserRelation };
/** Výsledek "+": nová žádost, nebo rovnou přátelství (on už žádost poslal mně). */
export type AddFriendResult = 'requested' | 'accepted';

type UserSummaryDto = { userID: number; username: string; name: string };
function toUserSummary(d: UserSummaryDto): UserSummary {
  return { id: d.userID.toString(), username: d.username, name: d.name?.trim() || d.username };
}

export type ActiveFreeTime = { freeSince: Date; freeUntil: Date };

export type UserDto = {
  userID: number;
  username: string;
  name: string;
  /** Only ever populated for the caller's own account - see BE UserDto's doc comment. */
  phone?: string | null;
  instagram?: string | null;
  createdAt?: string;
  activeFreeTime?: { freeSince: string; freeUntil: string } | null;
};

export type FreeTimeDto = {
  freeTimeID: number;
  userID: number;
  startTime: string;
  endTime: string;
};

type PresetDto = { presetID: number; name: string; icon: string; minute: number };
export type PresetInput = { name: string; icon: string; minute: number };

function toPresetDef(p: PresetDto): PresetDef {
  return { id: String(p.presetID), name: p.name, icon: p.icon, minute: p.minute };
}

export type ConnectionSource = { kind: 'friend' | 'group'; groupId?: string; groupName?: string };

export type FreeEntry = {
  user: UserSummary;
  freeSince: Date;
  freeUntil: Date;
  via: ConnectionSource[];
};

type FriendDto = { user: UserSummaryDto; establishedAt: string };
type FriendRequestDto = { user: UserSummaryDto; suggestedAt: string };
type FreeConnectionDto = {
  user: UserSummaryDto;
  freeSince: string;
  freeUntil: string;
  via: { kind: string; groupID?: number; groupName?: string }[];
};

export type SharedGroup = { id: string; name: string };
export type UserProfile = {
  id: string;
  username: string;
  name: string;
  isFriend: boolean;
  hasOutgoingRequest: boolean;
  hasIncomingRequest: boolean;
  sharedGroups: SharedGroup[];
  /** Both null unless the caller is connected to this user (friend or group co-member) - see BE UsersController.GetProfile. */
  phone: string | null;
  instagram: string | null;
};

type UserProfileDto = {
  userID: number;
  username: string;
  name: string;
  isFriend: boolean;
  hasOutgoingRequest: boolean;
  hasIncomingRequest: boolean;
  sharedGroups: { groupID: number; name: string }[];
  phone: string | null;
  instagram: string | null;
};

export type GroupSummary = { id: string; name: string; memberCount: number; isOwner: boolean };
export type GroupMember = { id: string; username: string; name: string; joinedAt: Date; isOwner: boolean };
export type GroupDetail = GroupSummary & { inviteCode: string; members: GroupMember[]; alreadyMember: boolean; sharesWithGroup: boolean };
export type GroupPreview = { name: string; memberCount: number; ownerName?: string; alreadyMember: boolean };
export type FriendInvitePreview = { name: string; username: string; alreadyFriend: boolean };

type GroupSummaryDto = { groupID: number; name: string; memberCount: number; isOwner: boolean };
type GroupMemberDto = { userID: number; username: string; name: string; joinedAt: string; isOwner: boolean };
type GroupDetailDto = {
  groupID: number; name: string; memberCount?: number; isOwner?: boolean;
  inviteCode: string; members: GroupMemberDto[]; alreadyMember: boolean; sharesWithGroup: boolean;
};
type GroupInvitePreviewDto = { name: string; memberCount: number; ownerName?: string; alreadyMember: boolean };
type FriendInvitePreviewDto = { name: string; username: string; alreadyFriend: boolean };

function toGroupDetail(d: GroupDetailDto, currentUserId: number | null): GroupDetail {
  const owner = d.members.find(m => m.isOwner);
  return {
    id: d.groupID.toString(),
    name: d.name,
    memberCount: d.members.length,
    isOwner: owner?.userID === currentUserId,
    inviteCode: d.inviteCode,
    alreadyMember: d.alreadyMember,
    sharesWithGroup: d.sharesWithGroup,
    members: d.members.map(m => ({
      id: m.userID.toString(),
      username: m.username,
      name: m.name,
      joinedAt: parseServerDate(m.joinedAt),
      isOwner: m.isOwner,
    })),
  };
}

let currentToken: string | null = null;
let currentUserId: number | null = null;
let lastRegisteredPushToken: string | null = null;

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export async function getToken() {
  if (currentToken) return currentToken;
  try {
    currentToken = await Storage.getItem('userToken');
    return currentToken;
  } catch (e) {
    return null;
  }
}

// Deduped in-flight refresh so N concurrent 401s trigger exactly one
// POST /auth/refresh instead of one each.
let refreshInFlight: Promise<string | null> | null = null;

export async function tryRefreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const refreshToken = await Storage.getItem('refreshToken');
      if (!refreshToken) return null;

      const res = await performRequest('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
        anonymous: true,
        allowUnauthorized: true,
      });
      currentToken = res.token;
      try {
        await Storage.setItem('userToken', res.token);
      } catch (e) {
        console.warn('[auth] Failed to persist refreshed token:', e);
      }
      return res.token as string;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

type RequestOptions = RequestInit & {
  /** Don't fire the global 401 -> logout handler for this call (e.g. verifying a password). */
  allowUnauthorized?: boolean;
  /** Never send an Authorization header, even if a token exists (anonymous endpoints). */
  anonymous?: boolean;
  /**
   * Marks a non-GET request as safe to retry on a cold-start-style failure
   * (network error, 502/503/504). GET is always retried; a mutation must opt
   * in explicitly - POST /freetimes or POST /groups are NOT idempotent, and
   * retrying them after an ambiguous timeout would create a duplicate.
   */
  idempotent?: boolean;
  /** Skip the retry loop entirely - for callers that manage their own backoff (boot probe, warm-up ping). */
  noRetry?: boolean;
};

const RETRY_DELAYS_MS = [400, 1200, 3000];

function jitter(ms: number): number {
  return ms * (0.75 + Math.random() * 0.5); // +/-25%
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// AbortSignal.timeout is recent enough that it's worth guarding rather than
// assuming every RN/Hermes runtime this app ships to has it - a missing
// timeout signal just means no per-attempt abort, not a crash.
function timeoutSignal(ms: number): AbortSignal | undefined {
  try {
    return typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(ms) : undefined;
  } catch {
    return undefined;
  }
}

async function performRequest(endpoint: string, options: RequestOptions, isRefreshRetry = false) {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (!options.anonymous) {
    const token = await getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
    signal: timeoutSignal(25000),
  });

  if (!response.ok) {
    // 401 must fire the logout/refresh handling exactly once per call chain -
    // isRefreshRetry guarantees at most one silent refresh-and-retry attempt.
    if (response.status === 401 && !options.allowUnauthorized) {
      if (!isRefreshRetry) {
        const newToken = await tryRefreshAccessToken();
        if (newToken) return performRequest(endpoint, options, true);
      }
      await api.logout();
      onUnauthorized?.();
    }
    const errText = await response.text();
    throw new ApiError(response.status, errText);
  }

  if (response.status === 204) {
    return null;
  }
  return response.json();
}

/**
 * Retries a transient, cold-start-shaped failure (network error, timeout,
 * 502/503/504/408) for GET requests always, and for a mutation only when it
 * opted in via `idempotent: true`. Never retries 401/403/404/409/other 4xx,
 * and never retries 500 - a real server bug should surface immediately, not
 * be hidden behind three silent attempts.
 */
async function request(endpoint: string, options: RequestOptions = {}) {
  const method = (options.method ?? 'GET').toUpperCase();
  const canRetry = !options.noRetry && (method === 'GET' || options.idempotent === true);
  const maxAttempts = canRetry ? RETRY_DELAYS_MS.length + 1 : 1;

  for (let attempt = 0; ; attempt++) {
    try {
      return await performRequest(endpoint, options);
    } catch (e) {
      const isLastAttempt = attempt >= maxAttempts - 1;
      // AbortSignal.timeout() rejects with a TimeoutError, not AbortError.
      const isTransient = isServerUnavailable(e);
      if (isLastAttempt || !isTransient) throw e;
      await sleep(jitter(RETRY_DELAYS_MS[attempt]));
    }
  }
}

export const api = {
  /** Public accessor for cache namespacing (lib/cache.ts) - falls back to a stored id if the module-private one hasn't been set yet this session. */
  getCurrentUserId(): number | null {
    return currentUserId;
  },

  /**
   * Restores currentToken/currentUserId from storage before any request
   * fires, for optimistic auth entry (auth-context boots signed-in from a
   * cached `me` without waiting for getMe() to resolve first). Without this,
   * a group-detail fetch racing the background verify could read
   * currentUserId as null and toGroupDetail would report isOwner: false to
   * the actual owner.
   */
  hydrateSession({ token, userId }: { token: string; userId: number }): void {
    currentToken = token;
    currentUserId = userId;
  },

  async login(username: string, password: string): Promise<void> {
    // Retry je bezpečný: opakovaný login jen vydá další refresh token.
    // anonymous + allowUnauthorized: 401 tu znamená špatné heslo, ne
    // propadlou session - nesmí spustit refresh ani globální odhlášení.
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      anonymous: true,
      allowUnauthorized: true,
      idempotent: true,
    });
    currentToken = res.token;
    try {
      await Storage.setItem('userToken', res.token);
      await Storage.setItem('refreshToken', res.refreshToken);
    } catch (e) {
      console.warn('[auth] Failed to persist token to storage:', e);
    }

    const me = await this.getMe();
    currentUserId = me.userID;
    try {
      await Storage.setItem('userId', currentUserId.toString());
    } catch (e) {
      console.warn('[auth] Failed to persist userId to storage:', e);
    }
  },

  async register(username: string, password: string, name: string, extra?: { phone?: string; instagram?: string }): Promise<void> {
    // Bez retry: po nejednoznačném timeoutu by druhý pokus skončil 409 na
    // vlastním, právě vytvořeném účtu.
    await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, name, phone: extra?.phone, instagram: extra?.instagram }),
      anonymous: true,
    });
    try {
      await this.login(username, password);
    } catch (e) {
      throw new RegisteredButLoginFailedError(e);
    }
  },

  /** Jednorázový kód pro přenos přihlášení do aplikace na ploše iOS - viz lib/handoff.ts. */
  async createHandoff(): Promise<string> {
    const res = await request('/auth/handoff', { method: 'POST', noRetry: true });
    return res.code;
  },

  /**
   * Vymění handoff kód za vlastní pár tokenů a uloží je stejně jako login().
   * Neplatný/propadlý kód vyhodí ApiError 401 - volající pak nechá uživatele
   * přihlásit se normálně.
   */
  async redeemHandoff(code: string): Promise<void> {
    const res = await request('/auth/handoff/redeem', {
      method: 'POST',
      body: JSON.stringify({ code }),
      anonymous: true,
      allowUnauthorized: true,
      noRetry: true,
    });
    currentToken = res.token;
    await Storage.setItem('userToken', res.token);
    await Storage.setItem('refreshToken', res.refreshToken);
    const me = await this.getMe();
    currentUserId = me.userID;
    await Storage.setItem('userId', currentUserId.toString());
  },

  // Local-only half of logout(), also used after account deletion - the
  // server no longer knows the refresh token, so revoking it would just 401.
  async clearSession(): Promise<void> {
    currentToken = null;
    currentUserId = null;
    lastRegisteredPushToken = null;
    await Storage.deleteItem('userToken');
    await Storage.deleteItem('refreshToken');
    await Storage.deleteItem('userId');
  },

  async logout(): Promise<void> {
    const refreshToken = await Storage.getItem('refreshToken').catch(() => null);

    await this.clearSession();

    if (refreshToken) {
      // Best-effort server-side revocation - never blocks client-side logout.
      request('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
        anonymous: true,
        noRetry: true,
      }).catch(() => {});
    }
  },

  async getMe(): Promise<UserDto> {
    const me = await request('/users/me');
    currentUserId = me.userID;
    return me;
  },

  async updateProfile(input: { username?: string; name?: string; phone?: string; instagram?: string }): Promise<{ user: UserDto; token?: string }> {
    const res = await request('/users/me', { method: 'PUT', body: JSON.stringify(input), idempotent: true });
    if (res.token) {
      currentToken = res.token;
      try {
        await Storage.setItem('userToken', res.token);
      } catch (e) {
        console.warn('[auth] Failed to persist refreshed token:', e);
      }
    }
    return { user: res.user, token: res.token };
  },

  async changePassword(input: { currentPassword: string; newPassword: string }): Promise<void> {
    await request('/users/me/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: input.currentPassword, newPassword: input.newPassword }),
      allowUnauthorized: true,
    });
  },

  async deleteAccount(password: string): Promise<void> {
    await request('/users/me', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
      allowUnauthorized: true,
    });
  },

  async getUserProfile(userId: string): Promise<UserProfile> {
    const d: UserProfileDto = await request(`/users/${userId}/profile`);
    return {
      id: d.userID.toString(),
      username: d.username,
      name: d.name?.trim() || d.username,
      isFriend: d.isFriend,
      hasOutgoingRequest: d.hasOutgoingRequest,
      hasIncomingRequest: d.hasIncomingRequest,
      sharedGroups: d.sharedGroups.map(g => ({ id: g.groupID.toString(), name: g.name })),
      phone: d.phone,
      instagram: d.instagram,
    };
  },

  async getAllFriends(): Promise<UserSummary[]> {
    const friends: FriendDto[] = await request('/friends');
    return friends.map(f => toUserSummary(f.user));
  },

  async removeFriend(userId: string): Promise<void> {
    await request(`/friends/${userId}`, { method: 'DELETE', idempotent: true });
  },

  async getFreeNow(): Promise<FreeEntry[]> {
    const rows: FreeConnectionDto[] = await request('/connections/free');
    return rows.map(r => ({
      user: toUserSummary(r.user),
      freeSince: parseServerDate(r.freeSince),
      freeUntil: parseServerDate(r.freeUntil),
      via: r.via.map(v => ({
        kind: v.kind as 'friend' | 'group',
        groupId: v.groupID?.toString(),
        groupName: v.groupName,
      })),
    }));
  },

  /**
   * Aktivní záznam volna, tedy ten, do kterého padá `now`. Sdílené mezi
   * ukončením a prodloužením - `GET /users/me` u `activeFreeTime` nevrací id,
   * takže se musí dohledat ze seznamu.
   */
  async getActiveFreeTime(): Promise<FreeTimeDto | null> {
    const myTimes: FreeTimeDto[] = await request('/freetimes');
    const now = new Date();
    return (
      myTimes.find((ft) => {
        const start = new Date(ft.startTime);
        const end = new Date(ft.endTime);
        return now >= start && now < end;
      }) ?? null
    );
  },

  /**
   * Změní konec už běžícího volna. Jde přes `PUT /freetimes/{id}`, ne přes
   * `POST /freetimes` (což dělá `setMyStatus`): POST na backendu vždy zakládá
   * NOVÝ záznam, takže by vzniklo druhé překrývající se volno a přátelům by
   * podruhé odešla notifikace "má teď volno". `StartTime` se schválně
   * neposílá - backend si nechá původní, takže volno neztratí svůj začátek.
   *
   * Když už žádné volno neběží (mezitím vypršelo nebo ho ukončilo jiné
   * zařízení), založí se místo toho nové - jinak by se změna tiše zahodila.
   */
  async extendMyStatus(until: Date): Promise<void> {
    const active = await this.getActiveFreeTime();
    if (!active) {
      await this.setMyStatus(true, until);
      return;
    }
    await request(`/freetimes/${active.freeTimeID}`, {
      method: 'PUT',
      idempotent: true,
      body: JSON.stringify({ endTime: until.toISOString() }),
    });
  },

  async setMyStatus(isFree: boolean, until?: Date): Promise<void> {
    if (isFree && until) {
      const startTime = new Date().toISOString();
      const endTime = until.toISOString();
      await request('/freetimes', {
        method: 'POST',
        body: JSON.stringify({ startTime, endTime })
      });
    } else if (isFree) {
      await request('/freetimes/imfree', { method: 'POST' });
    } else {
      const active = await this.getActiveFreeTime();
      if (active) {
        await request(`/freetimes/${active.freeTimeID}`, { method: 'DELETE', idempotent: true });
      }
    }
  },

  // Presety (task 0009) - vždy jen vlastní, backend jiné nevydá.
  async getPresets(): Promise<PresetDef[]> {
    const rows: PresetDto[] = await request('/presets');
    return rows.map(toPresetDef);
  },

  async createPreset(input: PresetInput): Promise<PresetDef> {
    return toPresetDef(await request('/presets', { method: 'POST', body: JSON.stringify(input) }));
  },

  async updatePreset(id: string, input: PresetInput): Promise<PresetDef> {
    return toPresetDef(await request(`/presets/${id}`, { method: 'PUT', idempotent: true, body: JSON.stringify(input) }));
  },

  async deletePreset(id: string): Promise<void> {
    await request(`/presets/${id}`, { method: 'DELETE', idempotent: true });
  },

  async resetPresets(): Promise<PresetDef[]> {
    const rows: PresetDto[] = await request('/presets/reset', { method: 'POST' });
    return rows.map(toPresetDef);
  },

  async searchUsers(query: string): Promise<UserSearchResult[]> {
    if (!query.trim()) return [];
    const users: (UserSummaryDto & { relation: UserRelation })[] = await request(`/users?q=${encodeURIComponent(query)}`);
    return users.map(u => ({ ...toUserSummary(u), relation: u.relation }));
  },

  async getOutgoingRequests(): Promise<UserSummary[]> {
    const reqs: FriendRequestDto[] = await request('/friendsuggestions/outgoing');
    return reqs.map(r => toUserSummary(r.user));
  },

  /** Zruší moji odeslanou žádost. Už neexistující (404) bere jako hotovo. */
  async cancelRequest(userId: string): Promise<void> {
    const me = this.getCurrentUserId();
    try {
      await request(`/friendsuggestions?suggesterId=${me}&suggestedId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        idempotent: true,
      });
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 404)) throw e;
    }
  },

  async getPendingRequests(): Promise<UserSummary[]> {
    const reqs: FriendRequestDto[] = await request('/friendsuggestions/incoming');
    return reqs.map(r => toUserSummary(r.user));
  },

  /**
   * "+" u uživatele. Když on už žádost poslal mně, backend ji rovnou přijme
   * (`accepted`). 409 se bere jako úspěch - žádost už existuje, nebo už jsme
   * přátelé, a o to uživateli šlo.
   */
  async addFriend(userId: string): Promise<AddFriendResult> {
    try {
      const res = await request('/friendsuggestions', { method: 'POST', body: userId });
      return res?.accepted ? 'accepted' : 'requested';
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        return e.serverMessage === 'Already friends' ? 'accepted' : 'requested';
      }
      throw e;
    }
  },

  async getMyFriendInviteCode(): Promise<string> {
    const res = await request('/friends/invite/code');
    return res.code;
  },

  async regenerateFriendInviteCode(): Promise<string> {
    const res = await request('/friends/invite/regenerate', { method: 'POST' });
    return res.code;
  },

  async previewFriendInvite(code: string): Promise<FriendInvitePreview> {
    // Anonymous endpoint, but still sends the token when present (not
    // `anonymous: true`) so the backend can report alreadyFriend correctly
    // for a logged-in viewer - same rationale as previewInvite below.
    const preview: FriendInvitePreviewDto = await request(`/friends/invite/${encodeURIComponent(code)}`, {
      allowUnauthorized: true,
    });
    return preview;
  },

  async acceptFriendInvite(code: string): Promise<UserSummary> {
    // Safe to mark idempotent: the backend reports the existing friendship
    // rather than erroring on a repeat accept, so a retried request after an
    // ambiguous timeout can't create a duplicate.
    const friend: FriendDto = await request(`/friends/invite/${encodeURIComponent(code)}/accept`, {
      method: 'POST',
      idempotent: true,
    });
    return toUserSummary(friend.user);
  },

  async acceptRequest(suggesterId: string): Promise<void> {
    await request('/friendsuggestions/accept', { method: 'POST', body: suggesterId });
  },

  async rejectRequest(suggesterId: string): Promise<void> {
    await request('/friendsuggestions/reject', { method: 'POST', body: suggesterId });
  },

  /**
   * Idempotent: safe (and intended) to call on every app open, because push
   * tokens (Expo or FCM web) can rotate. The backend upserts on deviceToken
   * and derives the provider from the token's own format, so this can stay
   * the single entrypoint both PushGateNative and PushGateWeb call.
   * Returns the registered token, or null if push is unavailable/denied.
   */
  async registerPushToken(): Promise<string | null> {
    const token = isPushSupported
      ? await getExpoPushTokenAsync()
      : isWebPushSupported
        ? await getFcmWebTokenAsync()
        : null;
    if (!token) return null;

    try {
      await request('/devices', {
        method: 'POST',
        body: JSON.stringify({ deviceToken: token, platform: Platform.OS }),
        idempotent: true,
      });
      lastRegisteredPushToken = token;
      return token;
    } catch (e) {
      console.warn('[push] Failed to register device with backend:', e);
      return null;
    }
  },

  /**
   * Best-effort de-registration. Only usable while the JWT is still valid,
   * i.e. from an explicit logout — not from the 401 path.
   */
  async unregisterPushToken(): Promise<void> {
    if (!lastRegisteredPushToken) return;
    try {
      const devices: { deviceID: number; deviceToken: string }[] = await request('/devices');
      const mine = devices.find(d => d.deviceToken === lastRegisteredPushToken);
      if (mine) {
        await request(`/devices/${mine.deviceID}`, { method: 'DELETE', idempotent: true });
      }
    } catch (e) {
      console.warn('[push] Failed to unregister device:', e);
    } finally {
      lastRegisteredPushToken = null;
    }
  },

  async getGroups(): Promise<GroupSummary[]> {
    const groups: GroupSummaryDto[] = await request('/groups');
    return groups.map(g => ({ id: g.groupID.toString(), name: g.name, memberCount: g.memberCount, isOwner: g.isOwner }));
  },

  async getGroup(id: string): Promise<GroupDetail> {
    const detail: GroupDetailDto = await request(`/groups/${id}`);
    return toGroupDetail(detail, currentUserId);
  },

  async createGroup(name: string): Promise<GroupDetail> {
    const detail: GroupDetailDto = await request('/groups', { method: 'POST', body: JSON.stringify({ name }) });
    return toGroupDetail(detail, currentUserId);
  },

  async renameGroup(id: string, name: string): Promise<void> {
    await request(`/groups/${id}`, { method: 'PUT', body: JSON.stringify({ name }), idempotent: true });
  },

  async setGroupSharing(id: string, sharesWithGroup: boolean): Promise<void> {
    await request(`/groups/${id}/sharing`, { method: 'PUT', body: JSON.stringify({ sharesWithGroup }), idempotent: true });
  },

  async deleteGroup(id: string): Promise<void> {
    await request(`/groups/${id}`, { method: 'DELETE', idempotent: true });
  },

  async leaveGroup(id: string): Promise<void> {
    await request(`/groups/${id}/members/me`, { method: 'DELETE', idempotent: true });
  },

  async removeGroupMember(groupId: string, userId: string): Promise<void> {
    await request(`/groups/${groupId}/members/${userId}`, { method: 'DELETE', idempotent: true });
  },

  async regenerateInvite(id: string): Promise<string> {
    const res = await request(`/groups/${id}/invite/regenerate`, { method: 'POST' });
    return res.inviteCode;
  },

  async previewInvite(code: string): Promise<GroupPreview> {
    // Anonymous endpoint, but still sends the token when present (not
    // `anonymous: true`) so the backend can report alreadyMember correctly
    // for a logged-in viewer. allowUnauthorized guards against a stale
    // token triggering the global 401->logout handler on a page anyone,
    // logged in or not, is allowed to view.
    const preview: GroupInvitePreviewDto = await request(`/groups/invite/${encodeURIComponent(code)}`, {
      allowUnauthorized: true,
    });
    return preview;
  },

  async joinGroup(code: string, sharesWithGroup = true): Promise<GroupDetail> {
    // Safe to mark idempotent: the backend reports alreadyMember rather than
    // erroring on a repeat join, so a retried request after an ambiguous
    // timeout can't create a duplicate membership.
    const detail: GroupDetailDto = await request('/groups/join', { method: 'POST', body: JSON.stringify({ code, sharesWithGroup }), idempotent: true });
    return toGroupDetail(detail, currentUserId);
  },
};
