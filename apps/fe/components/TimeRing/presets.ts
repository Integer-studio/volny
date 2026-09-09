import type { ComponentType } from "react";
import House from "lucide-react-native/icons/house";
import Sunset from "lucide-react-native/icons/sunset";
import { dateToOffset, snapToQuarter } from "./scale";
import Sunrise from "lucide-react-native/icons/sunrise";
import Sun from "lucide-react-native/icons/sun";
import MoonStar from "lucide-react-native/icons/moon-star";

/**
 * Presety jsou **pevné denní kotvy**, ne relativní offsety - "volný do oběda"
 * dává smysl, "volný na 3 hodiny" ne. Každá kotva se pro dané `now` přepočítá
 * na svůj nejbližší budoucí výskyt.
 *
 * Až bude hotový task 0009 (uživatelsky nastavitelné presety), vymění se
 * tenhle seznam za data z profilu - zbytek prstence se nezmění.
 */
type Anchor = {
  id: string;
  /** Lucide ikonka - konzistentní s ostatními ikonami v appce a na rozdíl od
   * emoji se vykreslí všude stejně. */
  Icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string;
  /** Hodina nástěnných hodin, na kterou kotva sedí. */
  hour: number;
};

const ANCHORS: Anchor[] = [
  { id: "morning", Icon: Sunrise, label: "Ráno", hour: 8 },
  { id: "midday", Icon: Sun, label: "Poledne", hour: 12 },
  { id: "work", Icon: House, label: "Odpoledne", hour: 16 },
  { id: "evening", Icon: Sunset, label: "Večer", hour: 21 },
  { id: "midnight", Icon: MoonStar, label: "Půlnoc", hour: 0 },
];

export type Preset = Anchor & {
  /** Nejbližší budoucí výskyt kotvy. */
  date: Date;
  /** Minuty od `now` - kvůli umístění na prstenci. */
  offset: number;
};

/** Nejbližší budoucí výskyt dané hodiny. */
function nextOccurrence(hour: number, now: Date): Date {
  const d = new Date(now);
  d.setHours(hour, 0, 0, 0);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

/**
 * Kotvy převedené na konkrétní časy, seřazené podle blízkosti - aby šlo brát
 * "první, který je dost daleko".
 *
 * Nic se nefiltruje: nejbližší budoucí výskyt hodiny nikdy neleží dál než
 * den, a rozsah prstence je právě 24 h (`T_MAX`), takže každá kotva je vždy
 * zadatelná. Kotva pár minut před sebou je taky v pořádku - jen se na ni
 * nedá dotáhnout, musí se na ni klepnout.
 */
export function resolvePresets(now: Date): Preset[] {
  return ANCHORS.map((a) => {
    const date = nextOccurrence(a.hour, now);
    return { ...a, date, offset: dateToOffset(date, now) };
  }).sort((a, b) => a.offset - b.offset);
}

/** Preset, který se nabídne jako výchozí, musí být aspoň takhle daleko. */
const DEFAULT_MIN_OFFSET = 60;
/** Když žádný preset není dost daleko, nabídne se tenhle odstup. */
const DEFAULT_FALLBACK_OFFSET = 120;

/**
 * Výchozí nabízený čas: nejbližší preset, který je aspoň hodinu daleko - ne
 * prostě nejbližší preset, protože "volný do oběda" v 11:50 nikomu nepomůže
 * (pravidlo z tasku 0011). Když se žádný takový nenajde (třeba půl hodiny
 * před půlnocí), vrátí se prostě dvě hodiny od teď.
 */
export function defaultTarget(now: Date): Date {
  const preset = resolvePresets(now).find(
    (p) => p.offset >= DEFAULT_MIN_OFFSET,
  );
  if (preset) return preset.date;
  return snapToQuarter(
    new Date(now.getTime() + DEFAULT_FALLBACK_OFFSET * 60_000),
  );
}
