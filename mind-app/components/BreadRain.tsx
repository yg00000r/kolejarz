import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, Text, View } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const COUNT = 28;
const EMOJI = '🍞';

type Drop = {
  x: number;
  size: number;
  delay: number;
  duration: number;
  rotate: number;
  fall: Animated.Value;
};

function makeDrops(): Drop[] {
  return Array.from({ length: COUNT }, () => ({
    x: Math.random() * SCREEN_W,
    size: 22 + Math.random() * 26,
    delay: Math.random() * 1400,
    duration: 2600 + Math.random() * 1800,
    rotate: (Math.random() - 0.5) * 2,
    fall: new Animated.Value(0),
  }));
}

/**
 * Full-screen overlay raining bread emoji. Plays for ~`durationMs` then
 * calls `onDone`. Non-interactive (pointerEvents none).
 */
export function BreadRain({ durationMs = 6000, onDone }: { durationMs?: number; onDone?: () => void }) {
  const dropsRef = useRef<Drop[]>(makeDrops());
  const drops = dropsRef.current;

  useEffect(() => {
    const anims = drops.map((d) =>
      Animated.loop(
        Animated.timing(d.fall, {
          toValue: 1,
          duration: d.duration,
          delay: d.delay,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ),
    );
    anims.forEach((a) => a.start());
    const timer = setTimeout(() => {
      anims.forEach((a) => a.stop());
      onDone?.();
    }, durationMs);
    return () => {
      clearTimeout(timer);
      anims.forEach((a) => a.stop());
    };
  }, []);

  return (
    <View style={styles.overlay} pointerEvents="none">
      {drops.map((d, i) => {
        const translateY = d.fall.interpolate({
          inputRange: [0, 1],
          outputRange: [-60, SCREEN_H + 60],
        });
        const rotate = d.fall.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${d.rotate * 360}deg`],
        });
        return (
          <Animated.Text
            key={i}
            style={[
              styles.emoji,
              { left: d.x, fontSize: d.size, transform: [{ translateY }, { rotate }] },
            ]}
          >
            {EMOJI}
          </Animated.Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 999 },
  emoji: { position: 'absolute', top: 0 },
});
