import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';
import { useColors } from '../contexts/ThemeContext';

type Props = {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  subtitle?: string;
  /** Tint; defaults to the theme accent. */
  color?: string;
};

/**
 * Empty/placeholder state with a gently pulsing icon and a fade-in.
 * Uses the core React Native `Animated` API (no extra native deps), so it works
 * in Expo Go and over-the-air on a Personal Team build.
 */
export function AnimatedEmptyState({ icon, title, subtitle, color }: Props) {
  const colors = useColors();
  const tint = color ?? colors.accent;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.12, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, scale]);

  return (
    <Animated.View style={[styles.wrap, { opacity }]}>
      <Animated.View style={[styles.iconWrap, { backgroundColor: tint + '18', transform: [{ scale }] }]}>
        <MaterialCommunityIcons name={icon} size={40} color={tint} />
      </Animated.View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.sub, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  iconWrap: {
    width: 84, height: 84, borderRadius: 42,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  sub: { fontSize: 13, textAlign: 'center', maxWidth: 280, lineHeight: 19 },
});
