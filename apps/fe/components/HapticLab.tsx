import React from "react";
import { Platform, Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * DOČASNÉ (jen `__DEV__`): seznam všech efektů, ze kterých se skládá mapování
 * v `lib/haptics.ts`. Relativní síla `AndroidHaptics` není nikde
 * dokumentovaná, ladí ji výrobce a mezi zařízeními se liší - jediný způsob,
 * jak ji zjistit, je porovnat je na skutečném telefonu vedle sebe.
 *
 * Až bude tabulka v `lib/haptics.ts` doladěná, tahle komponenta i s importem
 * v `app/settings.tsx` jde pryč.
 */

/** Efekty, které `expo-haptics` umí na každém API levelu (viz HapticsRecord.kt). */
const SAFE: Haptics.AndroidHaptics[] = [
  Haptics.AndroidHaptics.Clock_Tick,
  Haptics.AndroidHaptics.Context_Click,
  Haptics.AndroidHaptics.Keyboard_Tap,
  Haptics.AndroidHaptics.Long_Press,
  Haptics.AndroidHaptics.Virtual_Key,
];

const ANDROID_ORDER: Haptics.AndroidHaptics[] = [
  Haptics.AndroidHaptics.Segment_Frequent_Tick,
  Haptics.AndroidHaptics.Segment_Tick,
  Haptics.AndroidHaptics.Clock_Tick,
  Haptics.AndroidHaptics.Text_Handle_Move,
  Haptics.AndroidHaptics.Keyboard_Tap,
  Haptics.AndroidHaptics.Keyboard_Press,
  Haptics.AndroidHaptics.Keyboard_Release,
  Haptics.AndroidHaptics.Virtual_Key,
  Haptics.AndroidHaptics.Virtual_Key_Release,
  Haptics.AndroidHaptics.Context_Click,
  Haptics.AndroidHaptics.Drag_Start,
  Haptics.AndroidHaptics.Gesture_Start,
  Haptics.AndroidHaptics.Gesture_End,
  Haptics.AndroidHaptics.Toggle_On,
  Haptics.AndroidHaptics.Toggle_Off,
  Haptics.AndroidHaptics.Confirm,
  Haptics.AndroidHaptics.Reject,
  Haptics.AndroidHaptics.Long_Press,
];

const IOS_ORDER: { label: string; run: () => Promise<void> }[] = [
  { label: "selection", run: () => Haptics.selectionAsync() },
  ...(["Soft", "Light", "Rigid", "Medium", "Heavy"] as const).map((k) => ({
    label: `impact ${k}`,
    run: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle[k]),
  })),
  ...(["Success", "Warning", "Error"] as const).map((k) => ({
    label: `notification ${k}`,
    run: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType[k]),
  })),
];

export default function HapticLab() {
  if (!__DEV__ || Platform.OS === "web") return null;

  const api = typeof Platform.Version === "number" ? Platform.Version : 0;
  const rows =
    Platform.OS === "android"
      ? ANDROID_ORDER.map((t) => ({
          label: t,
          // Pod API 34 (u některých 30) efekt neexistuje a expo-haptics
          // vyhodí - tady se to ukáže jako "chybí", ať to nevypadá jako
          // slabá vibrace.
          note: SAFE.includes(t) ? "vždy" : `≥30/34 (API ${api})`,
          run: () => Haptics.performAndroidHapticsAsync(t),
        }))
      : IOS_ORDER.map((r) => ({ label: r.label, note: "", run: r.run }));

  return (
    <View className="mb-10">
      <Text className="text-gray-400 text-xs font-bold tracking-widest mb-1">
        HAPTIKA (DEV)
      </Text>
      <Text className="text-gray-400 text-xs mb-3">
        Seřaď si je podle citu a podle toho se vyplní tabulka v
        lib/haptics.ts. Zkontroluj, že máš hmatovou odezvu v systému zapnutou
        a na maximu.
      </Text>
      {rows.map((r) => (
        <Pressable
          key={r.label}
          onPress={() => {
            r.run().catch(() => {});
          }}
          className="flex-row items-center justify-between py-3 border-b border-gray-100 active:bg-gray-50"
        >
          <Text className="text-gray-900 text-sm">{r.label}</Text>
          <Text className="text-gray-400 text-xs">{r.note}</Text>
        </Pressable>
      ))}
    </View>
  );
}
