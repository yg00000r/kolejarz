import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

// Palety kolorów do użytku w StyleSheet (poza Paper theme)
export const Colors = {
  dark: {
    background: '#000000',
    surface: '#1C1C1E',
    surfaceSecondary: '#2C2C2E',
    border: '#3A3A3C',
    text: '#FFFFFF',
    textSecondary: '#8E8E93',
    accent: '#0A84FF',
    error: '#FF453A',
    success: '#30D158',
    warning: '#FF9F0A',
  },
  light: {
    background: '#F2F2F7',
    surface: '#FFFFFF',
    surfaceSecondary: '#E5E5EA',
    border: '#C6C6C8',
    text: '#000000',
    textSecondary: '#6C6C70',
    accent: '#007AFF',
    error: '#FF3B30',
    success: '#34C759',
    warning: '#FF9500',
  },
} as const;

// Motywy React Native Paper (MD3)
export const AppDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#0A84FF',
    background: '#000000',
    surface: '#1C1C1E',
    surfaceVariant: '#2C2C2E',
    onBackground: '#FFFFFF',
    onSurface: '#FFFFFF',
    outline: '#3A3A3C',
    error: '#FF453A',
  },
};

export const AppLightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#007AFF',
    background: '#F2F2F7',
    surface: '#FFFFFF',
    surfaceVariant: '#E5E5EA',
    onBackground: '#000000',
    onSurface: '#000000',
    outline: '#C6C6C8',
    error: '#FF3B30',
  },
};

export type AppTheme = typeof AppDarkTheme;
