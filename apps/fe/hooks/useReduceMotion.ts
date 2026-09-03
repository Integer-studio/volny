import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Mirrors the OS "reduce motion" setting (react-native-web maps this to
 * `prefers-reduced-motion`, so it works identically on volny.intstudio.cz).
 * Consumers should skip spring overshoot and directional slides when this is
 * true, keeping only a short crossfade - motion-sensitive users still see
 * the state change, just without the part that can bother them.
 */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) setReduceMotion(value);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  return reduceMotion;
}
