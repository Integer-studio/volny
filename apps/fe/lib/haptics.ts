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

/**
 * Jemné cvaknutí při přeskoku prstence na další čtvrthodinu. Volá se z
 * gesta, ne z výsledku - vazba na tah je to jediné, co dává smysl cítit.
 * `selectionAsync` je přesně ta "ozubená" varianta, kterou iOS používá pro
 * kolečkové pickery; na webu je to no-op.
 */
export function tickFeedback(): void {
  Haptics.selectionAsync().catch(() => {});
}

/** Výraznější cvaknutí, když prstenec zaklapne na preset. */
export function snapFeedback(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}
