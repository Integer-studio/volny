import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { cn } from '../lib/utils';

type Variant = 'primary' | 'secondary' | 'destructive' | 'destructiveOutline';

const containerClass: Record<Variant, string> = {
  primary: 'bg-[#EE6C4D]',
  secondary: 'bg-gray-100',
  destructive: 'bg-red-500',
  destructiveOutline: 'border border-red-200 active:bg-red-50',
};

const textClass: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-gray-700',
  destructive: 'text-white',
  destructiveOutline: 'text-red-500',
};

const contentColor: Record<Variant, string> = {
  primary: '#fff',
  secondary: '#333',
  destructive: '#fff',
  destructiveOutline: '#ef4444',
};

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: LucideIcon;
  /** Běžící akce: spinner, tlačítko nejde zmáčknout, šířka zůstává. */
  loading?: boolean;
  disabled?: boolean;
  /** Doplňující třídy kontejneru, typicky rozložení (`flex-1`, `mr-2`). */
  className?: string;
  accessibilityLabel?: string;
};

/**
 * Sdílené tlačítko appky (task 0030) - místo Pressable skládaného na každé
 * obrazovce znovu. Během `loading` je zablokované, takže dvojťuk nepošle
 * dva requesty. Nativecn `components/ui/button` vychází ze shadcn tokenů,
 * které appka nepoužívá, proto vlastní komponenta.
 */
export default function Button({
  label,
  onPress,
  variant = 'primary',
  icon: Icon,
  loading = false,
  disabled = false,
  className,
  accessibilityLabel,
}: Props) {
  const color = contentColor[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      className={cn(
        'flex-row items-center justify-center py-3 px-5 rounded-xl active:opacity-80',
        containerClass[variant],
        disabled && !loading && 'opacity-50',
        className,
      )}
    >
      {Icon ? (
        // S ikonou se spinner ukáže místo ní a popisek zůstane.
        <>
          {loading ? <ActivityIndicator size="small" color={color} /> : <Icon size={16} color={color} />}
          <Text className={cn('font-medium ml-2', textClass[variant])}>{label}</Text>
        </>
      ) : (
        // Bez ikony spinner překryje popisek, který jen zprůhlední - šířka
        // tlačítka se tak během akce nemění.
        <>
          <Text className={cn('font-medium', textClass[variant], loading && 'opacity-0')}>{label}</Text>
          {loading && (
            <View className="absolute inset-0 items-center justify-center">
              <ActivityIndicator size="small" color={color} />
            </View>
          )}
        </>
      )}
    </Pressable>
  );
}
