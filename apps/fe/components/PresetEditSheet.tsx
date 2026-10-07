import React, { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import BottomSheet from "./BottomSheet";
import FormField from "./FormField";
import TimeWheel from "./TimeWheel";
import { PRESET_ICONS, PresetDef } from "./TimeRing/presets";
import { ApiError, PresetInput } from "../lib/api";
import { errorMessage, fieldError } from "../lib/errors";
import { cn } from "../lib/utils";

const ORANGE = "#EE6C4D";
const ICON = "#5A5550";
const NAME_MAX = 30;
const DUPLICATE_TIME = "V tenhle čas už máš jiný preset.";

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
const QUARTERS = [0, 15, 30, 45];
const MINUTES = QUARTERS.map((m) => String(m).padStart(2, "0"));
const ICON_KEYS = Object.keys(PRESET_ICONS);

type Draft = { name: string; icon: string; hour: number; quarter: number };

/** Nový preset: příští celá hodina, která ještě není obsazená. */
function newDraft(taken: Set<number>): Draft {
  const start = (new Date().getHours() + 1) % 24;
  for (let i = 0; i < 24; i++) {
    const hour = (start + i) % 24;
    if (!taken.has(hour * 60)) return { name: "", icon: "coffee", hour, quarter: 0 };
  }
  return { name: "", icon: "coffee", hour: start, quarter: 1 };
}

function fromDef(d: PresetDef): Draft {
  return {
    name: d.name,
    icon: d.icon,
    hour: Math.floor(d.minute / 60),
    quarter: Math.max(0, QUARTERS.indexOf(d.minute % 60)),
  };
}

type Props = {
  visible: boolean;
  /** Upravovaný preset; `null` = nový. */
  preset: PresetDef | null;
  /** Všechny presety - kvůli kontrole, že čas není obsazený. */
  all: PresetDef[];
  onClose: () => void;
  onSave: (input: PresetInput) => Promise<unknown>;
  onDelete: (preset: PresetDef) => void;
};

/**
 * Úprava jednoho presetu: název, čas na čtvrthodiny (stejný krok jako
 * prstenec) a ikonka z pevné sady. Ukládá se až tlačítkem, ne průběžně -
 * rozpracovaný preset by se jinak mezitím objevoval na prstenci.
 *
 * Volající ho při každém otevření přemontuje (`key`), takže rozpracovaný
 * stav začíná vždy od uloženého presetu. Resetovat ho až efektem nestačilo:
 * kolečka se napřed namontovala se starým časem a jejich opožděný scroll
 * event pak nový čas přepsal.
 */
export default function PresetEditSheet({
  visible,
  preset,
  all,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const taken = new Set(
    all.filter((p) => p.id !== preset?.id).map((p) => p.minute),
  );
  const [draft, setDraft] = useState<Draft>(() =>
    preset ? fromDef(preset) : newDraft(taken),
  );
  const [nameError, setNameError] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const minute = draft.hour * 60 + QUARTERS[draft.quarter];
  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    if ("hour" in patch || "quarter" in patch) setTimeError(null);
    if ("name" in patch) setNameError(null);
    setFormError(null);
  };

  const save = async () => {
    const name = draft.name.trim();
    let invalid = false;
    if (!name) {
      setNameError("Zadej název.");
      invalid = true;
    }
    if (taken.has(minute)) {
      setTimeError(DUPLICATE_TIME);
      invalid = true;
    }
    if (invalid) return;

    setSaving(true);
    try {
      await onSave({ name, icon: draft.icon, minute });
      onClose();
    } catch (e) {
      setSaving(false);
      if (e instanceof ApiError && e.status === 409) {
        setTimeError(e.serverMessage ?? DUPLICATE_TIME);
        return;
      }
      const nameMsg = fieldError(e, "name");
      if (nameMsg) setNameError(nameMsg);
      else setFormError(errorMessage(e, "Preset se nepodařilo uložit."));
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text className="text-gray-900 text-xl font-bold mb-5">
        {preset ? "Upravit preset" : "Nový preset"}
      </Text>

      <FormField
        label="Název"
        value={draft.name}
        onChangeText={(name) => set({ name })}
        placeholder="Třeba Oběd"
        maxLength={NAME_MAX}
        autoCapitalize="sentences"
        returnKeyType="done"
        error={nameError}
        containerClassName="mb-4"
      />

      <Text className="text-gray-500 text-sm font-medium mb-1 ml-1">Čas</Text>
      <View className="flex-row items-center justify-center">
        <TimeWheel
          items={HOURS}
          index={draft.hour}
          onChange={(hour) => set({ hour })}
          accessibilityLabel="Hodina"
        />
        <Text className="text-gray-900 text-3xl font-bold mx-1">:</Text>
        <TimeWheel
          items={MINUTES}
          index={draft.quarter}
          onChange={(quarter) => set({ quarter })}
          accessibilityLabel="Minuta"
        />
      </View>
      <Text
        className="text-red-500 text-xs text-center mt-1 mb-3"
        style={{ minHeight: 16 }}
        accessibilityLiveRegion="polite"
      >
        {timeError ?? ""}
      </Text>

      <Text className="text-gray-500 text-sm font-medium mb-2 ml-1">Ikonka</Text>
      <View className="flex-row flex-wrap justify-between mb-6">
        {ICON_KEYS.map((key) => {
          const Icon = PRESET_ICONS[key];
          const active = key === draft.icon;
          return (
            // 5 sloupců - šířka přes procenta, aby mřížka seděla na každé
            // šířce sheetu.
            <View key={key} style={{ width: "20%" }} className="items-center mb-2">
              <Pressable
                onPress={() => set({ icon: key })}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={key}
                hitSlop={4}
                className={cn(
                  "w-11 h-11 rounded-full items-center justify-center border",
                  active
                    ? "bg-[#EE6C4D]/10 border-[#EE6C4D]"
                    : "bg-white border-gray-200 active:bg-gray-50",
                )}
              >
                <Icon size={20} color={active ? ORANGE : ICON} strokeWidth={2} />
              </Pressable>
            </View>
          );
        })}
      </View>

      {formError && (
        <Text className="text-red-500 text-sm text-center mb-3">{formError}</Text>
      )}

      <Pressable
        onPress={save}
        disabled={saving}
        accessibilityRole="button"
        className="bg-gray-900 py-3 rounded-xl items-center active:opacity-80"
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-medium">Uložit</Text>
        )}
      </Pressable>

      {preset && (
        <Pressable
          onPress={() => onDelete(preset)}
          disabled={saving}
          accessibilityRole="button"
          className="py-3 mt-2 items-center active:opacity-60"
        >
          <Text className="text-red-500 font-medium">Smazat preset</Text>
        </Pressable>
      )}
    </BottomSheet>
  );
}
