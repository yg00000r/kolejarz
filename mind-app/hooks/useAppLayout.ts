import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LARGE_PHONE_MIN_WIDTH,
  maxContentWidth,
  pickSpacing,
  spacing,
  typography,
} from '../constants/layout';

export function useAppLayout() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const isLargePhone = width >= LARGE_PHONE_MIN_WIDTH;
  const s = pickSpacing(isLargePhone);

  return useMemo(
    () => ({
      insets,
      width,
      height,
      isLargePhone,
      spacing: s,
      contentPaddingHorizontal: s.md,
      scrollPaddingBottom: insets.bottom + s.lg,
      headerPaddingTop: s.sm,
      headerPaddingBottom: s.md,
      contentMaxWidth: maxContentWidth,
      touchTargetMin: 44,
      titleSize: isLargePhone ? typography.titleLarge : typography.title,
      sectionLabelSize: isLargePhone ? typography.sectionLabelLarge : typography.sectionLabel,
      headerIconSize: isLargePhone ? typography.headerIconSizeLarge : typography.headerIconSize,
      /** Grid tile width for 2-column layout with horizontal padding + gap. */
      tileWidth: (Math.min(width, maxContentWidth) - s.md * 2 - (isLargePhone ? 14 : 12)) / 2,
      tileGap: isLargePhone ? 14 : 12,
    }),
    [insets, width, height, isLargePhone, s],
  );
}

export type AppLayout = ReturnType<typeof useAppLayout>;
