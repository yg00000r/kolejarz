import React, { createContext, useContext } from 'react';
import { AppTheme, Palette } from '../constants/theme';
import { AccentChoice, TextScale, ThemeMode, useAppTheme } from '../hooks/useAppTheme';

// Re-eksport dla istniejących ekranów, które importują `Palette` z tego modułu
// (nie z `constants/theme.ts`) — `import { type Palette } from '.../ThemeContext'`.
export type { AppTheme, Palette };

interface ThemeContextType {
  theme: AppTheme;
  mode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  isDark: boolean;
  colors: Palette;
  accent: string;
  accentCustom: AccentChoice;
  setAccent: (choice: AccentChoice) => Promise<void>;
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
 * E2: `useColors()` i `useTheme().colors` to teraz jedno źródło prawdy —
 * pełny zestaw ról MD3 (`Material3Scheme`, generowany z seed color / dynamic
 * color — zob. E1/E3 w `hooks/useAppTheme.ts`) + aliasy zgodności (`text`,
 * `textSecondary`, `accent`, `border`, `surfaceSecondary`) używane w ~30
 * istniejących ekranach. Zostaje jako krótszy skrót do `useTheme().colors`.
 */
export function useColors(): Palette {
  return useTheme().colors;
}
