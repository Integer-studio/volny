import React from "react";
import { Pressable, View } from "react-native";
import { useReduceMotion } from "../../hooks/useReduceMotion";
import { normalizeDelta, polar } from "./scale";

/** Do téhle úhlové blízkosti handle marker začne uhýbat / mizet. */
const AVOID_DEG = 30;

type Props = {
  /** Úhel na dráze, na kterém marker stojí. */
  angle: number;
  /** Aktuální úhel handle - podle blízkosti se marker uhne nebo vytratí. */
  handleAngle: number;
  /** Střed prstence (shodné x i y). */
  center: number;
  /** Klidový poloměr markeru. */
  radius: number;
  /** Průměr markeru. */
  size: number;
  /**
   * Co dělat, když se handle přiblíží. `dodge` marker odsune radiálně ven
   * (presety, které stojí přímo na dráze a handle by je přejel), `fade` ho
   * vytratí, `none` ho nechá být (čísla hodin leží mimo dráhu, takže je
   * handle nemá čím překrýt - a schovávat právě to číslo, na které uživatel
   * míří, by bylo kontraproduktivní).
   */
  avoid: "dodge" | "fade" | "none";
  /** O kolik pixelů se marker odsune při `avoid: "dodge"`. */
  dodgePx?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  children: React.ReactNode;
};

/**
 * Cokoli, co stojí na prstenci na konkrétním úhlu a musí ustoupit handle -
 * ikonka presetu i číslo hodiny. Sdílené je hlavně umístění a reakce na
 * blízkost handle; vzhled si dodává volající přes `children`.
 *
 * Uhýbání i mizení se počítá přímo z úhlové vzdálenosti, bez vlastního
 * animačního stavu: prstenec se při tažení překresluje každý snímek, takže
 * pohyb vyjde plynulý sám, a i doběh pružiny po puštění se přenese.
 */
export default function RingMarker({
  angle,
  handleAngle,
  center,
  radius,
  size,
  avoid,
  dodgePx = 0,
  onPress,
  accessibilityLabel,
  children,
}: Props) {
  const reduceMotion = useReduceMotion();
  const gap = Math.abs(normalizeDelta(angle - handleAngle));
  // Sinová náběžná hrana - marker se rozjede s předstihem a nikde necukne.
  // Při potlačených animacích se neuhýbá ani nemizí: marker se hýbe průběžně
  // s tažením, takže by to byl přesně ten druh pohybu, kterému se má vyhnout.
  const nearness =
    reduceMotion || gap >= AVOID_DEG
      ? 0
      : 0.5 - 0.5 * Math.cos(Math.PI * (1 - gap / AVOID_DEG));

  const pt = polar(
    center,
    center,
    radius + (avoid === "dodge" ? dodgePx * nearness : 0),
    angle,
  );

  const style = {
    position: "absolute" as const,
    left: pt.x - size / 2,
    top: pt.y - size / 2,
    width: size,
    height: size,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    opacity: avoid === "fade" ? 1 - nearness : 1,
  };

  if (!onPress) {
    return (
      <View style={style} pointerEvents="none">
        {children}
      </View>
    );
  }
  return (
    <Pressable
      style={style}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </Pressable>
  );
}
