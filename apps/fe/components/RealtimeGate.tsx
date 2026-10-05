import { useEffect } from 'react';
import { AppState } from 'react-native';
import { onRealtime, startRealtime, stopRealtime } from '../lib/realtime';
import { useToast } from './Toast';

/**
 * Mounted once, only while the user is authenticated: keeps the realtime hub
 * connected while the app is in the foreground and shows a toast for new
 * incoming friend requests. Renders nothing.
 *
 * Disconnects in the background (on web: hidden tab, via RN-web's AppState)
 * - the OS kills native sockets there anyway, and an idle open tab
 * shouldn't keep the scale-to-zero backend awake.
 */
export default function RealtimeGate() {
  const { show } = useToast();

  useEffect(() => {
    if (AppState.currentState !== 'background') startRealtime();
    const sub = AppState.addEventListener('change', next => {
      if (next === 'active') startRealtime();
      else if (next === 'background') stopRealtime();
    });
    return () => {
      sub.remove();
      stopRealtime();
    };
  }, []);

  useEffect(
    () => onRealtime('FriendRequestReceived', ({ fromName }) => {
      show(`${fromName || 'Někdo'} ti poslal(a) žádost o přátelství`);
    }),
    [show],
  );

  return null;
}
