import React, { createContext, useContext } from 'react';
import { AppTheme } from '../constants/theme';
import { ThemeMode, useAppTheme } from '../hooks/useAppTheme';

interface ThemeContextType {
  theme: AppTheme;
  mode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  isDark: boolean;
  colors: AppTheme['colors'];
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
