import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useToast } from '../components/Toast';
import FormField from '../components/FormField';
import { fieldError, errorMessage } from '../lib/errors';
import { useAutosaveField } from '../hooks/useAutosaveField';
import { useSlowActionNotice } from '../hooks/useSlowActionNotice';

function validateUsername(v: string): string | null {
  if (v.length < 3 || v.length > 50) return 'Uživatelské jméno musí mít 3-50 znaků.';
  if (!/^[a-zA-Z0-9._-]+$/.test(v)) return 'Jen písmena, čísla, tečka, pomlčka a podtržítko.';
  return null;
}
function validateName(v: string): string | null {
  if (v.length < 1 || v.length > 100) return 'Jméno musí mít 1-100 znaků.';
  return null;
}
function validatePassword(v: string): string | null {
  if (v.length < 4 || v.length > 128) return 'Heslo musí mít 4-128 znaků.';
  return null;
}
function validatePhone(v: string): string | null {
  if (v.length === 0) return null; // empty clears the field, allowed
  if (!/^[0-9+ ]+$/.test(v) || v.length > 32) return 'Jen číslice, mezery a +, max. 32 znaků.';
  return null;
}
function validateInstagram(v: string): string | null {
  if (v.length === 0) return null;
  if (!/^[a-zA-Z0-9._]+$/.test(v) || v.length > 64) return 'Jen písmena, čísla, tečka a podtržítko, bez @.';
  return null;
}

export default function Settings() {
  const { me, refreshMe, signOut } = useAuth();
  const { show } = useToast();

  const nameField = useAutosaveField({
    initial: me?.name ?? '',
    validate: validateName,
    save: async (value) => {
      await api.updateProfile({ name: value });
      await refreshMe();
    },
    serverError: (e) => fieldError(e, 'name') ?? errorMessage(e, 'Uložení se nezdařilo.'),
  });

  const usernameField = useAutosaveField({
    initial: me?.username ?? '',
    validate: validateUsername,
    save: async (value) => {
      await api.updateProfile({ username: value });
      await refreshMe();
    },
    serverError: (e) => {
      if (e instanceof ApiError && e.status === 409) return errorMessage(e, 'Toto uživatelské jméno je již obsazené.');
      return fieldError(e, 'username') ?? errorMessage(e, 'Uložení se nezdařilo.');
    },
  });

  const phoneField = useAutosaveField({
    initial: me?.phone ?? '',
    validate: validatePhone,
    save: async (value) => {
      await api.updateProfile({ phone: value });
      await refreshMe();
    },
    serverError: (e) => fieldError(e, 'phone') ?? errorMessage(e, 'Uložení se nezdařilo.'),
  });

  const instagramField = useAutosaveField({
    initial: me?.instagram ?? '',
    validate: validateInstagram,
    save: async (value) => {
      await api.updateProfile({ instagram: value });
      await refreshMe();
    },
    serverError: (e) => fieldError(e, 'instagram') ?? errorMessage(e, 'Uložení se nezdařilo.'),
  });

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [passwordSaving, setPasswordSaving] = useState(false);
  useSlowActionNotice(passwordSaving);

  const [confirmingLogout, setConfirmingLogout] = useState(false);

  const savePassword = async () => {
    const errs: typeof passwordErrors = {};
    if (!currentPassword) errs.current = 'Zadej současné heslo.';
    const nextErr = validatePassword(newPassword);
    if (nextErr) errs.next = nextErr;
    else if (newPassword === currentPassword) errs.next = 'Nové heslo musí být jiné než současné.';
    if (confirmPassword !== newPassword) errs.confirm = 'Hesla se neshodují.';
    setPasswordErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setPasswordSaving(true);
    try {
      await api.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      show('Heslo změněno.');
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) {
        const currentErr = fieldError(e, 'currentPassword');
        const nextErr = fieldError(e, 'newPassword');
        if (currentErr || nextErr || e.serverMessage) {
          setPasswordErrors({ current: currentErr ?? e.serverMessage ?? undefined, next: nextErr ?? undefined });
        } else {
          setPasswordErrors({ current: 'Současné heslo není správné.' });
        }
      } else {
        show(errorMessage(e, 'Změna hesla se nezdařila.'), 'error');
      }
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-[#FCFBF8] px-6 pt-4" contentContainerStyle={{ paddingBottom: 48 }}>
      <FormField
        label="Jméno"
        value={nameField.value}
        onChangeText={nameField.onChangeText}
        onBlur={nameField.onBlur}
        autoCapitalize="words"
        autoComplete="name"
        error={nameField.error}
        state={nameField.state}
        containerClassName="mb-8"
      />

      <FormField
        label="Handle"
        value={usernameField.value}
        onChangeText={usernameField.onChangeText}
        onBlur={usernameField.onBlur}
        autoCapitalize="none"
        autoComplete="username"
        error={usernameField.error}
        state={usernameField.state}
        containerClassName="mb-8"
      />

      <Text className="text-gray-400 text-xs font-bold tracking-widest mb-3">KONTAKT</Text>
      <Text className="text-gray-400 text-xs mb-4 -mt-2">
        Vidí ho jen přátelé a spolučlenové skupin, nikdo jiný.
      </Text>

      <FormField
        label="Telefon"
        value={phoneField.value}
        onChangeText={phoneField.onChangeText}
        onBlur={phoneField.onBlur}
        keyboardType="phone-pad"
        autoComplete="tel"
        error={phoneField.error}
        state={phoneField.state}
        containerClassName="mb-8"
      />

      <FormField
        label="Instagram"
        prefix="@"
        value={instagramField.value}
        onChangeText={(v) => instagramField.onChangeText(v.replace(/^@+/, ''))}
        onBlur={instagramField.onBlur}
        autoCapitalize="none"
        error={instagramField.error}
        state={instagramField.state}
        containerClassName="mb-8"
      />

      <Text className="text-gray-400 text-xs font-bold tracking-widest mb-3">ZMĚNA HESLA</Text>
      <FormField label="Současné heslo" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry autoComplete="current-password" textContentType="password" error={passwordErrors.current} />
      <FormField label="Nové heslo" value={newPassword} onChangeText={setNewPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" error={passwordErrors.next} />
      <FormField label="Nové heslo znovu" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" error={passwordErrors.confirm} />
      <Pressable onPress={savePassword} disabled={passwordSaving} className="bg-gray-900 py-3 rounded-xl items-center active:opacity-80 mb-10">
        {passwordSaving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-medium">Změnit heslo</Text>}
      </Pressable>

      <View className="border-t border-gray-100 pt-6">
        {!confirmingLogout ? (
          <Pressable onPress={() => setConfirmingLogout(true)} className="border border-red-200 py-3 rounded-xl items-center active:bg-red-50">
            <Text className="text-red-500 font-medium">Odhlásit se</Text>
          </Pressable>
        ) : (
          <View>
            <Text className="text-gray-600 text-center mb-3">Opravdu se chceš odhlásit?</Text>
            <View className="flex-row">
              <Pressable onPress={() => setConfirmingLogout(false)} className="flex-1 bg-gray-100 py-3 rounded-xl items-center mr-2 active:opacity-80">
                <Text className="text-gray-700 font-medium">Zrušit</Text>
              </Pressable>
              <Pressable onPress={signOut} className="flex-1 bg-red-500 py-3 rounded-xl items-center ml-2 active:opacity-80">
                <Text className="text-white font-medium">Odhlásit</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
