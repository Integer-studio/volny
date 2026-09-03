import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, Pressable } from "react-native";
import { tapFeedback } from "../lib/haptics";
import { useReduceMotion } from "../hooks/useReduceMotion";

type Props = {
  isFree: boolean;
  onPress: () => void;
  /** Shared with StatusHeadline so the circle and the status text crossfade
   * in lockstep instead of drifting apart. */
  fade: Animated.Value;
};

/**
 * The big circular free/not-free toggle. Isolated from app/index.tsx so its
 * animation state doesn't spread through an already-large screen file.
 *
 * backgroundColor isn't animatable on the native driver, so color is never
 * animated directly - instead a gray base sits under an orange+image layer
 * whose opacity crossfades via `fade`. Everything here (opacity, transform)
 * stays on the native driver.
 */
export default function FreeButton({ isFree, onPress, fade }: Props) {
  // Spring "pop" on a real state change - dip then overshoot then settle.
  const stateScale = useRef(new Animated.Value(1)).current;
  // Independent press squish, so it can run concurrently with a state pop
  // (e.g. a tap that lands while the previous pop is still settling).
  const pressScale = useRef(new Animated.Value(1)).current;
  const combinedScale = useRef(
    Animated.multiply(stateScale, pressScale),
  ).current;
  const reduceMotion = useReduceMotion();

  const isFirst = useRef(true);
  const prevIsFree = useRef(isFree);

  useEffect(() => {
    // Skip the pop on mount/hydration (e.g. me.activeFreeTime arriving after
    // boot) - only an actual toggle should animate, otherwise the circle
    // would visibly pop on every page load.
    if (isFirst.current) {
      isFirst.current = false;
      prevIsFree.current = isFree;
      return;
    }
    if (prevIsFree.current === isFree) return;
    prevIsFree.current = isFree;

    if (reduceMotion) {
      Animated.timing(fade, {
        toValue: isFree ? 1 : 0,
        duration: 120,
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.parallel([
      Animated.sequence([
        Animated.timing(stateScale, {
          toValue: 0.92,
          duration: 110,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(stateScale, {
          toValue: 1,
          stiffness: 170,
          damping: 11,
          mass: 0.9,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(fade, {
        toValue: isFree ? 1 : 0,
        duration: 260,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [isFree]);

  const handlePressIn = () => {
    tapFeedback();
    if (reduceMotion) return;
    Animated.spring(pressScale, {
      toValue: 0.94,
      stiffness: 400,
      damping: 30,
      mass: 0.6,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (reduceMotion) return;
    Animated.spring(pressScale, {
      toValue: 1,
      stiffness: 300,
      damping: 18,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      // A padded white ring around the circle, on an opaque bg (both iOS
      // shadow and Android elevation need one on the shadow-casting view
      // itself) - reads as a distinct pressable object instead of a flat
      // color patch, without adding a text label inside it.
      className="p-2 rounded-full bg-white shadow-xl shadow-[#EE6C4D]/40"
      style={{ elevation: 12, transform: [{ scale: combinedScale }] }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        className="w-64 h-64 rounded-full justify-center items-center overflow-hidden bg-gray-100"
      >
        <Animated.View
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            opacity: fade,
            backgroundColor: "#EE6C4D",
          }}
        >
          <Image
            source={require("../assets/images/volny.png")}
            style={{ position: "absolute", width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}
