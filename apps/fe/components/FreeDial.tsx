import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, View, useWindowDimensions } from "react-native";
import FreeButton from "./FreeButton";
import PresetList, { PRESET_LIST_H } from "./PresetList";
import Reveal from "./Reveal";
import TimeEditSheet from "./TimeEditSheet";
import TimeRing, { BUTTON_RATIO, RING_BASE } from "./TimeRing";
import { T_MIN, clampTarget, clampToWindow } from "./TimeRing/scale";
import { useTourTarget } from "./tour/TourProvider";
import { defaultTarget, resolvePresets } from "./TimeRing/presets";
import { usePresets } from "../hooks/usePresets";
import {
  formatDuration,
  formatTime,
  isTomorrow,
  minutesUntil,
} from "../lib/time";

/** Rezerva na stíny presetů, které přesahují za jejich box. */
const SHADOW_ROOM = 10;
/** Kolik svislého místa si nad/pod prstencem berou hlavička obrazovky,
 * popisek s časem a seznam presetů - podle toho se prstenec zastropuje, aby se vše
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
  /** Volno je založené - běží, nebo je naplánované (`freeFrom`). */
  isFree: boolean;
  /** Naplánovaný začátek, dokud volno ještě nezačalo (task 0008); jinak `null`. */
  freeFrom: Date | null;
  /** Čas, do kdy volno běží. Jen když `isFree`. */
  freeUntil: Date | null;
  fade: Animated.Value;
  pending: boolean;
  now: Date;
  /** Klepnutí na tlačítko, když volno neběží - potvrzuje natažený čas.
   * `start` v budoucnu volno jen naplánuje, `null` = hned. */
  onConfirm: (until: Date, start: Date | null) => void;
  /** Puštění handle u založeného volna - nový začátek i konec se ukládá hned. */
  onChangeSlot: (start: Date | null, until: Date) => void;
  /** Klepnutí na tlačítko u založeného volna - ukončí ho, nebo zruší plán. */
  onEnd: () => void;
  /** Uživatel si sám vybral čas (puštění handle, klepnutí na preset) - pro průvodce po registraci. */
  onPick?: () => void;
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
  freeFrom,
  freeUntil,
  fade,
  pending,
  now,
  onConfirm,
  onChangeSlot,
  onEnd,
  onPick,
}: Props) {
  // Cíle nápověd průvodce po registraci (components/tour).
  const ringTarget = useTourTarget("ring");
  const buttonTarget = useTourTarget("button");

  const manage = usePresets();
  // Pro časovač níž, který výchozí čas počítá až za dvě minuty - musí vzít
  // presety platné v tu chvíli, ne ty z doby nastavení časovače.
  const defsRef = useRef(manage.presets);
  defsRef.current = manage.presets;
  const [editing, setEditing] = useState(false);

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
  const [target, setTarget] = useState(() => defaultTarget(new Date(), manage.presets));
  // Průběžná hodnota z tažení. Zůstává tady: čas se vykresluje jen v tomhle
  // komponentu, takže ji nikdo jiný nepotřebuje.
  const [preview, setPreview] = useState<Date | null>(null);
  // Rozpracovaný začátek, dokud volno není založené (`null` = teď). U
  // založeného volna je zdrojem pravdy `freeFrom`.
  const [startSel, setStartSel] = useState<Date | null>(null);
  // Průběžný začátek z tažení; `undefined` = netáhne se.
  const [startPreview, setStartPreview] = useState<Date | null | undefined>(
    undefined,
  );
  // Sheet s přesným časem (task 0010). Klíč ho při každém otevření přemontuje.
  const [exactKey, setExactKey] = useState<number | null>(null);

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
    setStartPreview(undefined);
    setStartSel(null);
    clearReset();
    // Úpravy presetů patří k zadávání času; za běhu volna je seznam schovaný.
    setEditing(false);

    if (isFree) {
      if (freeUntil) setTarget(freeUntil);
      return;
    }
    if (!cameFromFree) {
      setTarget(defaultTarget(new Date(), defsRef.current));
      return;
    }
    resetTimer.current = setTimeout(
      () => setTarget(defaultTarget(new Date(), defsRef.current)),
      KEEP_AFTER_END_MS,
    );
  }, [isFree, freeUntil?.getTime(), freeFrom?.getTime()]);

  // Začátek, který právě platí. Ten, na který už čas dojel, je zase "teď".
  const rawStart = isFree ? freeFrom : startSel;
  const start = rawStart && rawStart > now ? rawStart : null;

  // `now` se posouvá i bez zásahu uživatele, takže uložený cíl může vypadnout
  // z rozsahu - ořízne se až při vykreslení, aby se stav nepřepisoval sám.
  // Čas zadaný na minuty (task 0010) se nesnapuje na čtvrthodinu, jen ořízne;
  // snapuje se jen to, co už stihlo uběhnout.
  const minEnd = start ? new Date(start.getTime() + T_MIN * 60_000) : null;
  const windowed = target > now ? clampToWindow(target, now) : clampTarget(target, now);
  const safeTarget = minEnd && windowed < minEnd ? minEnd : windowed;
  // Za běhu volna se zobrazuje `freeUntil` ze serveru, ne oříznutá hodnota
  // prstence: uložený konec může ležet mimo jeho rozsah a ořez by čas i
  // odpočet zkreslil.
  const committed = isFree ? (freeUntil ?? safeTarget) : safeTarget;
  const shown = preview ?? committed;
  const shownStart = startPreview !== undefined ? startPreview : start;
  // Naplánované a ještě nezačalo - tlačítko ho zruší, popisek bez "!".
  const planned = isFree && start !== null;
  // Schválně bez memoizace: mapování pár kotev je zanedbatelné a memo by
  // muselo hlídat i změny seznamu z editoru.
  const presets = resolvePresets(now, manage.presets);

  // Tlačítko má za běhu volna jediný význam - ukončit. Posunutý konec se
  // ukládá už puštěním handle, takže není co druhotně potvrzovat.
  const handlePress = () => {
    if (isFree) {
      onEnd();
      return;
    }
    onConfirm(safeTarget, start);
    setPreview(null);
  };

  /**
   * Puštění handle (nebo klepnutí na dráhu či preset). Za běhu volna se nový
   * konec ukládá hned; jinak se jen odloží do potvrzení tlačítkem.
   */
  const handleChange = (d: Date) => {
    // Kotva ze seznamu dřív, než může volno skončit, se stane začátkem -
    // stejně jako klepnutí na ni přímo na prstenci.
    if (start && d.getTime() < start.getTime() + T_MIN * 60_000) {
      const minEnd = new Date(d.getTime() + T_MIN * 60_000);
      handleSlot(d, safeTarget < minEnd ? minEnd : safeTarget);
      return;
    }
    // Uživatel si hodnotu vybral sám, takže se na ni už nemá nic vracet.
    clearReset();
    setTarget(d);
    setPreview(null);
    onPick?.();
    // Puštění na stejné hodnotě by jinak poslalo PUT, který nic nemění.
    if (isFree && freeUntil && d.getTime() !== freeUntil.getTime()) {
      onChangeSlot(start, d);
    }
  };

  /** Puštění handle začátku (task 0008), případně s dotlačeným koncem. */
  const handleSlot = (s: Date | null, end: Date) => {
    clearReset();
    setTarget(end);
    setPreview(null);
    setStartPreview(undefined);
    onPick?.();
    if (!isFree) {
      setStartSel(s);
      return;
    }
    const sameStart = (s?.getTime() ?? null) === (start?.getTime() ?? null);
    const sameEnd = freeUntil?.getTime() === end.getTime();
    if (!sameStart || !sameEnd) onChangeSlot(s, end);
  };

  const openExact = () => setExactKey(Date.now());

  return (
    <View
      className="items-center w-full"
      onLayout={(e) => setAvail(e.nativeEvent.layout.width)}
    >
      {/* Jediný slot pro čas i délku, stejný v obou stavech, a zároveň
          nadpis obrazovky - samostatný nadpis "Nemám volno / Jsem volný"
          zmizel, stav nese barva tlačítka a předsazené "zbývá". Čas stojí
          nad prstencem, protože je to hodnota, kterou prstenec nastavuje:
          prst při tažení zakrývá spodek prstence, ne horní okraj. */}
      <View className="items-center mb-3">
        {/* Otazník, dokud volno neběží - noví uživatelé jinak brali
            "Volný do 16:00" za hotovou věc (task 0031). Naplánované volno
            je potvrzené, ale ještě neběží - bez znaménka.
            Klepnutí na čas (šedý podklad) otevře přesné zadání na minuty
            (task 0010). */}
        <View className="flex-row flex-wrap items-center justify-center">
          <Text className="text-gray-900 text-2xl font-bold">Volný</Text>
          {shownStart && (
            <>
              <Text className="text-gray-900 text-2xl font-bold"> od</Text>
              <TimeChip
                date={shownStart}
                now={now}
                label="Upravit začátek"
                onPress={openExact}
              />
            </>
          )}
          <Text className="text-gray-900 text-2xl font-bold">
            {" do"}
          </Text>
          <TimeChip
            date={shown}
            now={now}
            label="Upravit konec"
            onPress={openExact}
          />
          <Text className="text-gray-900 text-2xl font-bold">
            {planned ? "" : isFree ? "!" : "?"}
          </Text>
        </View>
        <Text className="text-gray-400 text-sm mt-0.5">
          {shownStart
            ? `${formatDuration(minutesUntil(shown, shownStart))} · začíná za ${formatDuration(minutesUntil(shownStart, now))}`
            : `${isFree ? "zbývá " : ""}${formatDuration(minutesUntil(shown, now))}`}
        </Text>
      </View>

      <View ref={ringTarget} collapsable={false}>
        <TimeRing
          target={safeTarget}
          now={now}
          size={ringSize}
          presets={presets}
          onPreview={setPreview}
          onChange={handleChange}
          start={start}
          onStartPreview={(s, end) => {
            setStartPreview(s);
            setPreview(end);
          }}
          onStartChange={handleSlot}
        >
          <View ref={buttonTarget} collapsable={false}>
            <FreeButton
              isFree={isFree}
              onPress={handlePress}
              fade={fade}
              pending={pending}
              accessibilityLabel={
                planned
                  ? "Zrušit naplánované volno"
                  : isFree
                    ? "Ukončit volno"
                    : start
                      ? `Naplánovat volno od ${formatTime(start)} do ${formatTime(safeTarget)}`
                      : `Označit se jako volný do ${formatTime(safeTarget)}`
              }
              size={buttonSize}
              pressHaptic={isFree ? "cancel" : "confirm"}
            />
          </View>
        </TimeRing>
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
          editing={editing}
          onEditingChange={setEditing}
          manage={manage}
        />
      </Reveal>

      {exactKey !== null && (
        <TimeEditSheet
          key={exactKey}
          visible
          onClose={() => setExactKey(null)}
          now={now}
          start={start}
          end={committed}
          onSave={(s, end) => {
            setTarget(end);
            handleSlot(s, end);
          }}
        />
      )}
    </View>
  );
}

/**
 * Čas v popisku nad prstencem. Jemný šedý podklad jen kolem samotného času
 * napovídá, že na něj jde klepnout - otevře přesné zadání na minuty (task
 * 0010). Číslice jsou tabulkové, aby chip při tažení prstence necukal šířkou.
 */
function TimeChip({
  date,
  now,
  label,
  onPress,
}: {
  date: Date;
  now: Date;
  label: string;
  onPress: () => void;
}) {
  const tomorrow = isTomorrow(date, now);
  return (
    <>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${formatTime(date)}${tomorrow ? " zítra" : ""}`}
        accessibilityHint="Zadat přesný čas na minuty"
        hitSlop={6}
        className="ml-1.5 mr-0.5 rounded-lg bg-black/[0.05] px-1.5 active:bg-black/[0.1]"
      >
        <Text
          className="text-gray-900 text-2xl font-bold"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {formatTime(date)}
        </Text>
      </Pressable>
      {tomorrow && (
        <Text className="text-gray-900 text-2xl font-bold ml-1">(zítra)</Text>
      )}
    </>
  );
}
