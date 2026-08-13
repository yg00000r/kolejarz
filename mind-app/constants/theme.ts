import type { Material3Scheme } from '@pchmn/expo-material3-theme';
import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

/**
 * MD3 nie definiuje ról "success"/"warning" (to nie są standardowe kolory
 * systemu Material) — to nasze dodatkowe kolory semantyczne (statusy,
 * alerty), stałe niezależnie od wybranego seed color / dynamic color.
 */
export const SemanticColors = {
  light: { success: '#34C759', warning: '#FF9500' },
  dark: { success: '#30D158', warning: '#FF9F0A' },
} as const;

/**
 * Pełna paleta używana w aplikacji: wszystkie role MD3 (`Material3Scheme` —
 * tonalne palety wygenerowane z seed color albo dynamic color systemu,
 * `@pchmn/expo-material3-theme` / `@material/material-color-utilities`)
 * + kolory semantyczne + aliasy zgodności dla dotychczasowego kodu ekranów
 * (`text`, `textSecondary`, `accent`, `border`, `surfaceSecondary`), które
 * przed E2 były jedynym API kolorów (`useColors()`, statyczny `Colors.*`).
 *
 * Nowy kod (Faza 3+) powinien sięgać po pełne role MD3 bezpośrednio
 * (`colors.primaryContainer`, `colors.onSurfaceVariant`, `colors.outlineVariant`...),
 * aliasy zostają jako wygodny, krótszy skrót i dla ~30 istniejących ekranów.
 */
export type Palette = Material3Scheme & {
  success: string;
  warning: string;
  /** Alias `onSurface` — główny kolor tekstu. */
  text: string;
  /** Alias `onSurfaceVariant` — tekst drugoplanowy/pomocniczy. */
  textSecondary: string;
  /** Alias `primary` — kolor akcentu (seed / dynamic color użytkownika). */
  accent: string;
  /** Alias `outline`. */
  border: string;
  /** Alias `surfaceVariant`. */
  surfaceSecondary: string;
};

export function buildPalette(scheme: Material3Scheme, isDark: boolean): Palette {
  const semantic = isDark ? SemanticColors.dark : SemanticColors.light;
  return {
    ...scheme,
    ...semantic,
    text: scheme.onSurface,
    textSecondary: scheme.onSurfaceVariant,
    accent: scheme.primary,
    border: scheme.outline,
    surfaceSecondary: scheme.surfaceVariant,
  };
}

/**
 * Motyw React Native Paper (MD3) + nasza `Palette` (nadzbiór `MD3Theme['colors']`,
 * zob. wyżej) — jedno źródło prawdy zamiast dawnych, osobno utrzymywanych
 * `AppDarkTheme`/`AppLightTheme`/`Colors.dark`/`Colors.light`.
 */
export type AppTheme = Omit<MD3Theme, 'colors'> & { colors: Palette };

export function buildAppTheme(scheme: Material3Scheme, isDark: boolean): AppTheme {
  const base = isDark ? MD3DarkTheme : MD3LightTheme;
  return { ...base, dark: isDark, colors: buildPalette(scheme, isDark) };
}
