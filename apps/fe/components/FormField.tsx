import React, { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, TextInput, TextInputProps, View } from 'react-native';
import Check from 'lucide-react-native/icons/check';
import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import type { FieldState } from '../hooks/useAutosaveField';

type FormFieldProps = TextInputProps & {
  label: string;
  error?: string | null;
  /** Overrides the outer wrapper's default `mb-4` - e.g. to zero it out when a sibling button must align to the input's own bottom edge. */
  containerClassName?: string;
  /** Autosave status indicator shown at the right edge of the input. Never used together with secureTextEntry - a field with a password toggle never autosaves. */
  state?: FieldState;
  /** Fixed, non-editable text rendered inside the input's left edge (e.g. "@" for a handle field the user can't type/delete themselves). */
  prefix?: string;
};

// Browser password managers (Chrome, Bitwarden, 1Password, ...) inject their
// own icon into the same top-right corner of a password field. A second,
// app-owned icon there either overlaps it or makes the manager back off from
// rendering its own UI at all - reported as "the password manager stopped
// working". Only offer the reveal toggle on native, where there's no
// competing OS-level icon in that exact spot; web relies on the browser's
// own reveal-password affordance instead.
const showRevealToggle = Platform.OS !== 'web';

export default function FormField({ label, error, containerClassName, state, prefix, secureTextEntry, ...inputProps }: FormFieldProps) {
  const [visible, setVisible] = useState(false);
  const isPassword = !!secureTextEntry;
  const showToggle = isPassword && showRevealToggle;
  // A password field's reveal toggle and an autosave state indicator would
  // occupy the same corner - password fields never autosave, so this should
  // never actually collide, but guard it explicitly rather than by luck.
  const showStateIndicator = !!state && state !== 'idle' && !isPassword;

  return (
    <View className={containerClassName ?? 'mb-4'}>
      <Text className="text-gray-500 text-sm font-medium mb-1 ml-1">{label}</Text>
      <View className="relative justify-center">
        {prefix && (
          <Text className="absolute left-4 text-base text-gray-400" pointerEvents="none">
            {prefix}
          </Text>
        )}
        <TextInput
          className={`bg-white px-4 py-3 rounded-xl border text-base ${prefix ? 'pl-9' : ''} ${(showToggle || showStateIndicator) ? 'pr-11' : ''} ${error ? 'border-red-400' : 'border-gray-200'}`}
          secureTextEntry={isPassword && !visible}
          {...inputProps}
        />
        {showToggle && (
          <Pressable
            onPress={() => setVisible(v => !v)}
            hitSlop={8}
            className="absolute right-3"
          >
            {visible ? <EyeOff size={20} color="#888" /> : <Eye size={20} color="#888" />}
          </Pressable>
        )}
        {showStateIndicator && (
          <View className="absolute right-3">
            {state === 'saving' && <ActivityIndicator size="small" color="#888" />}
            {state === 'saved' && <Check size={20} color="#22c55e" />}
          </View>
        )}
      </View>
      {error ? <Text className="text-red-500 text-sm mt-1 ml-1">{error}</Text> : null}
    </View>
  );
}
