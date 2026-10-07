import React, { useEffect, useRef, useState } from "react";
import {
  NativeScrollEvent,
  Platform,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import BottomFade from "./BottomFade";
import { haptic } from "../lib/haptics";

/**
 * RNW `snapToInterval` nepřekládá (kontejner zůstane `scroll-snap-type:
 * none`), takže na webu se přichycení zapíná přímo CSS. Typy RN tyhle
 * vlastnosti neznají, RNW je ale do stylu propustí.
 */
const WEB_SNAP_CONTAINER =
  Platform.OS === "web" ? ({ scrollSnapType: "y mandatory" } as object) : undefined;
const WEB_SNAP_ITEM =
  Platform.OS === "web" ? ({ scrollSnapAlign: "center" } as object) : undefined;

/** Výška jedné položky - zároveň krok přichycení. */
const ITEM_H = 40;
/** Kolik položek je vidět; lichý počet, aby vybraná stála uprostřed. */
const VISIBLE = 3;
const PAD = ((VISIBLE - 1) / 2) * ITEM_H;
const FADE_H = 32;

type Props = {
  /** Popisky položek ("00".."23"). */
  items: string[];
  index: number;
  onChange: (index: number) => void;
  /** Pro čtečky: "Hodina", "Minuta". */
  accessibilityLabel: string;
};

/**
 * Otočné kolečko pro jednu složku času. Vlastní, na `ScrollView` se
 * `snapToInterval`, místo nativního pickeru: ten by byl další nativní
 * závislost a na webu by se choval jinak. Na webu přichycení dělá CSS
 * scroll-snap (`WEB_SNAP_CONTAINER`), takže kolečko jede kolečkem myši i
 * tahem stejně jako na mobilu - a jednotlivé položky jdou navíc i rovnou
 * kliknout.
 *
 * Hodnota se hlásí průběžně při rolování (ne až po dojezdu): web žádný
 * `onMomentumScrollEnd` nemá, a průběžná hodnota se hodí i k hmatové
 * odezvě na každém kroku.
 */
export default function TimeWheel({
  items,
  index,
  onChange,
  accessibilityLabel,
}: Props) {
  const ref = useRef<ScrollView>(null);
  // Poslední index, který kolečko samo nahlásilo - podle něj se pozná, že
  // změna `index` přišla zvenku a je potřeba na ni odrolovat.
  const reported = useRef(index);
  const [shown, setShown] = useState(index);
  // Cíl rolování, které spustil kód, ne uživatel. Dokud na něj kolečko
  // nedojede, jsou scroll eventy jen průjezd (nebo opožděný event z
  // předchozí pozice) a nesmí se hlásit jako uživatelova volba.
  const programmatic = useRef<number | null>(null);
  const offsetY = useRef(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }, []);

  const scrollTo = (i: number, animated: boolean) => {
    // Když už tam kolečko stojí, žádný scroll event nepřijde a příznak by
    // zůstal viset - spolkl by pak první skutečné rolování.
    programmatic.current = Math.abs(offsetY.current - i * ITEM_H) < 1 ? null : i;
    ref.current?.scrollTo({ y: i * ITEM_H, animated });
    // Pojistka pro případ, že uživatel animaci přeruší dřív, než dojede.
    setTimeout(() => {
      if (programmatic.current === i) programmatic.current = null;
    }, 600);
  };

  useEffect(() => {
    if (index === reported.current) return;
    reported.current = index;
    setShown(index);
    scrollTo(index, true);
  }, [index]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offsetY.current = e.nativeEvent.contentOffset.y;
    // CSS snap občas dojede pár pixelů vedle (zvlášť po rychlém sledu
    // otočení kolečkem myši) - po utichnutí se srovná na celou položku.
    if (Platform.OS === "web") {
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => {
        const y = offsetY.current;
        if (Math.abs(y - Math.round(y / ITEM_H) * ITEM_H) >= 1) {
          scrollTo(Math.round(y / ITEM_H), true);
        }
      }, 150);
    }
    const i = Math.max(
      0,
      Math.min(items.length - 1, Math.round(e.nativeEvent.contentOffset.y / ITEM_H)),
    );
    if (programmatic.current !== null) {
      if (i === programmatic.current) programmatic.current = null;
      return;
    }
    if (i === reported.current) return;
    reported.current = i;
    setShown(i);
    haptic("tickMinor");
    onChange(i);
  };

  const step = (delta: number) => {
    const i = Math.max(0, Math.min(items.length - 1, shown + delta));
    if (i === shown) return;
    scrollTo(i, true);
  };

  return (
    <View
      style={{ height: ITEM_H * VISIBLE, width: 72 }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: items[shown] }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) =>
        step(e.nativeEvent.actionName === "increment" ? 1 : -1)
      }
    >
      {/* Pás vybrané hodnoty leží pod čísly, ne přes ně. */}
      <View
        pointerEvents="none"
        className="absolute left-0 right-0 rounded-xl bg-[#EE6C4D]/10"
        style={{ top: PAD, height: ITEM_H }}
      />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        snapToInterval={ITEM_H}
        style={WEB_SNAP_CONTAINER}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingVertical: PAD }}
        onLayout={() => scrollTo(reported.current, false)}
      >
        {items.map((label, i) => {
          const distance = Math.abs(i - shown);
          return (
            <Pressable
              key={label}
              onPress={() => {
                // Klepnutí je volba uživatele - nahlásí se hned, rolování
                // ho jen doprovodí.
                reported.current = i;
                setShown(i);
                haptic("tickMinor");
                onChange(i);
                scrollTo(i, true);
              }}
              style={[{ height: ITEM_H }, WEB_SNAP_ITEM]}
              className="items-center justify-center"
              // Celé kolečko je pro čtečky jeden ovladač, ne 24 tlačítek.
              accessible={false}
              importantForAccessibility="no"
            >
              <Text
                className={
                  distance === 0
                    ? "text-[#EE6C4D] text-3xl font-bold"
                    : "text-gray-400 text-2xl font-medium"
                }
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <BottomFade visible height={FADE_H} />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: FADE_H,
          transform: [{ scaleY: -1 }],
        }}
      >
        <BottomFade visible height={FADE_H} />
      </View>
    </View>
  );
}
