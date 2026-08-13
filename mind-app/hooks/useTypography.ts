import { useMemo } from 'react';
import type { MD3Theme } from 'react-native-paper';
import { useTheme } from '../contexts/ThemeContext';

/** https://m3.material.io/styles/typography/type-scale — pełna skala MD3, 3 rozmiary × 5 stylów. */
const TYPESCALE_KEYS = [
  'displayLarge', 'displayMedium', 'displaySmall',
  'headlineLarge', 'headlineMedium', 'headlineSmall',
  'titleLarge', 'titleMedium', 'titleSmall',
  'labelLarge', 'labelMedium', 'labelSmall',
  'bodyLarge', 'bodyMedium', 'bodySmall',
] as const;

type MD3Fonts = MD3Theme['fonts'];

/**
 * E5: pełna skala typografii MD3 — display/headline/title/body/label ×
 * large/medium/small — to `theme.fonts` z `react-native-paper`
 * (`MD3LightTheme`/`MD3DarkTheme`, już wpięte w `constants/theme.ts` →
 * `buildAppTheme`). Ten hook tylko przeskalowuje ją o ustawienie rozmiaru
 * tekstu użytkownika (`textScaleFactor`, S/M/L z Ustawień) — dokładnie tak,
 * jak dotychczasowe ad-hoc rozmiary w `constants/layout.ts`
 * (`typography.title` itd., które zostają — używane przez
 * `ScreenHeader`/`useAppLayout` i nie są w zakresie tego zadania).
 *
 * Użycie: `const type = useTypography(); <Text style={type.titleLarge}>...`
 */
export function useTypography(): MD3Fonts {
  const { theme, textScaleFactor } = useTheme();

  return useMemo(() => {
    const fonts = theme.fonts;
    const scaled = { ...fonts } as MD3Fonts;
    for (const key of TYPESCALE_KEYS) {
      const variant = fonts[key];
      scaled[key] = {
        ...variant,
        fontSize: variant.fontSize * textScaleFactor,
        lineHeight: variant.lineHeight * textScaleFactor,
      };
    }
    return scaled;
  }, [theme.fonts, textScaleFactor]);
}
