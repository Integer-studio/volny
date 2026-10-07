import React, { useEffect, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Check from "lucide-react-native/icons/check";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Plus from "lucide-react-native/icons/plus";
import RotateCcw from "lucide-react-native/icons/rotate-ccw";
import BottomFade from "./BottomFade";
import PresetEditSheet from "./PresetEditSheet";
import { useToast } from "./Toast";
import { Preset, PresetDef } from "./TimeRing/presets";
import type { PresetsApi } from "../hooks/usePresets";
import { errorMessage } from "../lib/errors";
import { formatDuration, formatTime, isTomorrow, minutesUntil } from "../lib/time";
import { cn } from "../lib/utils";

const ORANGE = "#EE6C4D";
const ICON = "#5A5550";
const BG = "#FCFBF8";

/** Výška jednoho řádku - z ní se počítá strop celého boxu. */
const ROW_H = 56;
/** Kolik řádků je vidět celých. Víc už tlačí prstenec. */
const VISIBLE_ROWS = 3;
/**
 * Kus dalšího řádku, který zůstane vykouknutý. Box zarovnaný přesně na tři
 * řádky nedával nijak najevo, že pod ním něco je - useknutý čtvrtý řádek je
 * na to ta nejsrozumitelnější nápověda.
 */
const PEEK = 30;
/** Výška nadpisu i s odstupem. */
const HEADER_H = 26;

/** Výška rolovacího okna. Musí být pevná: ScrollView potřebuje definovanou
 * výšku, samotný horní limit na předkovi ho neomezí a naroste na obsah. */
const BOX_H = ROW_H * VISIBLE_ROWS + PEEK;

/** Kolik ze seznamu musí být vidět nad ohybem: nadpis, jeden řádek a kus
 * dalšího. Zbytek může na nízké obrazovce zajet pod hranu - prstenec má
 * přednost (task 0024 dřív vtěsnával celý seznam a prstenec na webu v
 * mobilu kvůli tomu spadl na minimum). */
export const PRESET_PEEK_H = HEADER_H + ROW_H + PEEK;

type Props = {
  presets: Preset[];
  now: Date;
  /** Aktuální hodnota prstence - podle ní se zvýrazní odpovídající preset. */
  selected: Date;
  onSelect: (target: Date) => void;
  /** Režim úprav - drží ho `FreeDial`, aby ho mohl zavřít při zapnutí volna. */
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  manage: PresetsApi;
};

/** Jak dlouho čeká druhé klepnutí na "Obnovit výchozí", než se zruší. */
const CONFIRM_RESET_MS = 4000;

/** Čas presetu jako na hodinách ("8:00"), bez vazby na den. */
function wallTime(minute: number): string {
  return `${Math.floor(minute / 60)}:${String(minute % 60).padStart(2, "0")}`;
}

/**
 * Denní kotvy pod prstencem, svisle a ve stejném duchu jako seznam volných
 * přátel, který ho po zapnutí volna vystřídá. Prstenec je má i na sobě, ale
 * tam jsou malé, bez času a jen v rámci aktuálního okna - tady jsou všechny.
 *
 * Klepnutí jen nastaví prstenec, nepotvrzuje: potvrzení má být jediné gesto
 * (klepnutí doprostřed), a "rychlá tlačítka, která rovnou zapisují" byla
 * přesně to, co nové UI nahrazuje.
 *
 * Roluje se jen tenhle box, ne celá obrazovka - proto pevný strop výšky.
 * Zbytek obrazovky tak zůstává na místě, i kdyby presetů byla řada.
 *
 * Úpravy (task 0009) se dělají přímo tady, ne v nastavení: "Upravit" přepne
 * tentýž seznam do režimu úprav, kde klepnutí na řádek otevře editor místo
 * nastavení prstence. Řádky zůstávají na místě, mění se jen podtitul a
 * značka vpravo - nic neposkočí.
 */
export default function PresetList({
  presets,
  now,
  selected,
  onSelect,
  editing,
  onEditingChange,
  manage,
}: Props) {
  // Odstín u dolní hrany má smysl jen když se dá rolovat a zbývá kam - jinak
  // by slíbil obsah, který tam není.
  const [more, setMore] = useState(false);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    setMore(contentOffset.y + layoutMeasurement.height < contentSize.height - 2);
  };

  const { show } = useToast();
  // Upravovaný preset (`null` = nový). Při zavírání zůstává, aby se obsah
  // sheetu během odjezdu neměnil (titulek, tlačítko Smazat) - zavření řídí
  // jen `sheetOpen`.
  const [editingPreset, setEditingPreset] = useState<PresetDef | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Každé otevření editoru je nová instance - viz PresetEditSheet.
  const [sheetKey, setSheetKey] = useState(0);
  const openEditor = (def: PresetDef | null) => {
    setSheetKey((k) => k + 1);
    setEditingPreset(def);
    setSheetOpen(true);
  };
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!confirmReset) return;
    const t = setTimeout(() => setConfirmReset(false), CONFIRM_RESET_MS);
    return () => clearTimeout(t);
  }, [confirmReset]);

  useEffect(() => {
    if (!editing) setConfirmReset(false);
  }, [editing]);

  const empty = presets.length === 0;
  // Prázdný seznam nabízí přidání rovnou, bez přepínání do úprav - jinak by
  // pod nadpisem nebylo nic, na co klepnout.
  const showAdd = editing || empty;

  const handleDelete = (def: PresetDef) => {
    setSheetOpen(false);
    manage.remove(def).then(
      () =>
        show(`Preset ${def.name} smazán.`, "success", 5000, {
          label: "Vrátit",
          onPress: () => {
            manage.restore(def).catch((e) =>
              show(errorMessage(e, "Preset se nepodařilo vrátit."), "error"),
            );
          },
        }),
      (e) => show(errorMessage(e, "Preset se nepodařilo smazat."), "error"),
    );
  };

  const handleReset = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setConfirmReset(false);
    setResetting(true);
    try {
      await manage.reset();
      show("Presety obnoveny.");
    } catch (e) {
      show(errorMessage(e, "Presety se nepodařilo obnovit."), "error");
    } finally {
      setResetting(false);
    }
  };

  return (
    <View className="w-full">
      {/* Hlavička stojí na stejné levé hraně jako řádky pod ní i jako
          hlavička seznamu přátel. Odsazení od okraje obrazovky řeší
          `paddingHorizontal` obrazovky, druhé odsazení tady bylo navíc. */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-gray-400 font-medium text-xs tracking-widest uppercase">
          Presety
        </Text>
        {/* Bez serverových id (výchozí náhrada, offline) není co upravovat. */}
        {manage.ready && !empty && (
          <Pressable
            onPress={() => onEditingChange(!editing)}
            accessibilityRole="button"
            hitSlop={10}
          >
            <Text className="text-gray-500 font-medium text-sm">
              {editing ? "Hotovo" : "Upravit"}
            </Text>
          </Pressable>
        )}
      </View>

      <View style={{ height: BOX_H }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          // Android jinak vnořené rolování ignoruje a gesto sebere obrazovka.
          nestedScrollEnabled
          onScroll={onScroll}
          scrollEventThrottle={16}
          onContentSizeChange={(_w, h) => setMore(h > BOX_H + 2)}
        >
          {presets.map((p) => {
            // V režimu úprav se nic nezvýrazňuje - klepnutí tu nevybírá.
            const active = !editing && p.date.getTime() === selected.getTime();
            return (
              <Pressable
                key={p.id}
                onPress={() => (editing ? openEditor(p) : onSelect(p.date))}
                accessibilityRole="button"
                accessibilityState={editing ? undefined : { selected: active }}
                accessibilityLabel={
                  editing
                    ? `Upravit preset ${p.label}, ${wallTime(p.minute)}`
                    : // Čas místo skloňovaného názvu: názvy si uživatel
                      // píše sám a "do ${label}" by dalo "do ráno".
                      `Volný do ${formatTime(p.date)}, ${p.label}`
                }
                style={{ height: ROW_H }}
                // Bez vodorovného odsazení, aby ikonka začínala tam, kde
                // v seznamu přátel začíná avatar (UserRow) - jinak by se
                // řádky při přepnutí stavu posunuly do strany.
                className="flex-row items-center active:bg-gray-50 border-b border-gray-50"
              >
                <View
                  className={cn(
                    "w-9 h-9 rounded-full items-center justify-center mr-3 border",
                    active
                      ? "bg-[#EE6C4D]/10 border-[#EE6C4D]"
                      : "bg-white border-gray-200",
                  )}
                >
                  <p.Icon
                    size={18}
                    color={active ? ORANGE : ICON}
                    strokeWidth={2}
                  />
                </View>

                <View className="flex-1">
                  <Text
                    className={cn(
                      "font-medium text-base leading-tight",
                      active ? "text-[#EE6C4D]" : "text-gray-900",
                    )}
                  >
                    {p.label}
                  </Text>
                  <Text className="text-gray-400 text-sm leading-tight">
                    {editing ? (
                      wallTime(p.minute)
                    ) : (
                      <>
                        {formatTime(p.date)}
                        {isTomorrow(p.date, now) ? " zítra" : ""}
                        {"  ·  "}
                        {formatDuration(minutesUntil(p.date, now))}
                      </>
                    )}
                  </Text>
                </View>

                {editing ? (
                  <ChevronRight size={18} color="#9CA3AF" strokeWidth={2} />
                ) : (
                  active && <Check size={18} color={ORANGE} strokeWidth={2.5} />
                )}
              </Pressable>
            );
          })}

          {showAdd && (
            <Pressable
              onPress={() => openEditor(null)}
              disabled={!manage.ready}
              accessibilityRole="button"
              style={{ height: ROW_H }}
              className="flex-row items-center active:bg-gray-50 border-b border-gray-50"
            >
              <View className="w-9 h-9 rounded-full items-center justify-center mr-3 border border-dashed border-gray-300">
                <Plus size={18} color={ORANGE} strokeWidth={2} />
              </View>
              <View className="flex-1">
                <Text className="text-[#EE6C4D] font-medium text-base leading-tight">
                  Přidat preset
                </Text>
                {empty && !editing && (
                  <Text className="text-gray-400 text-sm leading-tight">
                    Čas, do kterého bývá volno nejčastěji
                  </Text>
                )}
              </View>
            </Pressable>
          )}

          {editing && (
            <Pressable
              onPress={handleReset}
              disabled={resetting}
              accessibilityRole="button"
              style={{ height: ROW_H }}
              className="flex-row items-center active:opacity-60"
            >
              <View className="w-9 h-9 items-center justify-center mr-3">
                <RotateCcw size={16} color={confirmReset ? "#EF4444" : "#9CA3AF"} strokeWidth={2} />
              </View>
              <Text
                className={cn(
                  "text-sm font-medium",
                  confirmReset ? "text-red-500" : "text-gray-400",
                )}
              >
                {confirmReset
                  ? "Klepni znovu - vlastní presety se smažou"
                  : "Obnovit výchozí presety"}
              </Text>
            </Pressable>
          )}
        </ScrollView>

        {/* Vykouknutý řádek říká, že dole něco je; odstín říká, že to
            pokračuje dál. */}
        <BottomFade visible={more} />
      </View>

      <PresetEditSheet
        key={sheetKey}
        visible={sheetOpen}
        preset={editingPreset}
        all={manage.presets}
        onClose={() => setSheetOpen(false)}
        onSave={(input) =>
          editingPreset ? manage.update(editingPreset.id, input) : manage.create(input)
        }
        onDelete={handleDelete}
      />
    </View>
  );
}
