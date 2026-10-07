import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Tone = 'success' | 'error';
/** A single follow-up the user can take from the toast, e.g. "Vrátit" after a delete. */
export type ToastAction = { label: string; onPress: () => void };
type ToastState = { message: string; tone: Tone; action?: ToastAction } | null;

type ToastValue = {
  /** durationMs: null makes the toast sticky (no auto-hide) - call hide() to dismiss it. */
  show: (message: string, tone?: Tone, durationMs?: number | null, action?: ToastAction) => void;
  /**
   * onlyIfMessage: if given, only actually dismisses when the toast
   * currently shown still has that exact message - guards against a sticky
   * notice's own cleanup clobbering a real result toast the caller already
   * displayed in the meantime (e.g. useSlowActionNotice's cold-start notice
   * vs. an error toast fired right as the action settles).
   */
  hide: (onlyIfMessage?: string) => void;
};

const ToastContext = createContext<ToastValue | null>(null);

type HostValue = {
  toast: ToastState;
  anim: Animated.Value;
  hide: () => void;
  register: (id: number, base: boolean) => () => void;
  topHost: number | null;
};

const HostContext = createContext<HostValue | null>(null);
let nextHostId = 0;

// Alert.alert is a no-op on react-native-web (verified), so this is the only
// error/success surface that works on every platform this app ships to.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const toastRef = useRef<ToastState>(null);
  toastRef.current = toast;
  const anim = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback((onlyIfMessage?: string) => {
    if (onlyIfMessage !== undefined && toastRef.current?.message !== onlyIfMessage) return;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToast(null));
  }, [anim]);

  const show = useCallback((message: string, tone: Tone = 'success', durationMs: number | null = 3000, action?: ToastAction) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setToast({ message, tone, action });
    // iOS VoiceOver nezná live regiony (accessibilityLiveRegion je jen
    // Android, aria-live jen web) - tam se oznámení musí poslat ručně.
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message);
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    if (durationMs !== null) {
      hideTimer.current = setTimeout(() => {
        Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToast(null));
      }, durationMs);
    }
  }, [anim]);

  // Hostitelé toastu jako zásobník: kreslí ho jen ten naposledy připojený.
  // RN Modal (BottomSheet) leží nad vším ostatním, takže host v kořeni by
  // byl pod otevřeným sheetem neviditelný - sheet proto má vlastního hosta.
  const hosts = useRef<number[]>([]);
  const [topHost, setTopHost] = useState<number | null>(null);
  const register = useCallback((id: number, base: boolean) => {
    // Kořenový host jde vždy na dno - jeho effect běží až po effectech
    // obsahu, takže by jinak přebil sheet otevřený hned při prvním renderu.
    hosts.current = base ? [id, ...hosts.current] : [...hosts.current, id];
    setTopHost(hosts.current[hosts.current.length - 1]);
    return () => {
      hosts.current = hosts.current.filter(h => h !== id);
      setTopHost(hosts.current[hosts.current.length - 1] ?? null);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ show, hide }}>
      <HostContext.Provider value={{ toast, anim, hide, register, topHost }}>
        {children}
        <ToastHost base />
      </HostContext.Provider>
    </ToastContext.Provider>
  );
}

/**
 * Místo, kde se toast vykreslí. Jeden je v ToastProvideru, další patří
 * dovnitř každého RN Modalu (viz BottomSheet), aby toast nebyl schovaný
 * pod ním.
 */
export function ToastHost({ base = false }: { base?: boolean }) {
  const ctx = useContext(HostContext);
  if (!ctx) throw new Error('ToastHost must be used within ToastProvider');
  const { toast, anim, hide, register, topHost } = ctx;
  const [id] = useState(() => nextHostId++);
  const insets = useSafeAreaInsets();

  useEffect(() => register(id, base), [register, id, base]);

  if (!toast || topHost !== id) return null;
  const isError = toast.tone === 'error';

  return (
    <Animated.View
      // Only a toast with an action takes touches - a plain one must
      // never block the screen underneath it.
      pointerEvents={toast.action ? 'box-none' : 'none'}
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: Math.max(32, insets.bottom + 16),
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      }}
    >
      <Animated.View
        className={isError ? 'bg-red-500' : 'bg-gray-900'}
        style={{ borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16 }}
        // Čtečka obrazovky toast přečte sama: Android přes live region,
        // web přes role/aria-live. iOS řeší announceForAccessibility v show().
        accessibilityLiveRegion={isError ? 'assertive' : 'polite'}
        role={isError ? 'alert' : 'status'}
        aria-live={isError ? 'assertive' : 'polite'}
      >
        {toast.action ? (
          <View className="flex-row items-center justify-between">
            <Text className="text-white font-medium flex-1 mr-3">{toast.message}</Text>
            <Pressable
              onPress={() => {
                toast.action?.onPress();
                hide();
              }}
              accessibilityRole="button"
              hitSlop={12}
            >
              <Text className="text-[#EE6C4D] font-bold">{toast.action.label}</Text>
            </Pressable>
          </View>
        ) : (
          <Text className="text-white text-center font-medium">{toast.message}</Text>
        )}
      </Animated.View>
    </Animated.View>
  );
}

export function useToast(): ToastValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
