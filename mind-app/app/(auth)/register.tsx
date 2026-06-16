import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Screen } from '../../components/Screen';
import { iosContinuousCurve, radius } from '../../constants/layout';
import { useAuth } from '../../contexts/AuthContext';
import { BASE_URL } from '../../constants/api';
import { SESSION_TOKEN_KEY } from '../../services/api';
import { useAppLayout } from '../../hooks/useAppLayout';

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();
  const { insets, spacing: s } = useAppLayout();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const passwordRef = useRef<TextInput>(null);

  const handleRegister = async () => {
    if (!username.trim()) {
      setError('Wpisz login IVU (np. jkowalski)');
      return;
    }
    if (!password.trim()) {
      setError('Wpisz hasło portalu IVU');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portalUsername: username.trim(),
          portalPassword: password.trim(),
        }),
      });

      const data = (await res.json()) as { success?: boolean; error?: string; sessionToken?: string; employeeId?: string };

      if (data.success && data.sessionToken) {
        await SecureStore.setItemAsync(SESSION_TOKEN_KEY, data.sessionToken);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await register(data.employeeId ?? username.trim());
        router.replace('/(auth)/login');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(data.error ?? 'Nie udało się zarejestrować. Sprawdź dane logowania.');
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Brak połączenia z serwerem. Sprawdź sieć WiFi i spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen backgroundColor="#000" keyboardAvoid padded={false}>
      <View style={[styles.inner, { paddingBottom: insets.bottom + s.lg, paddingHorizontal: s.xl + 8 }]}>
        <Text style={styles.appName}>Kolejarz</Text>
        <Text style={styles.subtitle}>Zaloguj się danymi portalu IVU.pad</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Login IVU</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={(t) => { setUsername(t); setError(''); }}
            placeholder="login pracownika"
            placeholderTextColor="#555"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            editable={!loading}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Hasło portalu IVU</Text>
          <TextInput
            ref={passwordRef}
            style={styles.input}
            value={password}
            onChangeText={(t) => { setPassword(t); setError(''); }}
            placeholder="hasło z portal.intercity.pl"
            placeholderTextColor="#555"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            returnKeyType="go"
            onSubmitEditing={handleRegister}
            editable={!loading}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>Zarejestruj</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.hint}>
          Twoje dane są weryfikowane przez portal PKP IC i przechowywane zaszyfrowane na serwerze.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  inner: {
    flex: 1,
    justifyContent: 'center',
  },
  appName: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 6,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1c1c1e',
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#3a3a3c',
    ...(Platform.OS === 'ios' ? iosContinuousCurve : {}),
  },
  error: {
    color: '#ff453a',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  button: {
    backgroundColor: '#0A84FF',
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    ...(Platform.OS === 'ios' ? iosContinuousCurve : {}),
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  hint: {
    color: '#555',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
});
