import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { AppDarkTheme, AppLightTheme, AppTheme } from '../constants/theme';

export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_KEY = 'mind_theme_mode';

export function useAppTheme() {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setMode(saved);
      }
    });
  }, []);

  const setThemeMode = useCallback(async (newMode: ThemeMode) => {
    setMode(newMode);
    await AsyncStorage.setItem(THEME_KEY, newMode);
  }, []);

  const isDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark';
  const theme: AppTheme = isDark ? AppDarkTheme : AppLightTheme;
  const colors = isDark ? theme.colors : theme.colors;

  return { theme, mode, setThemeMode, isDark, colors };
}
