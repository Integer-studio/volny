import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { useReduceMotion } from '../hooks/useReduceMotion';

type Props = {
  /** Remount-keyed content (e.g. by a data id) fades in fresh each time; a
   * stable key just fades in once on first mount. */
  children: React.ReactNode;
  className?: string;
};

const DURATION_MS = 180;

/**
 * Simple mount-time fade-in, for content that just finished loading (data
 * arriving, or an error/empty state settling in per useAsyncData's `settled`)
 * so it doesn't just pop in - a lighter cousin of Reveal.tsx, which handles
 * mutually-exclusive visible/hidden pairs instead of a one-shot appearance.
 */
export default function FadeIn({ children, className }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: reduceMotion ? 80 : DURATION_MS,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View className={className} style={{ opacity }}>
      {children}
    </Animated.View>
  );
}
