import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import BottomSheet from "./BottomSheet";
import Button from "./Button";
import TimeWheel from "./TimeWheel";
import { T_MAX, T_MIN } from "./TimeRing/scale";
import { formatTime, isTomorrow } from "../lib/time";
import { cn } from "../lib/utils";

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, m) => String(m).padStart(2, "0"));

type HM = { hour: number; minute: number };

const toHM = (d: Date): HM => ({ hour: d.getHours(), minute: d.getMinutes() });

/**
 * Nejbližší výskyt hh:mm **po** `after` - stejné pravidlo jako u denních
 * kotev (`resolvePresets`): zadává se čas na hodinách, den z něj vyplyne.
 */
function nextOccurrence({ hour, minute }: HM, after: Date): Date {
  const d = new Date(after);
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= after.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

type Props = {
  visible: boolean;
  onClose: () => void;
  now: Date;
  /** Začátek, od kterého se edituje; `null` = teď. */
  start: Date | null;
  end: Date;
  /** Volá se jen s platnými hodnotami - konec aspoň `T_MIN` po začátku a obojí do 24 h. */
  onSave: (start: Date | null, end: Date) => void;
};

/**
 * Přesné zadání času na minuty (task 0010) - pro ty, komu nestačí čárky
 * prstence. Otevírá se klepnutím na popisek s časem nad prstencem, takže
 * běžný uživatel minuty vůbec nevidí.
 *
 * Volající sheet při každém otevření přemontuje (`key`), stejně jako
 * `PresetEditSheet` - kolečka se jinak namontují se starým časem a jejich
 * opožděný scroll event nový čas přepíše.
 */
export default function TimeEditSheet({
  visible,
  onClose,
  now,
  start,
  end,
  onSave,
}: Props) {
  const [later, setLater] = useState(start !== null);
  const [from, setFrom] = useState<HM>(() =>
    toHM(start ?? new Date(now.getTime() + 60 * 60_000)),
  );
  const [to, setTo] = useState<HM>(() => toHM(end));

  // Začátek "teď" se počítá až při uložení - sheet může být otevřený déle.
  const startDate = later ? nextOccurrence(from, now) : null;
  const endDate = nextOccurrence(to, startDate ?? now);
  const max = new Date(now.getTime() + T_MAX * 60_000);
  const length = (endDate.getTime() - (startDate ?? now).getTime()) / 60_000;

  const error =
    endDate > max
      ? `Nejpozději do ${formatTime(max)}${isTomorrow(max, now) ? " zítra" : ""}.`
      : length < T_MIN
        ? `Volno musí trvat aspoň ${T_MIN} minut.`
        : null;

  const dayHint = (d: Date) => (isTomorrow(d, now) ? "zítra" : "dnes");

  const save = () => {
    if (error) return;
    onSave(startDate, endDate);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text className="text-gray-900 text-xl font-bold mb-5">Přesný čas</Text>

      <View className="flex-row items-center justify-between mb-1 ml-1">
        <Text className="text-gray-500 text-sm font-medium">Od</Text>
        <View className="flex-row bg-gray-100 rounded-full p-0.5">
          {[false, true].map((value) => (
            <Pressable
              key={String(value)}
              onPress={() => setLater(value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: later === value }}
              className={cn(
                "px-3 py-1 rounded-full",
                later === value ? "bg-white" : "active:opacity-70",
              )}
            >
              <Text
                className={cn(
                  "text-sm",
                  later === value ? "text-gray-900 font-medium" : "text-gray-500",
                )}
              >
                {value ? "Později" : "Teď"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      {later && startDate && (
        <TimeRow
          value={from}
          onChange={setFrom}
          hint={dayHint(startDate)}
          label="Začátek"
        />
      )}

      <Text className="text-gray-500 text-sm font-medium mb-1 ml-1 mt-4">Do</Text>
      <TimeRow value={to} onChange={setTo} hint={dayHint(endDate)} label="Konec" />

      <Text
        className="text-red-500 text-xs text-center mt-2 mb-3"
        style={{ minHeight: 16 }}
        accessibilityLiveRegion="polite"
      >
        {error ?? ""}
      </Text>

      <Button label="Uložit" onPress={save} disabled={!!error} />
    </BottomSheet>
  );
}

function TimeRow({
  value,
  onChange,
  hint,
  label,
}: {
  value: HM;
  onChange: (v: HM) => void;
  hint: string;
  label: string;
}) {
  return (
    <View className="flex-row items-center justify-center">
      <TimeWheel
        items={HOURS}
        index={value.hour}
        onChange={(hour) => onChange({ ...value, hour })}
        accessibilityLabel={`${label}, hodina`}
      />
      <Text className="text-gray-900 text-3xl font-bold mx-1">:</Text>
      <TimeWheel
        items={MINUTES}
        index={value.minute}
        onChange={(minute) => onChange({ ...value, minute })}
        accessibilityLabel={`${label}, minuta`}
      />
      <Text className="text-gray-400 text-sm ml-3 w-10">{hint}</Text>
    </View>
  );
}
