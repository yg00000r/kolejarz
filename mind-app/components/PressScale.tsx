import * as Haptics from 'expo-haptics';
import React, { useRef } from 'react';
import { Animated, GestureResponderEvent, Pressable, StyleProp, ViewStyle } from 'react-native';

interface Props {
  onPress?: (e: GestureResponderEvent) => void;
  onLongPress?: (e: GestureResponderEvent) => void;
  onPressIn?: (e: GestureResponderEvent) => void;
  onPressOut?: (e: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  scale?: number;
  haptic?: Haptics.ImpactFeedbackStyle | null;
  disabled?: boolean;
  hitSlop?: number;
  children?: React.ReactNode;
}

/**
 * Drop-in replacement for TouchableOpacity.
 * Adds spring scale feedback + haptics on every press.
 * Style is applied to the inner Animated.View so the whole card scales.
 */
export function PressScale({
  scale = 0.96,
  haptic = Haptics.ImpactFeedbackStyle.Light,
  onPress,
  onLongPress,
  onPressIn,
  onPressOut,
  disabled,
  hitSlop,
  style,
  children,
}: Props) {
  const anim = useRef(new Animated.Value(1)).current;

  const handlePressIn = (e: GestureResponderEvent) => {
    Animated.spring(anim, { toValue: scale, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
    onPressIn?.(e);
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 5 }).start();
    onPressOut?.(e);
  };

  const handlePress = (e: GestureResponderEvent) => {
    if (haptic !== null) Haptics.impactAsync(haptic ?? Haptics.ImpactFeedbackStyle.Light);
    onPress?.(e);
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={hitSlop}
    >
      <Animated.View style={[style, { transform: [{ scale: anim }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
