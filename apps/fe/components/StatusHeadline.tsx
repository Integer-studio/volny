import React, { useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

type Props = {
  /** Shared with FreeButton so text and circle crossfade in lockstep. */
  fade: Animated.Value;
  freeUntil: Date | null;
  formatTime: (date: Date) => string;
};

/**
 * Crossfades "Nemám volno" / "Jsem Volný" (+ time) instead of swapping them
 * instantly. Height is fixed by construction, not a magic number: an
 * invisible sizer holds both lines of the taller (free) variant, and the two
 * real variants are absolutely positioned on top of it - this replaces the
 * old text-transparent "placeholder" trick (see git history on
 * app/index.tsx) with something that doesn't depend on guessing a pixel
 * height, so it still holds under a system font-size bump.
 */
export default function StatusHeadline({ fade, freeUntil, formatTime }: Props) {
  // Keep the last known non-null freeUntil so the outgoing "Jsem Volný"
  // variant doesn't lose its time mid-crossfade (freeUntil goes to null in
  // the same tick isFree flips false).
  const lastFreeUntil = useRef<Date | null>(freeUntil);
  if (freeUntil) lastFreeUntil.current = freeUntil;
  const shownFreeUntil = freeUntil ?? lastFreeUntil.current;

  const notFreeOpacity = fade.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const notFreeY = fade.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -6],
  });
  const freeY = fade.interpolate({
    inputRange: [0, 1],
    outputRange: [6, 0],
  });

  return (
    <View className="items-center mb-6 w-full">
      <View style={{ opacity: 0 }} pointerEvents="none">
        <Text className="text-2xl font-bold">Jsem Volný</Text>
        <Text className="text-sm mt-1">do 00:00</Text>
      </View>

      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            justifyContent: "center",
            alignItems: "center",
            opacity: notFreeOpacity,
            transform: [{ translateY: notFreeY }],
          },
        ]}
      >
        <Text className="text-2xl font-bold text-gray-900" numberOfLines={1}>
          Nemám volno
        </Text>
      </Animated.View>

      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            justifyContent: "center",
            alignItems: "center",
            opacity: fade,
            transform: [{ translateY: freeY }],
          },
        ]}
      >
        <Text className="text-2xl font-bold text-[#EE6C4D]" numberOfLines={1}>
          Jsem Volný
        </Text>
        {shownFreeUntil && (
          <Text className="text-sm mt-1 text-[#EE6C4D]/70">
            do {formatTime(shownFreeUntil)}
          </Text>
        )}
      </Animated.View>
    </View>
  );
}
