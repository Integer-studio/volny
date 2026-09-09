import React, { useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Check from "lucide-react-native/icons/check";
import BottomFade from "./BottomFade";
import { Preset } from "./TimeRing/presets";
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

export const PRESET_LIST_H = BOX_H + HEADER_H;

type Props = {
  presets: Preset[];
  now: Date;
  /** Aktuální hodnota prstence - podle ní se zvýrazní odpovídající preset. */
  selected: Date;
  onSelect: (target: Date) => void;
};

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
 * Zbytek obrazovky tak zůstává na místě, i kdyby presetů byla řada. Až přijde
 * jejich editace a přidávání (task 0009), přibudou sem řádky/akce a strop se
 * nemusí hýbat; data se berou z `TimeRing/presets.ts`, který je pro tu výměnu
 * jediné místo.
 */
export default function PresetList({ presets, now, selected, onSelect }: Props) {
  // Odstín u dolní hrany má smysl jen když se dá rolovat a zbývá kam - jinak
  // by slíbil obsah, který tam není.
  const [more, setMore] = useState(false);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    setMore(contentOffset.y + layoutMeasurement.height < contentSize.height - 2);
  };

  if (presets.length === 0) return null;

  return (
    <View className="w-full">
      {/* Hlavička stojí na stejné levé hraně jako řádky pod ní i jako
          hlavička seznamu přátel. Odsazení od okraje obrazovky řeší
          `paddingHorizontal` obrazovky, druhé odsazení tady bylo navíc. */}
      <Text className="text-gray-400 font-medium text-xs tracking-widest uppercase mb-2">
        Rychlá volba
      </Text>

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
            const active = p.date.getTime() === selected.getTime();
            return (
              <Pressable
                key={p.id}
                onPress={() => onSelect(p.date)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Volný do ${p.label.toLowerCase()}, ${formatTime(p.date)}`}
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
                    {formatTime(p.date)}
                    {isTomorrow(p.date, now) ? " zítra" : ""}
                    {"  ·  "}
                    {formatDuration(minutesUntil(p.date, now))}
                  </Text>
                </View>

                {active && <Check size={18} color={ORANGE} strokeWidth={2.5} />}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Vykouknutý řádek říká, že dole něco je; odstín říká, že to
            pokračuje dál. */}
        <BottomFade visible={more} />
      </View>
    </View>
  );
}
