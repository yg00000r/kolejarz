import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { AppDarkTheme, AppLightTheme, AppTheme, Colors } from '../constants/theme';

export type ThemeMode = 'light' | 'dark' | 'system';
export type TextScale = 'S' | 'M' | 'L';

const THEME_KEY = 'mind_theme_mode';
const ACCENT_KEY = 'mind_accent_color';
const TEXT_SCALE_KEY = 'mind_text_scale';

/** Accent presets offered in the settings picker. */
export const ACCENT_PRESETS = [
  '#0A84FF', // niebieski (domyślny)
  '#30D158', // zielony
  '#FF9F0A', // pomarańczowy
  '#FF453A', // czerwony
  '#BF5AF2', // fioletowy
  '#FF375F', // różowy
] as const;

export const TEXT_SCALE_FACTORS: Record<TextScale, number> = {
  S: 0.92,
  M: 1,
  L: 1.12,
};

export function useAppTheme() {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('system');
  const [accent, setAccentState] = useState<string | null>(null);
  const [textScale, setTextScaleState] = useState<TextScale>('M');

  useEffect(() => {
    AsyncStorage.multiGet([THEME_KEY, ACCENT_KEY, TEXT_SCALE_KEY]).then((entries) => {
      const map = Object.fromEntries(entries);
      const savedMode = map[THEME_KEY];
      if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') setMode(savedMode);
      const savedAccent = map[ACCENT_KEY];
      if (savedAccent) setAccentState(savedAccent);
      const savedScale = map[TEXT_SCALE_KEY];
      if (savedScale === 'S' || savedScale === 'M' || savedScale === 'L') setTextScaleState(savedScale);
    });
  }, []);

  const setThemeMode = useCallback(async (newMode: ThemeMode) => {
    setMode(newMode);
    await AsyncStorage.setItem(THEME_KEY, newMode);
  }, []);

  const setAccent = useCallback(async (color: string | null) => {
    setAccentState(color);
    if (color) await AsyncStorage.setItem(ACCENT_KEY, color);
    else await AsyncStorage.removeItem(ACCENT_KEY);
  }, []);

  const setTextScale = useCallback(async (scale: TextScale) => {
    setTextScaleState(scale);
    await AsyncStorage.setItem(TEXT_SCALE_KEY, scale);
  }, []);

  const isDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark';
  const baseAccent = isDark ? Colors.dark.accent : Colors.light.accent;
  const resolvedAccent = accent ?? baseAccent;

  const theme: AppTheme = useMemo(() => {
    const base = isDark ? AppDarkTheme : AppLightTheme;
    return { ...base, colors: { ...base.colors, primary: resolvedAccent } };
  }, [isDark, resolvedAccent]);

  return {
    theme,
    mode,
    setThemeMode,
    isDark,
    colors: theme.colors,
    accent: resolvedAccent,
    /** True when a custom (non-default) accent is active. */
    accentCustom: accent,
    setAccent,
    textScale,
    textScaleFactor: TEXT_SCALE_FACTORS[textScale],
    setTextScale,
  };
}
