import { Platform } from 'react-native';
import { getExpoPushTokenAsync, getFcmWebTokenAsync, isPushSupported, isWebPushSupported } from './push';
import * as Storage from './storage';
import { parseServerDate } from './date';
import { API_URL } from './config';

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

export type UserSummary = { id: string; username: string; name: string };

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
export type GroupDetail = GroupSummary & { inviteCode: string; members: GroupMember[]; alreadyMember: boolean };
export type GroupPreview = { name: string; memberCount: number; ownerName?: string; alreadyMember: boolean };
export type FriendInvitePreview = { name: string; username: string; alreadyFriend: boolean };

type GroupSummaryDto = { groupID: number; name: string; memberCount: number; isOwner: boolean };
type GroupMemberDto = { userID: number; username: string; name: string; joinedAt: string; isOwner: boolean };
type GroupDetailDto = {
  groupID: number; name: string; memberCount?: number; isOwner?: boolean;
  inviteCode: string; members: GroupMemberDto[]; alreadyMember: boolean;
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

async function getToken() {
  if (currentToken) return currentToken;
  try {
    currentToken = await Storage.getItem('userToken');
    return currentToken;
  } catch (e) {
    return null;
  }
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

function isRetryableStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504 || status === 408;
}

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

async function performRequest(endpoint: string, options: RequestOptions) {
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
    // 401 must fire exactly once - it's checked outside the retry loop's
    // eligibility (401 is never a retryable status), so this can't run twice.
    if (response.status === 401 && !options.allowUnauthorized) {
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
      const isTransient =
        (e instanceof ApiError && isRetryableStatus(e.status)) ||
        (e instanceof Error && (e.name === 'AbortError' || e.name === 'TypeError'));
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
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    currentToken = res.token;
    try {
      await Storage.setItem('userToken', res.token);
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

  async register(username: string, password: string, name: string): Promise<void> {
    await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, name }),
    });
    await this.login(username, password);
  },

  async logout(): Promise<void> {
    currentToken = null;
    currentUserId = null;
    lastRegisteredPushToken = null;
    await Storage.deleteItem('userToken');
    await Storage.deleteItem('userId');
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
      const myTimes: FreeTimeDto[] = await request('/freetimes');
      const now = new Date();
      const active = myTimes.find((ft) => {
        const start = new Date(ft.startTime);
        const end = new Date(ft.endTime);
        return now >= start && now < end;
      });
      if (active) {
        await request(`/freetimes/${active.freeTimeID}`, { method: 'DELETE', idempotent: true });
      }
    }
  },

  async searchUsers(query: string): Promise<UserSummary[]> {
    if (!query.trim()) return [];
    const users: UserSummaryDto[] = await request(`/users?q=${encodeURIComponent(query)}`);
    return users.map(toUserSummary);
  },

  async getPendingRequests(): Promise<UserSummary[]> {
    const reqs: FriendRequestDto[] = await request('/friendsuggestions/incoming');
    return reqs.map(r => toUserSummary(r.user));
  },

  async addFriend(userId: string): Promise<void> {
    await request('/friendsuggestions', { method: 'POST', body: userId });
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

  async joinGroup(code: string): Promise<GroupDetail> {
    // Safe to mark idempotent: the backend reports alreadyMember rather than
    // erroring on a repeat join, so a retried request after an ambiguous
    // timeout can't create a duplicate membership.
    const detail: GroupDetailDto = await request('/groups/join', { method: 'POST', body: JSON.stringify({ code }), idempotent: true });
    return toGroupDetail(detail, currentUserId);
  },
};
