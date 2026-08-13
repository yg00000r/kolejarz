import React, { useEffect, useRef, useState } from 'react';
import { Animated, DimensionValue, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme, useColors } from '../contexts/ThemeContext';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A shimmering placeholder block. Uses a moving highlight band animated with
 * the core React Native `Animated` API (no extra native deps), so it works
 * over-the-air and on a free Personal Team build.
 */
export function Skeleton({ width = '100%', height = 14, radius = 8, style }: SkeletonProps) {
  const { isDark } = useTheme();
  const colors = useColors();
  const [w, setW] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (w === 0) return;
    const anim = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1100,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [w, progress]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-w, w] });

  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.surfaceSecondary, overflow: 'hidden' }, style]}
    >
      {w > 0 && (
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
          <View style={[styles.band, { backgroundColor: colors.surface }]} />
        </Animated.View>
      )}
    </View>
  );
}

/** Placeholder shaped like a list row: icon circle + two lines + trailing value. */
export function SkeletonRow() {
  const { isDark } = useTheme();
  const colors = useColors();
  return (
    <View style={[styles.row, { backgroundColor: colors.surface }]}>
      <Skeleton width={40} height={40} radius={20} />
      <View style={styles.rowLines}>
        <Skeleton width="70%" height={13} />
        <Skeleton width="40%" height={11} />
      </View>
      <Skeleton width={54} height={18} radius={6} />
    </View>
  );
}

/** Renders `count` skeleton rows with consistent spacing. */
export function SkeletonList({ count = 6 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  band: { width: '55%', height: '100%', opacity: 0.55 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, padding: 14, gap: 12,
  },
  rowLines: { flex: 1, gap: 7 },
  list: { paddingHorizontal: 16, gap: 8 },
});
