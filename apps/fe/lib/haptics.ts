import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * Hmatová odezva popsaná **tím, co se stalo**, ne tím, jak má cuknout.
 * Mapování na konkrétní efekty je jedna tabulka níž, takže se dá ladit na
 * jednom místě - a je to zároveň švy pro případný nativní modul (Core Haptics
 * na iOS, VibrationEffect primitiva na Androidu), kdyby presety nestačily.
 */
export type HapticEvent =
  /** Přejezd přes čtvrthodinovou čárku. */
  | "tickMinor"
  /** Přejezd přes půlhodinu. */
  | "tickHalf"
  /** Přejezd přes celou hodinu. */
  | "tickHour"
  /** Namotávání za koncem dráhy, kde se hodnota mění bez pohybu prstu. */
  | "tickWind"
  /** Dosednutí nebo přejezd denní kotvy. */
  | "preset"
  /** Doraz na kraji rozsahu. */
  | "limit"
  /** Označení se volným. */
  | "confirm"
  /** Ukončení volna. */
  | "cancel";

/**
 * Konstanty, které `expo-haptics` umí na **každém** API levelu. Vychází to
 * z jeho vlastního Androidího kódu (`HapticsRecord.kt`): efekt se dohledává
 * reflexí a když na daném systému neexistuje, spadne to na tenhle výčet -
 * cokoli mimo něj vyhodí `HapticsNotSupportedException`.
 */
type SafeAndroidHaptic =
  | Haptics.AndroidHaptics.Clock_Tick
  | Haptics.AndroidHaptics.Context_Click
  | Haptics.AndroidHaptics.Keyboard_Tap
  | Haptics.AndroidHaptics.Long_Press
  | Haptics.AndroidHaptics.Virtual_Key;

type Spec = {
  /**
   * Na Androidu se jde přes `performAndroidHapticsAsync`, ne přes
   * `impactAsync`/`selectionAsync`. Dokumentace `expo-haptics` říká, že ty
   * jsou na Androidu jen **simulované přes `Vibrator`**, a doporučuje tuhle
   * cestu. Vedlejší, ale podstatný rozdíl: tahle respektuje systémový
   * přepínač hmatové odezvy, kdežto simulace ho obchází.
   */
  android: Haptics.AndroidHaptics;
  /** Od kterého API levelu `android` existuje. Chybí = existuje vždycky. */
  androidMinApi?: number;
  /** Náhrada pod `androidMinApi`. Bez ní by odezva jen tiše zmizela. */
  androidFallback?: SafeAndroidHaptic;
  ios: () => Promise<void>;
  /** Nejmenší rozestup mezi dvěma stejně (nebo méně) důležitými událostmi. */
  minGapMs: number;
  /** Vyšší smí prolomit rozestup nastavený tou předchozí. */
  priority: number;
};

/**
 * Pozor: relativní síla hodnot `AndroidHaptics` není nikde dokumentovaná,
 * ladí ji výrobce a mezi zařízeními se liší - z kódu ji odvodit nelze. Tohle
 * je výchozí odhad k doladění na skutečném telefonu. Přeskládat pořadí je
 * jednořádková úprava, a to je vlastně hlavní přínos téhle tabulky.
 *
 * Záměrně se **nepoužívá** `Segment_Frequent_Tick`, i když je pro slidery
 * určená: dokumentace ji popisuje jako "expected to be very soft", což jde
 * proti zadání "krátké, ale silné údery". Roli "ať to nedrnčí" tady plní
 * tlumení rychlostí v prstenci, ne slabý preset.
 */
const SPECS: Record<HapticEvent, Spec> = {
  tickMinor: {
    android: Haptics.AndroidHaptics.Segment_Tick,
    androidMinApi: 34,
    androidFallback: Haptics.AndroidHaptics.Clock_Tick,
    ios: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid),
    minGapMs: 45,
    priority: 1,
  },
  tickHalf: {
    android: Haptics.AndroidHaptics.Virtual_Key,
    ios: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid),
    minGapMs: 45,
    priority: 2,
  },
  tickHour: {
    android: Haptics.AndroidHaptics.Context_Click,
    ios: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
    minGapMs: 30,
    priority: 3,
  },
  // Stejný efekt jako celá hodina, ale s dlouhým rozestupem: namotávání jede
  // z `requestAnimationFrame` smyčky, takže bez toho by střílelo jako kulomet.
  tickWind: {
    android: Haptics.AndroidHaptics.Context_Click,
    ios: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
    minGapMs: 180,
    priority: 3,
  },
  preset: {
    android: Haptics.AndroidHaptics.Confirm,
    androidMinApi: 30,
    androidFallback: Haptics.AndroidHaptics.Virtual_Key,
    ios: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
    minGapMs: 250,
    priority: 4,
  },
  limit: {
    android: Haptics.AndroidHaptics.Reject,
    androidMinApi: 30,
    androidFallback: Haptics.AndroidHaptics.Long_Press,
    ios: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
    minGapMs: 250,
    priority: 5,
  },
  confirm: {
    android: Haptics.AndroidHaptics.Confirm,
    androidMinApi: 30,
    androidFallback: Haptics.AndroidHaptics.Virtual_Key,
    ios: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    minGapMs: 0,
    priority: 6,
  },
  cancel: {
    android: Haptics.AndroidHaptics.Toggle_Off,
    androidMinApi: 34,
    androidFallback: Haptics.AndroidHaptics.Keyboard_Tap,
    ios: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft),
    minGapMs: 0,
    priority: 6,
  },
};

/**
 * Pod tímhle rozestupem se dvě cuknutí na motoru fyzicky slijí v jeden delší
 * a tupější pulz. Platí i pro událost, která smí prolomit rozestup podle
 * priority - jinak by "silnější smí přednost" vyrobilo přesně tu kaši, kterou
 * má celá tahle změna odstranit.
 */
const MERGE_FLOOR_MS = 24;
/**
 * Kolik cuknutí smí padnout za jedno držení za koncem dráhy. Dojet na 24 h
 * trvá pár sekund a bez stropu by to byly desítky úderů, které už nic
 * neříkají - dál mluví jen vizuální roztahování okna.
 */
const WIND_BUDGET = 8;

// Stav proudu je schválně tady, ne v komponentě: jen tady je vidět celý proud
// dohromady. Prstenec o tom, že haptiku pouští i tlačítko, nic neví. Navíc
// closure v `PanResponder` se při každém přegenerování zahodí, takže by se
// limity mid-session tiše resetovaly.
let lastAt = 0;
let lastPriority = 0;
let windUsed = 0;

/** Zahodí strop namotávání - volat při novém gestu a při návratu do dráhy. */
export function resetWindBudget(): void {
  windUsed = 0;
}

const androidEffect = (spec: Spec): Haptics.AndroidHaptics => {
  const api = typeof Platform.Version === "number" ? Platform.Version : 0;
  if (spec.androidMinApi && spec.androidFallback && api < spec.androidMinApi) {
    return spec.androidFallback;
  }
  return spec.android;
};

/**
 * Pustí odezvu, pokud to hygiena proudu dovolí. Fire-and-forget - haptika se
 * váže na gesto, ne na výsledek nějaké operace, takže na její dokončení nemá
 * smysl čekat.
 *
 * Rozestupy nejsou jen ochrana proti nepohodlí: iOS i Android při zaplavení
 * události slévají a zahazují, takže netlumený proud paradoxně **oslabuje**
 * to, co má být cítit.
 */
export function haptic(event: HapticEvent): void {
  // Na webu není co dělat a `expo-haptics` by jen vyhodilo nedostupnost.
  if (Platform.OS === "web") return;

  const spec = SPECS[event];
  const now = Date.now();
  const since = now - lastAt;

  if (since < MERGE_FLOOR_MS) return;
  // Silnější událost smí prolomit rozestup slabší - jinak by hodinový úder
  // spolkla čtvrthodina, která ho o pár desítek ms předběhla, tedy přesně
  // ten okamžik, který má být cítit.
  if (since < spec.minGapMs && spec.priority <= lastPriority) return;

  if (event === "tickWind") {
    if (windUsed >= WIND_BUDGET) return;
    windUsed++;
  }

  lastAt = now;
  lastPriority = spec.priority;

  if (Platform.OS === "android") {
    // `performAndroidHapticsAsync` volá nativní modul bez optional chaining,
    // takže když chybí, vyhodí - proto catch, ne jen kvůli odmítnutí OS.
    Haptics.performAndroidHapticsAsync(androidEffect(spec)).catch(() => {});
    return;
  }
  spec.ios().catch(() => {});
}
