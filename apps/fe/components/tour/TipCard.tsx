import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { chapterOf, TOUR_CHAPTERS, type TourStep } from '../../lib/tour';
import { EMBER, PAPER, TRACK } from './colors';

type Props = {
  step: TourStep;
  title: string;
  body?: string;
  action?: string;
  onAction?: () => void;
  onSkip: () => void;
  /** Zobáček ukazující na cíl. Bez něj (např. uvnitř ProfileSheet) karta stojí sama. */
  notch?: { side: 'top' | 'bottom'; x: number };
  /** Varianta s akcentovým lemem pro místa, kde karta neleží na ztmavení. */
  outlined?: boolean;
};

const NOTCH = 12;

/**
 * Karta nápovědy průvodce. Tečky vpravo nahoře znamenají kapitoly (hlavní
 * stránka, přátelé, skupiny, kontakt), ne jednotlivé kroky.
 */
export default function TipCard({ step, title, body, action, onAction, onSkip, notch, outlined }: Props) {
  const chapter = chapterOf(step);

  return (
    <View
      accessibilityLiveRegion="polite"
      className={`bg-[#FCFBF8] rounded-[20px] px-[18px] pt-4 pb-3 ${outlined ? 'border-[1.5px] border-[#EE6C4D]' : ''}`}
    >
      {notch && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: notch.x - NOTCH / 2,
            [notch.side]: -NOTCH / 2 + 1,
            width: NOTCH,
            height: NOTCH,
            backgroundColor: PAPER,
            borderRadius: 2,
            transform: [{ rotate: '45deg' }],
          }}
        />
      )}

      <View className="flex-row items-start">
        <Text accessibilityRole="header" className="flex-1 text-[#2B2724] text-[17px] leading-6 font-semibold max-w-[340px]">
          {title}
        </Text>
        {chapter >= 0 && (
          <View
            className="flex-row gap-[5px] ml-3 mt-[9px]"
            accessibilityLabel={`Část ${chapter + 1} ze ${TOUR_CHAPTERS.length}`}
          >
            {TOUR_CHAPTERS.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === chapter ? 14 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: i <= chapter ? EMBER : TRACK,
                }}
              />
            ))}
          </View>
        )}
      </View>

      {body ? (
        <Text className="text-[#2B2724]/70 text-[15px] leading-[22px] mt-1 max-w-[340px]">
          {body}
        </Text>
      ) : null}

      <View className="flex-row items-center justify-between mt-2.5">
        <Pressable onPress={onSkip} hitSlop={8} accessibilityRole="button" className="py-1.5">
          <Text className="text-[#2B2724]/50 text-sm">Přeskočit průvodce</Text>
        </Pressable>
        {action && onAction ? (
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            className="bg-[#EE6C4D] rounded-full px-[18px] py-[9px] active:opacity-80"
          >
            <Text className="text-white font-semibold text-[15px]">{action}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
