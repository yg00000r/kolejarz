import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export type BiometricAuthResult = {
  ok: boolean;
  error?: string;
  warning?: string;
};

const PROMPT_LOGIN = 'Zaloguj się do Kolejarza';

/** Czyta pola z odpowiedzi expo (success: false ma error / warning). */
function getFailureMeta(
  r: LocalAuthentication.LocalAuthenticationResult,
): { error?: string; warning?: string } {
  if (r.success) return {};
  return { error: r.error, warning: r.warning };
}

/**
 * 1) Najpierw tylko biometria (Face ID / Touch ID).
 * 2) Jeśli Expo/iOS blokuje ten tryb albo lockout — jedna próba z kodem urządzenia (Expo Go).
 */
export async function runBiometricLoginFlow(): Promise<BiometricAuthResult> {
  try {
    const first = await LocalAuthentication.authenticateAsync({
      promptMessage: PROMPT_LOGIN,
      cancelLabel: 'Anuluj',
      disableDeviceFallback: true,
    });

    if (first.success) {
      return { ok: true };
    }

    const { error: e1, warning: w1 } = getFailureMeta(first);

    const trySecondPolicy =
      e1 === 'missing_usage_description' ||
      e1 === 'not_available' ||
      e1 === 'lockout' ||
      e1 === 'not_enrolled';

    if (trySecondPolicy) {
      const second = await LocalAuthentication.authenticateAsync({
        promptMessage: PROMPT_LOGIN,
        cancelLabel: 'Anuluj',
        fallbackLabel: Platform.OS === 'ios' ? 'Kod dostępu' : 'Anuluj',
        disableDeviceFallback: false,
      });

      if (second.success) {
        return { ok: true };
      }
      const { error: e2, warning: w2 } = getFailureMeta(second);
      return {
        ok: false,
        error: e2 ?? e1,
        warning: w2 ?? w1,
      };
    }

    return { ok: false, error: e1, warning: w1 };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export function formatBiometricFailureMessage(
  error?: string,
  warning?: string,
): string {
  if (warning && error === 'missing_usage_description') {
    return 'Expo Go nie udostępnia pełnej ścieżki Face ID dla tej aplikacji. Użyj PIN albo zbuduj dev client (np. eas build / npx expo run:ios).';
  }
  switch (error) {
    case 'missing_usage_description':
      return 'Face ID niedostępny w tym buildzie (Expo Go). Użyj PIN lub zbuduj aplikację natywnie.';
    case 'lockout':
      return 'Biometria chwilowo zablokowana. Wpisz PIN aplikacji.';
    case 'not_enrolled':
    case 'not_available':
      return 'Biometria niedostępna. Wpisz PIN.';
    case 'user_cancel':
    case 'system_cancel':
    case 'app_cancel':
      return 'Anulowano. Wpisz PIN.';
    case 'authentication_failed':
      return 'Nie rozpoznano twarzy / odcisku. Spróbuj ponownie lub wpisz PIN.';
    default:
      return error
        ? `Autoryzacja nie powiodła się (${error}). Wpisz PIN.`
        : 'Autoryzacja nie powiodła się. Wpisz PIN.';
  }
}
