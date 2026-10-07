import type { ComponentType } from "react";
import Baby from "lucide-react-native/icons/baby";
import Bed from "lucide-react-native/icons/bed";
import Beer from "lucide-react-native/icons/beer";
import BookOpen from "lucide-react-native/icons/book-open";
import Briefcase from "lucide-react-native/icons/briefcase";
import Car from "lucide-react-native/icons/car";
import Clock from "lucide-react-native/icons/clock";
import Coffee from "lucide-react-native/icons/coffee";
import Dog from "lucide-react-native/icons/dog";
import Dumbbell from "lucide-react-native/icons/dumbbell";
import Gamepad2 from "lucide-react-native/icons/gamepad-2";
import GraduationCap from "lucide-react-native/icons/graduation-cap";
import House from "lucide-react-native/icons/house";
import MoonStar from "lucide-react-native/icons/moon-star";
import Music from "lucide-react-native/icons/music";
import ShoppingCart from "lucide-react-native/icons/shopping-cart";
import Sun from "lucide-react-native/icons/sun";
import Sunrise from "lucide-react-native/icons/sunrise";
import Sunset from "lucide-react-native/icons/sunset";
import TrainFront from "lucide-react-native/icons/train-front";
import Utensils from "lucide-react-native/icons/utensils";
import { dateToOffset, snapToQuarter } from "./scale";

/**
 * Presety jsou **pevné denní kotvy**, ne relativní offsety - "volný do oběda"
 * dává smysl, "volný na 3 hodiny" ne. Každá kotva se pro dané `now` přepočítá
 * na svůj nejbližší budoucí výskyt.
 *
 * Seznam kotev si uživatel nastavuje sám (task 0009) a drží ho backend -
 * sem přichází jako `PresetDef[]` z `hooks/usePresets.ts`.
 */

export type PresetIcon = ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

/**
 * Vybraná sada ikonek, ze které si uživatel vybírá. Lucide kvůli konzistenci
 * s ostatními ikonami v appce - a na rozdíl od emoji se vykreslí všude
 * stejně. Klíče musí sedět s `DefaultPresets.IconKeys` na backendu, který
 * jiné neuloží. Pořadí je pořadí v mřížce výběru.
 */
export const PRESET_ICONS: Record<string, PresetIcon> = {
  sunrise: Sunrise,
  sun: Sun,
  sunset: Sunset,
  "moon-star": MoonStar,
  house: House,
  coffee: Coffee,
  utensils: Utensils,
  briefcase: Briefcase,
  "graduation-cap": GraduationCap,
  "book-open": BookOpen,
  dumbbell: Dumbbell,
  beer: Beer,
  music: Music,
  "gamepad-2": Gamepad2,
  bed: Bed,
  car: Car,
  "train-front": TrainFront,
  "shopping-cart": ShoppingCart,
  baby: Baby,
  dog: Dog,
};

/** Ikonka pro klíč, který FE nezná (třeba z novější verze backendu). */
const FALLBACK_ICON: PresetIcon = Clock;

/** Preset tak, jak ho drží uživatel - bez vazby na konkrétní den. */
export type PresetDef = {
  /** Id z backendu jako řetězec; výchozí presety před prvním načtením mají `default-*`. */
  id: string;
  name: string;
  icon: string;
  /** Minuta dne (0-1439), násobek 15, místní čas. */
  minute: number;
};

/**
 * Výchozí presety. Shodné s tím, co backend dá novému uživateli
 * (`DefaultPresets`) - tady jen jako náhrada, než dorazí jeho vlastní, aby
 * prstenec při prvním spuštění nebyl prázdný.
 */
export const DEFAULT_PRESETS: PresetDef[] = [
  { id: "default-morning", name: "Ráno", icon: "sunrise", minute: 8 * 60 },
  { id: "default-midday", name: "Poledne", icon: "sun", minute: 12 * 60 },
  { id: "default-work", name: "Odpoledne", icon: "house", minute: 16 * 60 },
  { id: "default-evening", name: "Večer", icon: "sunset", minute: 21 * 60 },
  { id: "default-midnight", name: "Půlnoc", icon: "moon-star", minute: 0 },
];

export function presetIcon(key: string): PresetIcon {
  return PRESET_ICONS[key] ?? FALLBACK_ICON;
}

export type Preset = PresetDef & {
  Icon: PresetIcon;
  label: string;
  /** Nejbližší budoucí výskyt kotvy. */
  date: Date;
  /** Minuty od `now` - kvůli umístění na prstenci. */
  offset: number;
};

/** Nejbližší budoucí výskyt dané minuty dne. */
function nextOccurrence(minute: number, now: Date): Date {
  const d = new Date(now);
  d.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
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
export function resolvePresets(now: Date, defs: PresetDef[]): Preset[] {
  return defs
    .map((d) => {
      const date = nextOccurrence(d.minute, now);
      return {
        ...d,
        Icon: presetIcon(d.icon),
        label: d.name,
        date,
        offset: dateToOffset(date, now),
      };
    })
    .sort((a, b) => a.offset - b.offset);
}

/** Preset, který se nabídne jako výchozí, musí být aspoň takhle daleko. */
const DEFAULT_MIN_OFFSET = 60;
/** Preset dál než tohle se jako výchozí nenabídne - ve 23:40 by jinak padl
 * až na ráno, tedy osm hodin volna. */
const DEFAULT_MAX_OFFSET = 6 * 60;
/** Když žádný preset není v rozumné vzdálenosti, nabídne se tenhle odstup. */
const DEFAULT_FALLBACK_OFFSET = 120;

/**
 * Výchozí nabízený čas: nejbližší preset, který je aspoň hodinu daleko - ne
 * prostě nejbližší preset, protože "volný do oběda" v 11:50 nikomu nepomůže
 * (pravidlo z tasku 0011). Když je takový preset dál než 6 h (třeba ve
 * 23:40, kdy další je až ráno) nebo žádný není, vrátí se prostě dvě hodiny
 * od teď.
 */
export function defaultTarget(now: Date, defs: PresetDef[]): Date {
  const preset = resolvePresets(now, defs).find(
    (p) => p.offset >= DEFAULT_MIN_OFFSET,
  );
  if (preset && preset.offset <= DEFAULT_MAX_OFFSET) return preset.date;
  return snapToQuarter(
    new Date(now.getTime() + DEFAULT_FALLBACK_OFFSET * 60_000),
  );
}
