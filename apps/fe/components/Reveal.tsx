import React, { useEffect, useRef, useState } from "react";
import { Animated } from "react-native";
import { useReduceMotion } from "../hooks/useReduceMotion";

type Props = {
  visible: boolean;
  children: React.ReactNode;
  /** Delay before the entrance animation starts - lets a sibling's exit
   * animation finish (and unmount) first, so the two never overlap and
   * cause a visible height jump in what's rendered between them. */
  delayMs?: number;
  className?: string;
};

const ENTER_MS = 240;
const EXIT_MS = 160;

/**
 * Generalizes the mount-delay-unmount pattern components/Toast.tsx already
 * uses for its own fade: keep children mounted until the exit animation
 * finishes, so a `{visible && <X/>}` swap never hard-cuts. Used for the
 * mutually-exclusive quick-set row / free-list sections on the main screen,
 * which previously popped in/out instantly and shifted everything below them.
 */
export default function Reveal({
  visible,
  children,
  delayMs = 0,
  className,
}: Props) {
  const [rendered, setRendered] = useState(visible);
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(visible ? 0 : 10)).current;
  const reduceMotion = useReduceMotion();
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      // No animation on mount for whatever the initial visibility is -
      // only actual toggles should animate.
      isFirst.current = false;
      return;
    }

    if (visible) {
      setRendered(true);
      const run = () => {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: reduceMotion ? 120 : ENTER_MS,
            useNativeDriver: true,
          }),
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            stiffness: 220,
            damping: 22,
            mass: 0.8,
          }),
        ]).start();
      };
      if (delayMs > 0 && !reduceMotion) {
        const t = setTimeout(run, delayMs);
        return () => clearTimeout(t);
      }
      run();
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: reduceMotion ? 120 : EXIT_MS,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        setRendered(false);
        // Reset for the next entrance's slide-up - doing this only after
        // the exit fade completes (not synchronously here) means the
        // exiting content doesn't itself jump before it fades out.
        translateY.setValue(10);
      });
    }
  }, [visible]);

  if (!rendered) return null;

  return (
    <Animated.View
      className={className}
      style={{ opacity, transform: [{ translateY: reduceMotion ? 0 : translateY }] }}
    >
      {children}
    </Animated.View>
  );
}
