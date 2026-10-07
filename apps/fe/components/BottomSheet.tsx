import React, { useEffect, useState } from "react";
import { Animated, Modal, Pressable, View, useWindowDimensions } from "react-native";
import { ToastHost } from "./Toast";

type Props = {
  visible: boolean;
  onClose: () => void;
  /**
   * false = scrim ani Zpět na Androidu sheet nezavřou. Pro dobu, kdy běží
   * akce, jejíž výsledek by se po zavření ztratil (join, mazání...).
   */
  dismissable?: boolean;
  children: React.ReactNode;
};

/**
 * Shared bottom sheet: an RN Modal (native fade for the whole thing) plus a
 * tap-to-close scrim and an inner Animated.View that slides up on open /
 * down on close independently of the modal's own fade.
 *
 * Extracted from the free-until time picker in app/index.tsx (its first
 * caller, kept wired up below) so the group invite QR sheet and the profile
 * popup can reuse the exact same look/feel instead of duplicating it.
 */
export default function BottomSheet({ visible, onClose, dismissable = true, children }: Props) {
  // Odjezd o výšku obrazovky, ne o pevný kus: vyšší sheet (editor presetu)
  // jinak dojel jen do půlky a zbytek pak zmizel modalovým fade - vypadalo
  // to jako průsvitný sheet přes obrazovku.
  const { height: offscreen } = useWindowDimensions();
  const [slideAnim] = useState(new Animated.Value(offscreen));

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : offscreen,
      duration: visible ? 300 : 250,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  const handleClose = () => {
    if (!dismissable) return;
    Animated.timing(slideAnim, {
      toValue: offscreen,
      duration: 250,
      useNativeDriver: true,
    }).start(() => onClose());
  };

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={handleClose}
    >
      <View className="flex-1 justify-end">
        <Pressable
          className="absolute top-0 bottom-0 left-0 right-0 bg-black/40"
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Zavřít"
        />

        <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
          <View className="bg-[#FCFBF8] rounded-t-[32px] pt-8 pb-10 px-8 shadow-xl">
            {children}
          </View>
        </Animated.View>

        {/* Toast nad sheetem - host v kořeni appky je pod Modalem. */}
        {visible && <ToastHost />}
      </View>
    </Modal>
  );
}
