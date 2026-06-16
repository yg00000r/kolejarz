import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { type BiometricAuthResult, runBiometricLoginFlow } from './biometricAuth';

export type { BiometricAuthResult } from './biometricAuth';

const KEY_EMPLOYEE = 'kolejarz_employee';
const KEY_PIN = 'kolejarz_pin';
const KEY_BIOMETRICS = 'kolejarz_biometrics';

interface AuthContextType {
  isLoading: boolean;
  isRegistered: boolean;
  isAuthenticated: boolean;
  hasPinSet: boolean;
  employeeNumber: string | null;
  biometricsEnabled: boolean;
  biometricsAvailable: boolean;
  register: (employeeNumber: string) => Promise<void>;
  setupPin: (pin: string) => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
  changePin: (oldPin: string, newPin: string) => Promise<boolean>;
  authenticateWithBiometrics: () => Promise<BiometricAuthResult>;
  setBiometrics: (enabled: boolean) => Promise<boolean>;
  logout: () => void;
  resetApp: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [hasPinSet, setHasPinSet] = useState(false);
  const [employeeNumber, setEmployeeNumber] = useState<string | null>(null);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [storedEmployee, storedPin, storedBio] = await Promise.all([
          SecureStore.getItemAsync(KEY_EMPLOYEE),
          SecureStore.getItemAsync(KEY_PIN),
          SecureStore.getItemAsync(KEY_BIOMETRICS),
        ]);

        setEmployeeNumber(storedEmployee);
        setIsRegistered(!!storedEmployee);
        setHasPinSet(!!storedPin);
        setBiometricsEnabled(storedBio === '1');

        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        setBiometricsAvailable(hasHardware && isEnrolled);
      } catch {
        // SecureStore or biometrics check failed -- default to safe state
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const register = useCallback(async (empNumber: string) => {
    await SecureStore.setItemAsync(KEY_EMPLOYEE, empNumber);
    setEmployeeNumber(empNumber);
    setIsRegistered(true);
  }, []);

  const setupPin = useCallback(async (pin: string) => {
    await SecureStore.setItemAsync(KEY_PIN, pin);
    setHasPinSet(true);
    setIsAuthenticated(true);
  }, []);

  const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
    const stored = await SecureStore.getItemAsync(KEY_PIN);
    const valid = stored === pin;
    if (valid) setIsAuthenticated(true);
    return valid;
  }, []);

  const changePin = useCallback(async (oldPin: string, newPin: string): Promise<boolean> => {
    const stored = await SecureStore.getItemAsync(KEY_PIN);
    if (stored !== oldPin) return false;
    await SecureStore.setItemAsync(KEY_PIN, newPin);
    return true;
  }, []);

  const authenticateWithBiometrics = useCallback(async (): Promise<BiometricAuthResult> => {
    const result = await runBiometricLoginFlow();
    if (result.ok) {
      setIsAuthenticated(true);
    }
    return result;
  }, []);

  const setBiometricsValue = useCallback(async (enabled: boolean): Promise<boolean> => {
    try {
      if (enabled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Potwierdź tożsamość, aby włączyć Face ID',
          fallbackLabel: 'Kod dostępu',
          // true blokowało fallback — w Expo Go / anulowaniu suwak wracał bez zmiany stanu
          disableDeviceFallback: false,
        });
        if (!result.success) return false;
      }
      await SecureStore.setItemAsync(KEY_BIOMETRICS, enabled ? '1' : '0');
      setBiometricsEnabled(enabled);
      return true;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
  }, []);

  const resetApp = useCallback(async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(KEY_EMPLOYEE),
      SecureStore.deleteItemAsync(KEY_PIN),
      SecureStore.deleteItemAsync(KEY_BIOMETRICS),
    ]);
    setIsAuthenticated(false);
    setIsRegistered(false);
    setHasPinSet(false);
    setEmployeeNumber(null);
    setBiometricsEnabled(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        isRegistered,
        isAuthenticated,
        hasPinSet,
        employeeNumber,
        biometricsEnabled,
        biometricsAvailable,
        register,
        setupPin,
        verifyPin,
        changePin,
        authenticateWithBiometrics,
        setBiometrics: setBiometricsValue,
        logout,
        resetApp,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
