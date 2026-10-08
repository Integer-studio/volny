import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
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
/** Kolik řádků má být na každou stranu od středu v zásobě, aby ani prudký
 * švih nedojel na konec dřív, než se kolečko vrátí doprostřed. */
const ROWS_EACH_SIDE = 40;
/** Po kolika ms bez scroll eventu se kolečko považuje za zastavené. */
const SETTLE_MS = 150;

const mod = (a: number, n: number) => ((a % n) + n) % n;

const ORANGE = "#EE6C4D";
const GRAY = "#9CA3AF";
/** Neprostřední řádky jsou menší - dřív `text-2xl` vedle `text-3xl`. */
const SIDE_SCALE = 0.8;

type Props = {
  /** Popisky položek ("00".."23"). */
  items: string[];
  index: number;
  onChange: (index: number) => void;
  /** Pro čtečky: "Hodina", "Minuta". */
  accessibilityLabel: string;
};

/**
 * Otočné kolečko pro jednu složku času, dokola - po 23 přijde 00. Vlastní,
 * na `ScrollView` se `snapToInterval`, místo nativního pickeru: ten by byl
 * další nativní závislost a na webu by se choval jinak. Na webu přichycení
 * dělá CSS scroll-snap (`WEB_SNAP_CONTAINER`), takže kolečko jede kolečkem
 * myši i tahem stejně jako na mobilu - a jednotlivé položky jdou navíc
 * i rovnou kliknout.
 *
 * Dokola to jede tak, že položky jsou v obsahu několikrát za sebou a po
 * každém zastavení kolečko bez animace přeskočí na tutéž hodnotu v
 * prostřední kopii. Pozice se proto drží jako **řádek** v celém obsahu
 * (`row`), hodnota je `row mod items.length`.
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
  const n = items.length;
  // Lichý počet kopií, aby jedna ležela přesně uprostřed.
  const copies = 2 * Math.ceil(ROWS_EACH_SIDE / n) + 1;
  const middle = (copies - 1) / 2;
  const centerRow = (value: number) => middle * n + value;

  const ref = useRef<ScrollView>(null);
  // Poslední hodnota, kterou kolečko samo nahlásilo - podle ní se pozná,
  // že změna `index` přišla zvenku a je potřeba na ni odrolovat.
  const reported = useRef(index);
  // Řádek uprostřed okna; z něj se kreslí zvýraznění.
  const [row, setRow] = useState(() => centerRow(index));
  const rowRef = useRef(row);
  // Cílový řádek rolování, které spustil kód, ne uživatel. Dokud na něj
  // kolečko nedojede, jsou scroll eventy jen průjezd (nebo opožděný event
  // z předchozí pozice) a nesmí se hlásit jako uživatelova volba.
  const programmatic = useRef<number | null>(null);
  const offsetY = useRef(centerRow(index) * ITEM_H);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Zvýraznění prostředního řádku (barva, velikost) jede přímo z pozice
  // rolování přes interpolaci, ne přes stav: překreslit při každém kroku
  // stovku řádků nestíhalo a oranžová za kolečkem viditelně zaostávala.
  const scrollY = useRef(new Animated.Value(centerRow(index) * ITEM_H)).current;
  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }, []);

  const showRow = (r: number) => {
    rowRef.current = r;
    setRow(r);
  };

  const scrollToRow = (r: number, animated: boolean) => {
    // Když už tam kolečko stojí, žádný scroll event nepřijde a příznak by
    // zůstal viset - spolkl by pak první skutečné rolování.
    programmatic.current = Math.abs(offsetY.current - r * ITEM_H) < 1 ? null : r;
    ref.current?.scrollTo({ y: r * ITEM_H, animated });
    // Pojistka pro případ, že uživatel animaci přeruší dřív, než dojede.
    setTimeout(() => {
      if (programmatic.current === r) programmatic.current = null;
    }, 600);
  };

  /** Nejbližší řádek s danou hodnotou - kolečko se otočí kratší cestou. */
  const nearestRow = (value: number) => {
    let delta = mod(value - mod(rowRef.current, n), n);
    if (delta > n / 2) delta -= n;
    return rowRef.current + delta;
  };

  useEffect(() => {
    if (index === reported.current) return;
    reported.current = index;
    const r = nearestRow(index);
    showRow(r);
    scrollToRow(r, true);
  }, [index]);

  /** Po zastavení: dorovnat na celý řádek (web) a vrátit se doprostřed. */
  const settle = () => {
    const r = Math.round(offsetY.current / ITEM_H);
    const target = centerRow(mod(r, n));
    if (target !== r) {
      // Stejná hodnota, jen v prostřední kopii - beze změny pro uživatele.
      showRow(target);
      scrollToRow(target, false);
    } else if (Math.abs(offsetY.current - r * ITEM_H) >= 1) {
      // CSS snap občas dojede pár pixelů vedle (zvlášť po rychlém sledu
      // otočení kolečkem myši).
      scrollToRow(r, true);
    }
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offsetY.current = e.nativeEvent.contentOffset.y;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(settle, SETTLE_MS);

    const r = Math.max(
      0,
      Math.min(n * copies - 1, Math.round(offsetY.current / ITEM_H)),
    );
    if (programmatic.current !== null) {
      if (r === programmatic.current) programmatic.current = null;
      return;
    }
    if (r !== rowRef.current) showRow(r);
    const value = mod(r, n);
    if (value === reported.current) return;
    reported.current = value;
    haptic("tickMinor");
    onChange(value);
  };

  const pick = (r: number) => {
    // Klepnutí je volba uživatele - nahlásí se hned, rolování ho jen
    // doprovodí.
    const value = mod(r, n);
    showRow(r);
    if (value !== reported.current) {
      reported.current = value;
      haptic("tickMinor");
      onChange(value);
    }
    scrollToRow(r, true);
  };

  // Řádky se renderují jednou (pro dané položky) - jejich vzhled řídí
  // `scrollY`, takže je změna `row` nemusí překreslovat. Klepnutí proto jde
  // přes ref, aby memo nedrželo starou `pick`.
  const pickRef = useRef(pick);
  pickRef.current = pick;
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: false,
        listener: (e: NativeSyntheticEvent<NativeScrollEvent>) =>
          handleScrollRef.current(e),
      }),
    [scrollY],
  );
  const handleScrollRef = useRef(handleScroll);
  handleScrollRef.current = handleScroll;

  const rowEls = useMemo(
    () =>
      Array.from({ length: n * copies }, (_, r) => {
        const input = [(r - 1) * ITEM_H, r * ITEM_H, (r + 1) * ITEM_H];
        const color = scrollY.interpolate({
          inputRange: input,
          outputRange: [GRAY, ORANGE, GRAY],
          extrapolate: "clamp",
        });
        const scale = scrollY.interpolate({
          inputRange: input,
          outputRange: [SIDE_SCALE, 1, SIDE_SCALE],
          extrapolate: "clamp",
        });
        return (
          <Pressable
            key={r}
            onPress={() => pickRef.current(r)}
            style={[{ height: ITEM_H }, WEB_SNAP_ITEM]}
            className="items-center justify-center"
            // Celé kolečko je pro čtečky jeden ovladač, ne stovka tlačítek.
            accessible={false}
            importantForAccessibility="no"
          >
            {/* Styl přímo, ne přes `className` - NativeWind animované
                komponenty sám neobaluje. Rozměry odpovídají `text-3xl`. */}
            <Animated.Text
              style={{
                fontSize: 30,
                lineHeight: 36,
                fontWeight: "700",
                color,
                transform: [{ scale }],
                fontVariant: ["tabular-nums"],
              }}
            >
              {items[mod(r, n)]}
            </Animated.Text>
          </Pressable>
        );
      }),
    [items, n, copies, scrollY],
  );

  return (
    <View
      style={{ height: ITEM_H * VISIBLE, width: 72 }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: items[mod(row, n)] }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) =>
        pick(rowRef.current + (e.nativeEvent.actionName === "increment" ? 1 : -1))
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
        onLayout={() => scrollToRow(rowRef.current, false)}
      >
        {rowEls}
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
