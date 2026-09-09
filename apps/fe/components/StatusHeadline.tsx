import React from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

type Props = {
  /** Sdílené s FreeButton, aby text a kruh crossfadovaly zároveň. */
  fade: Animated.Value;
};

/**
 * Crossfade "Nemám volno" / "Jsem volný". Nese **jen stav**, žádný čas -
 * ten patří do jediného slotu pod tlačítkem, aby se nestěhoval podle stavu
 * (a aby se během tažení neměnil na dvou místech zároveň).
 *
 * Výška je dána konstrukcí, ne magickým číslem: neviditelný sizer drží jeden
 * řádek a obě varianty leží absolutně na něm. Drží to i při zvětšeném
 * systémovém fontu.
 */
export default function StatusHeadline({ fade }: Props) {
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
    <View className="items-center mb-3 w-full">
      <View style={{ opacity: 0 }} pointerEvents="none">
        <Text className="text-2xl font-bold">Nemám volno</Text>
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
          Jsem volný
        </Text>
      </Animated.View>
    </View>
  );
}
