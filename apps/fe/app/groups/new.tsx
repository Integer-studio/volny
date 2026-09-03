import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import FormField from '../../components/FormField';
import { fieldError, errorMessage } from '../../lib/errors';

export default function NewGroup() {
  const { show } = useToast();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 100) {
      setError('Název musí mít 1-100 znaků.');
      return;
    }
    setSaving(true);
    try {
      const detail = await api.createGroup(trimmed);
      router.replace(`/groups/${detail.id}`);
    } catch (e) {
      const err = fieldError(e, 'name');
      if (err) setError(err);
      else show(errorMessage(e, 'Vytvoření skupiny se nezdařilo.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-[#FCFBF8] px-6 pt-4">
      <Text className="text-gray-500 mb-6">
        Členové skupiny uvidí, kdo je právě volný, i bez toho, aby museli být přátelé.
      </Text>
      <FormField label="Název skupiny" value={name} onChangeText={setName} autoCapitalize="words" error={error} />
      <Pressable
        onPress={handleCreate}
        disabled={saving}
        className="bg-[#EE6C4D] py-4 rounded-xl items-center active:opacity-80 mt-2"
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-base">Vytvořit</Text>}
      </Pressable>
    </View>
  );
}
