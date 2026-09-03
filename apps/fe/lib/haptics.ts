import * as Haptics from "expo-haptics";

/**
 * Fire-and-forget tap feedback for the main free/not-free button. Called
 * from onPressIn (the gesture itself), never from a network response - the
 * status toggle is fire-and-forget too (see app/index.tsx's applyStatus), so
 * tying haptics to the request would feel disconnected from the tap that
 * caused it. expo-haptics is a no-op on web, so no platform check is needed
 * here; catch is only for the (rare) native rejection when the OS denies it.
 */
export function tapFeedback(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
