import React from "react";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

/** Výška odstínu. Dost na to, aby byl vidět, ale ne aby schoval celý řádek. */
const HEIGHT = 28;
const BG = "#FCFBF8";

type Props = {
  /** Kreslit jen když se opravdu dá rolovat a ještě zbývá kam - jinak by
   * odstín sliboval obsah, který tam není. */
  visible: boolean;
  height?: number;
  color?: string;
};

/**
 * Odstín do barvy pozadí u dolní hrany rolovací oblasti: říká, že obsah
 * pokračuje dál. Scrollbar tuhle roli nesplní - na webu je v appce skrytý
 * a na mobilu se objeví teprve při dotyku.
 *
 * Gradient se kreslí přes `react-native-svg`, protože `expo-linear-gradient`
 * v projektu není a kvůli jednomu přechodu ho nemá smysl přidávat.
 */
export default function BottomFade({
  visible,
  height = HEIGHT,
  color = BG,
}: Props) {
  if (!visible) return null;
  return (
    <Svg
      width="100%"
      height={height}
      style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0} />
          <Stop offset="1" stopColor={color} stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height={height} fill="url(#bottomFade)" />
    </Svg>
  );
}
