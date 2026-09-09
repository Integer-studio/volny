import React, { useEffect, useRef, useState } from "react";
import { Animated, Text, View, useWindowDimensions } from "react-native";
import FreeButton from "./FreeButton";
import PresetList, { PRESET_LIST_H } from "./PresetList";
import Reveal from "./Reveal";
import TimeRing, { BUTTON_RATIO, RING_BASE } from "./TimeRing";
import { clampTarget } from "./TimeRing/scale";
import { defaultTarget, resolvePresets } from "./TimeRing/presets";
import {
  formatDuration,
  formatTime,
  isTomorrow,
  minutesUntil,
} from "../lib/time";

/** Rezerva na stíny presetů, které přesahují za jejich box. */
const SHADOW_ROOM = 10;
/** Kolik svislého místa si nad/pod prstencem berou hlavička obrazovky,
 * popisek a seznam presetů - podle toho se prstenec zastropuje, aby se vše
 * vešlo bez rolování celé obrazovky. Seznam presetů si roluje sám ve svém
 * boxu, takže do stropu jde jen jeho pevná výška. */
const VERTICAL_CHROME = 300 + PRESET_LIST_H;
/** Pod tuhle velikost prstenec nezmenšovat, i kdyby byla obrazovka nízká. */
const MIN_RING = 260;
/** Jak dlouho po ukončení volna zůstane na prstenci jeho starý konec, než se
 * vrátí výchozí čas. Umožňuje rychle přepínat volno on/off, aniž by se
 * hodnota mezitím sama přenastavila. */
const KEEP_AFTER_END_MS = 2 * 60_000;

type Props = {
  isFree: boolean;
  /** Čas, do kdy volno běží. Jen když `isFree`. */
  freeUntil: Date | null;
  fade: Animated.Value;
  pending: boolean;
  now: Date;
  /** Klepnutí na tlačítko, když volno neběží - potvrzuje natažený čas. */
  onConfirm: (until: Date) => void;
  /** Puštění handle za běhu volna - nový konec se ukládá hned. */
  onChangeEnd: (until: Date) => void;
  /** Klepnutí na tlačítko, když volno běží - ukončuje ho. */
  onEnd: () => void;
};

/**
 * Hlavní ovladač volna: prstencový slider + kulaté tlačítko uprostřed +
 * popisek. Nahrazuje dřívější popup se sliderem i řádek rychlých tlačítek -
 * čas se natáhne prstencem a potvrdí klepnutím doprostřed.
 *
 * Tentýž prstenec slouží i za běhu volna: oblouk vede od `now` do `freeUntil`,
 * takže se sám zkracuje, jak čas ubíhá, a tažením se dá konec posunout.
 *
 * Rozdělení stavu je záměrné: rozpracovaná hodnota (`target`, `preview`) je
 * jen tady, do `app/index.tsx` se dostane teprve při potvrzení. Obrazovka tak
 * neví nic o tom, jak se čas zadává.
 */
export default function FreeDial({
  isFree,
  freeUntil,
  fade,
  pending,
  now,
  onConfirm,
  onChangeEnd,
  onEnd,
}: Props) {
  // Prstenec je navržený na `RING_BASE`; na menších obrazovkách se celý
  // poměrově zmenší, včetně tlačítka uprostřed.
  //
  // Šířka se bere z vlastního layoutu, ne z `useWindowDimensions` - ta na webu
  // vrací `window.innerWidth` **včetně** svislého scrollbaru, takže prstenec
  // vycházel o jeho šířku větší, než kolik je uvnitř ScrollView k dispozici,
  // a přidával vodorovné rolování.
  const { width, height } = useWindowDimensions();
  const [avail, setAvail] = useState<number | null>(null);
  const ringSize = Math.max(
    MIN_RING,
    Math.min(
      RING_BASE,
      (avail ?? width - 32) - SHADOW_ROOM,
      height - VERTICAL_CHROME,
    ),
  );
  const buttonSize = Math.round(ringSize * BUTTON_RATIO);

  // Cíl se drží jako absolutní čas ("do 15:00"), ne jako délka - to je i to,
  // co uživatel vidí a co se posílá na server. Výchozí hodnota je nejbližší
  // preset aspoň hodinu daleko (pravidlo z tasku 0011).
  const [target, setTarget] = useState(() => defaultTarget(new Date()));
  // Průběžná hodnota z tažení. Zůstává tady: headline nad tlačítkem už čas
  // nenese, takže ji nikdo jiný nepotřebuje.
  const [preview, setPreview] = useState<Date | null>(null);

  const wasFree = useRef(isFree);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearReset = () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = null;
  };
  useEffect(() => clearReset, []);

  // Za běhu volna je zdrojem pravdy `freeUntil` ze serveru; `target` se na něj
  // srovná, dokud si ho uživatel nezačne posouvat sám. Bez tohohle by prstenec
  // po zapnutí volna ukazoval starou rozpracovanou hodnotu.
  //
  // Po ukončení volna se ale výchozí čas **nenastavuje hned** - prstenec drží
  // starý konec ještě dvě minuty, aby šlo volno rychle vypnout a zapnout na
  // stejnou hodnotu. Teprve pak se vrátí výchozí preset.
  useEffect(() => {
    const cameFromFree = wasFree.current && !isFree;
    wasFree.current = isFree;
    setPreview(null);
    clearReset();

    if (isFree) {
      if (freeUntil) setTarget(freeUntil);
      return;
    }
    if (!cameFromFree) {
      setTarget(defaultTarget(new Date()));
      return;
    }
    resetTimer.current = setTimeout(
      () => setTarget(defaultTarget(new Date())),
      KEEP_AFTER_END_MS,
    );
  }, [isFree, freeUntil?.getTime()]);

  // `now` se posouvá i bez zásahu uživatele, takže uložený cíl může vypadnout
  // z rozsahu - ořízne se až při vykreslení, aby se stav nepřepisoval sám.
  const safeTarget = clampTarget(target, now);
  // Za běhu volna se zobrazuje `freeUntil` ze serveru, ne oříznutá hodnota
  // prstence: uložený konec může ležet mimo jeho rozsah a ořez by čas i
  // odpočet zkreslil.
  const committed = isFree ? (freeUntil ?? safeTarget) : safeTarget;
  const shown = preview ?? committed;
  // Schválně bez memoizace: mapování pár kotev je zanedbatelné, zato memo
  // klíčované jen na `now` neumí poznat, že se změnil sám seznam kotev
  // v `TimeRing/presets.ts` - po Fast Refreshi (a při každé jeho budoucí
  // výměně za data z 0009) by vracelo starou hodnotu, dokud netikne minuta.
  const presets = resolvePresets(now);

  // Tlačítko má za běhu volna jediný význam - ukončit. Posunutý konec se
  // ukládá už puštěním handle, takže není co druhotně potvrzovat.
  const handlePress = () => {
    if (isFree) {
      onEnd();
      return;
    }
    onConfirm(safeTarget);
    setPreview(null);
  };

  /**
   * Puštění handle (nebo klepnutí na dráhu či preset). Za běhu volna se nový
   * konec ukládá hned; jinak se jen odloží do potvrzení tlačítkem.
   */
  const handleChange = (d: Date) => {
    // Uživatel si hodnotu vybral sám, takže se na ni už nemá nic vracet.
    clearReset();
    setTarget(d);
    setPreview(null);
    // Puštění na stejné hodnotě by jinak poslalo PUT, který nic nemění.
    if (isFree && freeUntil && d.getTime() !== freeUntil.getTime()) {
      onChangeEnd(d);
    }
  };

  return (
    <View
      className="items-center w-full"
      onLayout={(e) => setAvail(e.nativeEvent.layout.width)}
    >
      <TimeRing
        target={safeTarget}
        now={now}
        size={ringSize}
        presets={presets}
        onPreview={setPreview}
        onChange={handleChange}
      >
        <FreeButton
          isFree={isFree}
          onPress={handlePress}
          fade={fade}
          pending={pending}
          size={buttonSize}
          pressHaptic={isFree ? "cancel" : "confirm"}
        />
      </TimeRing>

      {/* Jediný slot pro čas i délku, stejný v obou stavech. Dřív se
          absolutní čas stěhoval (při zadávání sem, za běhu do headline) a
          tentýž řádek znamenal jednou "co nastavím" a jednou "kolik zbývá" -
          právě to působilo nekonzistentně. Význam teď nese jen předsazené
          slovo, místo ani typografie se nemění. */}
      <View className="items-center mt-2">
        <Text className="text-gray-900 text-lg font-semibold">
          Volný do {formatTime(shown)}
          {isTomorrow(shown, now) ? " (zítra)" : ""}
        </Text>
        <Text className="text-gray-400 text-sm mt-0.5">
          {isFree ? "zbývá " : ""}
          {formatDuration(minutesUntil(shown, now))}
        </Text>
      </View>

      {/* Kotvy pod prstencem. Když volno naskočí, tenhle blok zmizí a jeho
          místo v obrazovce zabere seznam volných přátel (`Reveal` se stejným
          zpožděním v app/index.tsx), takže se ty dva nikdy nepřekrývají. */}
      <Reveal visible={!isFree} delayMs={180} className="w-full mt-6">
        <PresetList
          presets={presets}
          now={now}
          // Schválně `safeTarget`, ne `shown`: kdyby se sem dostal průběžný
          // náhled, presety by při tažení přes ně problikávaly jako zvolené.
          selected={safeTarget}
          onSelect={handleChange}
        />
      </Reveal>
    </View>
  );
}
