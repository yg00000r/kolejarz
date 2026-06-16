import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const LETTERS = 'KOLEJARZ'.split('');

const PHASE1_DURATION = 900;
const PHASE2_DURATION = 1200;
const PHASE3_DURATION = 400;

const LETTER_STAGGER = 50;

interface Props {
  onFinish: () => void;
}

export function AnimatedSplash({ onFinish }: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const letterAnims = useRef(LETTERS.map(() => new Animated.Value(0))).current;
  const letterSpacingAnim = useRef(new Animated.Value(24)).current;
  const lineProgress = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const masterOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const phase1 = Animated.parallel([
      Animated.stagger(
        LETTER_STAGGER,
        letterAnims.map((anim) =>
          Animated.timing(anim, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
        ),
      ),
      Animated.timing(letterSpacingAnim, {
        toValue: 6,
        duration: PHASE1_DURATION,
        useNativeDriver: false,
      }),
    ]);

    const phase2 = Animated.parallel([
      Animated.timing(glowOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(lineProgress, {
        toValue: 1,
        duration: PHASE2_DURATION,
        useNativeDriver: true,
      }),
    ]);

    const phase3 = Animated.parallel([
      Animated.timing(glowOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(masterOpacity, {
        toValue: 0,
        duration: PHASE3_DURATION,
        useNativeDriver: true,
      }),
    ]);

    Animated.sequence([phase1, phase2, phase3]).start(() => {
      onFinish();
    });
  }, []);

  const lineMaxWidth = width * 0.7;
  const halfLine = lineMaxWidth / 2;

  const glowTranslateX = lineProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, lineMaxWidth - 20],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: masterOpacity, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <Animated.View style={[styles.textRow, { letterSpacing: letterSpacingAnim }] as object}>
        {LETTERS.map((letter, i) => {
          const opacity = letterAnims[i];
          const translateY = letterAnims[i].interpolate({
            inputRange: [0, 1],
            outputRange: [18, 0],
          });
          return (
            <Animated.Text
              key={i}
              style={[
                styles.letter,
                {
                  opacity,
                  transform: [{ translateY }],
                },
              ]}
            >
              {letter}
            </Animated.Text>
          );
        })}
      </Animated.View>

      <View style={[styles.lineContainer, { width: lineMaxWidth }]}>
        <Animated.View
          style={[
            styles.trainLine,
            {
              width: lineMaxWidth,
              transform: [
                { translateX: halfLine },
                { scaleX: lineProgress },
                { translateX: -halfLine },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.glow,
            {
              opacity: glowOpacity,
              transform: [{ translateX: glowTranslateX }],
            },
          ]}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  textRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  letter: {
    fontSize: 38,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0,
  },
  lineContainer: {
    height: 3,
    position: 'relative',
    overflow: 'visible',
  },
  trainLine: {
    height: 2.5,
    backgroundColor: '#fff',
    borderRadius: 1,
  },
  glow: {
    position: 'absolute',
    top: -4,
    width: 40,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
});
