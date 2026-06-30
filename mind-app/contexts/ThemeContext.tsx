import React, { createContext, useContext, useMemo } from 'react';
import { AppTheme, Colors } from '../constants/theme';
import { TextScale, ThemeMode, useAppTheme } from '../hooks/useAppTheme';

/** Runtime palette (StyleSheet colors) with the user's accent applied. */
export type Palette = { [K in keyof typeof Colors.light]: string };

interface ThemeContextType {
  theme: AppTheme;
  mode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  isDark: boolean;
  colors: AppTheme['colors'];
  accent: string;
  accentCustom: string | null;
  setAccent: (color: string | null) => Promise<void>;
  textScale: TextScale;
  textScaleFactor: number;
  setTextScale: (scale: TextScale) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeState = useAppTheme();
  return <ThemeContext.Provider value={themeState}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

/**
 * Returns the runtime palette (the same shape as `Colors.dark`/`Colors.light`)
 * with the user-selected accent applied. Drop-in replacement for
 * `isDark ? Colors.dark : Colors.light`.
 */
export function useColors(): Palette {
  const { isDark, accent } = useTheme();
  return useMemo(
    () => ({ ...(isDark ? Colors.dark : Colors.light), accent }),
    [isDark, accent],
  );
}
