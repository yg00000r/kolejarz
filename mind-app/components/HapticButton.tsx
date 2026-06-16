import * as Haptics from 'expo-haptics';
import React from 'react';
import { TouchableOpacity, TouchableOpacityProps } from 'react-native';

interface Props extends TouchableOpacityProps {
  hapticStyle?: Haptics.ImpactFeedbackStyle;
}

export function HapticButton({
  onPress,
  hapticStyle = Haptics.ImpactFeedbackStyle.Light,
  activeOpacity = 0.6,
  ...props
}: Props) {
  const handlePress = (e: any) => {
    Haptics.impactAsync(hapticStyle);
    onPress?.(e);
  };

  return <TouchableOpacity {...props} onPress={handlePress} activeOpacity={activeOpacity} />;
}
