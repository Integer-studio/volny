import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, Text } from 'react-native';

type Tone = 'success' | 'error';
type ToastState = { message: string; tone: Tone } | null;

type ToastValue = {
  /** durationMs: null makes the toast sticky (no auto-hide) - call hide() to dismiss it. */
  show: (message: string, tone?: Tone, durationMs?: number | null) => void;
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

  const show = useCallback((message: string, tone: Tone = 'success', durationMs: number | null = 3000) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setToast({ message, tone });
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    if (durationMs !== null) {
      hideTimer.current = setTimeout(() => {
        Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToast(null));
      }, durationMs);
    }
  }, [anim]);

  return (
    <ToastContext.Provider value={{ show, hide }}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 32,
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
          }}
        >
          <Animated.View
            className={toast.tone === 'error' ? 'bg-red-500' : 'bg-gray-900'}
            style={{ borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16 }}
          >
            <Text className="text-white text-center font-medium">{toast.message}</Text>
          </Animated.View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
