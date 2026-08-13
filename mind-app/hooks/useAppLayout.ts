import { useMemo } from 'react';
import { PixelRatio, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fluidHorizontalPadding,
  LARGE_PHONE_MIN_WIDTH,
  maxContentWidth,
  pickSpacing,
  TABLET_MIN_WIDTH,
  touchTargetMin,
  typography,
} from '../constants/layout';
import { useTheme } from '../contexts/ThemeContext';

export function useAppLayout() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { textScaleFactor } = useTheme();
  // Combine the in-app text scale with the OS Dynamic Type setting.
  const fontScale = PixelRatio.getFontScale() * textScaleFactor;

  const isTablet = width >= TABLET_MIN_WIDTH;
  const isLargePhone = width >= LARGE_PHONE_MIN_WIDTH && !isTablet;
  const isBig = isLargePhone || isTablet;
  const s = pickSpacing(isBig);

  const padH = fluidHorizontalPadding(width);
  // On phones content fills the width; only tablets get a max width.
  const contentMaxWidth = isTablet ? maxContentWidth : undefined;
  const effectiveWidth = Math.min(width, contentMaxWidth ?? width);
  const gridColumns = isTablet ? 3 : 2;
  const tileGap = isBig ? 12 : 10;
  const tileWidth = (effectiveWidth - padH * 2 - tileGap * (gridColumns - 1)) / gridColumns;

  return useMemo(
    () => ({
      insets,
      width,
      height,
      fontScale,
      isLargePhone,
      isTablet,
      spacing: s,
      contentPaddingHorizontal: padH,
      scrollPaddingBottom: insets.bottom + s.lg,
      // Safe-area already insets below the Dynamic Island/notch; add a touch more.
      headerPaddingTop: s.sm,
      headerPaddingBottom: s.md,
      contentMaxWidth,
      touchTargetMin,
      titleSize: (isBig ? typography.titleLarge : typography.title) * textScaleFactor,
      sectionLabelSize: (isBig ? typography.sectionLabelLarge : typography.sectionLabel) * textScaleFactor,
      headerIconSize: isBig ? typography.headerIconSizeLarge : typography.headerIconSize,
      gridColumns,
      tileGap,
      /** Multiply any StyleSheet fontSize by this to honour the in-app text scale. */
      textScaleFactor,
      /** Exact tile width that fills a grid row (no dead side space). */
      tileWidth,
    }),
    [insets, width, height, fontScale, textScaleFactor, isLargePhone, isTablet, s, padH, contentMaxWidth, gridColumns, tileGap, tileWidth],
  );
}

export type AppLayout = ReturnType<typeof useAppLayout>;
