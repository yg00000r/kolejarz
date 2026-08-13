import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { AppTheme, buildAppTheme } from '../constants/theme';

export type ThemeMode = 'light' | 'dark' | 'system';
export type TextScale = 'S' | 'M' | 'L';

const THEME_KEY = 'mind_theme_mode';
const ACCENT_KEY = 'mind_accent_color';
const TEXT_SCALE_KEY = 'mind_text_scale';

/**
 * Wartość specjalna zamiast konkretnego seed color: użyj dynamicznego koloru
 * systemu (Material You z tapety, Android 12+) — a gdy niedostępny (starszy
 * Android, tryb deweloperski w Expo Go, iOS), spadnij na domyślny fallback
 * (pierwszy z `ACCENT_PRESETS`). To jest domyślny wybór dla nowych instalacji.
 */
export const ACCENT_AUTO = 'auto' as const;

/** Stałe presety akcentu (seed color) do wyboru w Ustawieniach, obok opcji „Automatyczny". */
export const ACCENT_PRESETS = [
  '#0A84FF', // niebieski (domyślny fallback)
  '#30D158', // zielony
  '#FF9F0A', // pomarańczowy
  '#FF453A', // czerwony
  '#BF5AF2', // fioletowy
  '#FF375F', // różowy
] as const;

export type AccentChoice = typeof ACCENT_AUTO | (typeof ACCENT_PRESETS)[number];

export const TEXT_SCALE_FACTORS: Record<TextScale, number> = {
  S: 0.92,
  M: 1,
  L: 1.12,
};

export function useAppTheme() {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('system');
  const [accent, setAccentState] = useState<AccentChoice>(ACCENT_AUTO);
  const [textScale, setTextScaleState] = useState<TextScale>('M');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.multiGet([THEME_KEY, ACCENT_KEY, TEXT_SCALE_KEY]).then((entries) => {
      const map = Object.fromEntries(entries);
      const savedMode = map[THEME_KEY];
      if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') setMode(savedMode);
      const savedAccent = map[ACCENT_KEY];
      if (savedAccent) setAccentState(savedAccent as AccentChoice);
      const savedScale = map[TEXT_SCALE_KEY];
      if (savedScale === 'S' || savedScale === 'M' || savedScale === 'L') setTextScaleState(savedScale);
      setHydrated(true);
    });
  }, []);

  const setThemeMode = useCallback(async (newMode: ThemeMode) => {
    setMode(newMode);
    await AsyncStorage.setItem(THEME_KEY, newMode);
  }, []);

  const setAccent = useCallback(async (choice: AccentChoice) => {
    setAccentState(choice);
    await AsyncStorage.setItem(ACCENT_KEY, choice);
  }, []);

  const setTextScale = useCallback(async (scale: TextScale) => {
    setTextScaleState(scale);
    await AsyncStorage.setItem(TEXT_SCALE_KEY, scale);
  }, []);

  // E3: Material3Theme — tonalne palety wygenerowane z seed color (E1), albo
  // dynamic color systemu na Androidzie 12+ gdy accent === ACCENT_AUTO.
  // `@pchmn/expo-material3-theme` pod spodem woła `@material/material-color-utilities`.
  // Hook nie jest reaktywny na zmianę parametrów między renderami (patrz jego
  // implementacja — `useState` z jednorazową inicjalizacją), więc zmianę
  // motywu wywołujemy explicite przez `updateTheme`/`resetTheme` w efekcie.
  const { theme: m3Theme, updateTheme, resetTheme } = useMaterial3Theme({
    fallbackSourceColor: ACCENT_PRESETS[0],
  });

  useEffect(() => {
    if (!hydrated) return;
    if (accent === ACCENT_AUTO) resetTheme();
    else updateTheme(accent);
    // updateTheme/resetTheme dostają nową referencję przy każdym renderze —
    // celowo poza deps, inaczej pętla efektów.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accent, hydrated]);

  const isDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark';

  const theme: AppTheme = useMemo(
    () => buildAppTheme(isDark ? m3Theme.dark : m3Theme.light, isDark),
    [isDark, m3Theme],
  );

  return {
    theme,
    mode,
    setThemeMode,
    isDark,
    colors: theme.colors,
    /** Rozwiązany kolor akcentu (zawsze konkretny hex — `theme.colors.primary`). */
    accent: theme.colors.primary,
    /** Aktualny wybór użytkownika — `ACCENT_AUTO` albo jeden z `ACCENT_PRESETS`. */
    accentCustom: accent,
    setAccent,
    textScale,
    textScaleFactor: TEXT_SCALE_FACTORS[textScale],
    setTextScale,
  };
}
