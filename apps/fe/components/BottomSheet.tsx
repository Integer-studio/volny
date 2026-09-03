import React, { useEffect, useState } from "react";
import { Animated, Modal, Pressable, View } from "react-native";

type Props = {
  visible: boolean;
  onClose: () => void;
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
export default function BottomSheet({ visible, onClose, children }: Props) {
  const [slideAnim] = useState(new Animated.Value(400));

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : 400,
      duration: visible ? 300 : 250,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: 400,
      duration: 200,
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
        />

        <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
          <View className="bg-[#FCFBF8] rounded-t-[32px] pt-8 pb-10 px-8 shadow-xl">
            {children}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
