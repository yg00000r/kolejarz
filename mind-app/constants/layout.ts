/**
 * Layout tokens — design baseline: iPhone Pro Max (17 Pro Max).
 * Android uses the same tokens; safe-area insets come from useAppLayout().
 */

/** Width threshold for large iPhones (Pro Max line). */
export const LARGE_PHONE_MIN_WIDTH = 430;

export const spacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
} as const;

/** Spacing scaled up on large phones (Pro Max). */
export const spacingLarge = {
  xs: 10,
  sm: 14,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
} as const;

export const touchTargetMin = 44;

/** Max readable content width on wide screens (Pro Max / tablet). */
export const maxContentWidth = 520;

export const typography = {
  title: 32,
  titleLarge: 36,
  sectionLabel: 12,
  sectionLabelLarge: 13,
  headerIconSize: 20,
  headerIconSizeLarge: 22,
} as const;

export const grid = {
  tileGap: 12,
  tileGapLarge: 14,
} as const;

/** iOS continuous corner curve (large rounded display). */
export const iosContinuousCurve = { borderCurve: 'continuous' as const };

export function pickSpacing(isLargePhone: boolean) {
  return isLargePhone ? spacingLarge : spacing;
}

export function pickRadius(isLargePhone: boolean, key: keyof typeof radius = 'md') {
  const base = radius[key];
  return isLargePhone ? base + 4 : base;
}
