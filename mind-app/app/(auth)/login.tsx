import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { iosContinuousCurve, touchTargetMin } from '../../constants/layout';
import { formatBiometricFailureMessage } from '../../contexts/biometricAuth';
import { useAuth } from '../../contexts/AuthContext';
import { useAppLayout } from '../../hooks/useAppLayout';

const PIN_LENGTH = 4;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

export default function LoginScreen() {
  const {
    hasPinSet,
    setupPin,
    verifyPin,
    biometricsEnabled,
    biometricsAvailable,
    authenticateWithBiometrics,
  } = useAuth();
  const router = useRouter();
  const { insets, isLargePhone, spacing: s } = useAppLayout();

  const [pin, setPin] = useState('');
  const [mode, setMode] = useState<'login' | 'setup' | 'confirm'>(hasPinSet ? 'login' : 'setup');
  const [error, setError] = useState('');
  const firstPinRef = useRef('');
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const biometricTriggered = useRef(false);

  const keySize = isLargePhone ? 80 : 76;
  const keyRadius = keySize / 2;

  const runBiometricLogin = async (fromAutoPrompt: boolean) => {
    setError('');
    const { ok, error: bioErr, warning } = await authenticateWithBiometrics();
    if (ok) {
      router.replace('/(app)');
      return;
    }
    const silent =
      fromAutoPrompt &&
      (bioErr === 'user_cancel' ||
        bioErr === 'system_cancel' ||
        bioErr === 'app_cancel');
    if (!silent) {
      setError(formatBiometricFailureMessage(bioErr, warning));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };

  useEffect(() => {
    if (
      mode === 'login' &&
      biometricsEnabled &&
      biometricsAvailable &&
      !biometricTriggered.current
    ) {
      biometricTriggered.current = true;
      void runBiometricLogin(true);
    }
  }, [mode, biometricsEnabled, biometricsAvailable]);

  const handleBiometricButtonPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void runBiometricLogin(false);
  };

  const shake = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handlePinComplete = async (completed: string) => {
    if (mode === 'login') {
      const valid = await verifyPin(completed);
      if (valid) {
        router.replace('/(app)');
      } else {
        setPin('');
        setError('Nieprawidłowy PIN');
        shake();
      }
    } else if (mode === 'setup') {
      firstPinRef.current = completed;
      setPin('');
      setMode('confirm');
    } else if (mode === 'confirm') {
      if (completed === firstPinRef.current) {
        await setupPin(completed);
        router.replace('/(app)');
      } else {
        firstPinRef.current = '';
        setPin('');
        setMode('setup');
        setError('PINy się nie zgadzają. Spróbuj ponownie.');
        shake();
      }
    }
  };

  const handleKey = async (key: string) => {
    if (key === '⌫') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPin((prev) => prev.slice(0, -1));
      setError('');
      return;
    }
    if (key === '' || pin.length >= PIN_LENGTH) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = pin + key;
    setPin(next);
    setError('');

    if (next.length === PIN_LENGTH) {
      await handlePinComplete(next);
    }
  };

  const titles: Record<typeof mode, string> = {
    login: 'Wpisz PIN',
    setup: 'Ustaw PIN',
    confirm: 'Potwierdź PIN',
  };

  const showBiometricButton =
    mode === 'login' && biometricsEnabled && biometricsAvailable;

  return (
    <Screen backgroundColor="#000" padded={false}>
      <View style={[styles.container, { paddingBottom: insets.bottom + s.lg }]}>
        <Text style={[styles.appName, isLargePhone && styles.appNameLarge]}>Kolejarz</Text>
        <Text style={styles.subtitle}>{titles[mode]}</Text>

        <Animated.View style={[styles.dots, { transform: [{ translateX: shakeAnim }] }]}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
          ))}
        </Animated.View>

        <Text style={styles.error}>{error}</Text>

        <View style={[styles.keypad, { width: keySize * 3 + 16 * 2, gap: 16 }]}>
          {KEYS.map((key, i) => {
            if (key === '') {
              if (showBiometricButton) {
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.key, { width: keySize, height: keySize, borderRadius: keyRadius }]}
                    onPress={handleBiometricButtonPress}
                    activeOpacity={0.5}
                  >
                    <MaterialCommunityIcons name="face-recognition" size={28} color="#fff" />
                  </TouchableOpacity>
                );
              }
              return <View key={i} style={{ width: keySize, height: keySize }} />;
            }
            return (
              <TouchableOpacity
                key={i}
                style={[
                  styles.key,
                  Platform.OS === 'ios' && iosContinuousCurve,
                  { width: keySize, height: keySize, borderRadius: keyRadius },
                  key === '⌫' && styles.keyBackspace,
                ]}
                onPress={() => handleKey(key)}
                activeOpacity={0.5}
              >
                <Text style={[styles.keyText, key === '⌫' && styles.keyTextBackspace]}>{key}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 6,
    marginBottom: 8,
  },
  appNameLarge: {
    fontSize: 40,
    letterSpacing: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#888',
    marginBottom: 52,
  },
  dots: {
    flexDirection: 'row',
    gap: 22,
    marginBottom: 20,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#555',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    borderColor: '#fff',
    backgroundColor: '#fff',
  },
  error: {
    color: '#ff453a',
    fontSize: 13,
    height: 18,
    marginBottom: 36,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  key: {
    backgroundColor: '#1c1c1e',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: touchTargetMin,
    minHeight: touchTargetMin,
  },
  keyBackspace: {
    backgroundColor: 'transparent',
  },
  keyText: {
    fontSize: 28,
    fontWeight: '400',
    color: '#fff',
  },
  keyTextBackspace: {
    fontSize: 20,
  },
});
