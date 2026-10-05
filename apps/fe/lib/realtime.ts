import {
  HttpTransportType,
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import { getToken, tryRefreshAccessToken } from './api';
import { HUB_URL } from './config';
import { setRealtimeConnected } from './realtimeStatus';

/**
 * Realtime refetch signals from the BE hub (/hubs/realtime, task 0001).
 * Events carry no data - screens just re-call their existing endpoints -
 * except FriendRequestReceived, which carries the requester's name for the toast.
 * `Resync` is synthetic: emitted after every (re)connect, because any events
 * sent while we were disconnected are lost.
 */
export type RealtimeEvents = {
  FreeChanged: undefined;
  FriendsChanged: undefined;
  FriendRequestReceived: { fromUserId: number; fromName: string };
  Resync: undefined;
};
export type RealtimeEventName = keyof RealtimeEvents;
type Handler<E extends RealtimeEventName> = (payload: RealtimeEvents[E]) => void;

const SERVER_EVENTS = ['FreeChanged', 'FriendsChanged', 'FriendRequestReceived'] as const;
const RETRY_DELAYS_MS = [0, 2_000, 5_000, 10_000];
const MAX_RETRY_DELAY_MS = 30_000;
// Refresh the JWT this long before it expires, so a (re)connect never
// goes out with a token the server is about to reject.
const TOKEN_EXPIRY_MARGIN_S = 60;

const handlers = new Map<RealtimeEventName, Set<Handler<RealtimeEventName>>>();

export function onRealtime<E extends RealtimeEventName>(event: E, handler: Handler<E>): () => void {
  let set = handlers.get(event);
  if (!set) handlers.set(event, (set = new Set()));
  set.add(handler as Handler<RealtimeEventName>);
  return () => { set.delete(handler as Handler<RealtimeEventName>); };
}

function emit<E extends RealtimeEventName>(event: E, payload: RealtimeEvents[E]): void {
  handlers.get(event)?.forEach(h => {
    try {
      h(payload);
    } catch (e) {
      console.warn(`[realtime] ${event} handler failed:`, e);
    }
  });
}

function jwtExpiresSoon(token: string): boolean {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(part)) as { exp?: number };
    return typeof exp === 'number' && exp - TOKEN_EXPIRY_MARGIN_S <= Date.now() / 1000;
  } catch {
    return false;
  }
}

async function accessToken(): Promise<string> {
  const token = await getToken();
  if (token && !jwtExpiresSoon(token)) return token;
  return (await tryRefreshAccessToken()) ?? token ?? '';
}

let connection: HubConnection | null = null;
let wanted = false;
let startTimer: ReturnType<typeof setTimeout> | null = null;
let startAttempt = 0;

function retryDelay(attempt: number): number {
  return RETRY_DELAYS_MS[attempt] ?? MAX_RETRY_DELAY_MS;
}

function build(): HubConnection {
  const conn = new HubConnectionBuilder()
    // WebSockets only: no negotiate request (so no CORS/credentials
    // involvement) and no EventSource/long-polling fallbacks, which RN lacks.
    .withUrl(HUB_URL, {
      transport: HttpTransportType.WebSockets,
      skipNegotiation: true,
      accessTokenFactory: accessToken,
    })
    // Never give up while wanted; the default policy stops after 4 tries.
    .withAutomaticReconnect({ nextRetryDelayInMilliseconds: ctx => retryDelay(ctx.previousRetryCount) })
    .configureLogging(__DEV__ ? LogLevel.Warning : LogLevel.None)
    .build();

  for (const event of SERVER_EVENTS) {
    conn.on(event, (payload?: unknown) => emit(event, payload as never));
  }
  conn.onreconnecting(() => setRealtimeConnected(false));
  conn.onreconnected(() => {
    setRealtimeConnected(true);
    emit('Resync', undefined);
  });
  conn.onclose(() => {
    setRealtimeConnected(false);
    if (wanted) scheduleStart();
  });
  return conn;
}

function scheduleStart(): void {
  if (startTimer) return;
  startTimer = setTimeout(() => {
    startTimer = null;
    void startNow();
  }, retryDelay(startAttempt++));
}

async function startNow(): Promise<void> {
  if (!wanted) return;
  if (!connection) connection = build();
  if (connection.state !== HubConnectionState.Disconnected) return;
  try {
    await connection.start();
    startAttempt = 0;
    if (!wanted) {
      await connection.stop();
      return;
    }
    setRealtimeConnected(true);
    emit('Resync', undefined);
  } catch {
    // start() isn't covered by withAutomaticReconnect - retry it ourselves
    // (e.g. the container is cold-starting from scale-to-zero).
    if (wanted) scheduleStart();
  }
}

/** Idempotent: connect (or keep connecting) until stopRealtime(). */
export function startRealtime(): void {
  wanted = true;
  startAttempt = 0;
  void startNow();
}

export function stopRealtime(): void {
  wanted = false;
  if (startTimer) {
    clearTimeout(startTimer);
    startTimer = null;
  }
  setRealtimeConnected(false);
  const conn = connection;
  connection = null;
  void conn?.stop();
}
