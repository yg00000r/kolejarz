import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { radius, touchTargetMin } from '../constants/layout';
import { useAppLayout } from '../hooks/useAppLayout';

type ScreenHeaderProps = {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
  subtitle?: string;
  textColor?: string;
  subtitleColor?: string;
  style?: ViewStyle;
};

export function ScreenHeader({
  title,
  onBack,
  right,
  subtitle,
  textColor = '#000',
  subtitleColor,
  style,
}: ScreenHeaderProps) {
  const router = useRouter();
  const { headerPaddingTop, headerPaddingBottom, titleSize, spacing: s } = useAppLayout();

  const handleBack = onBack ?? (() => router.back());

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: headerPaddingTop,
          paddingBottom: headerPaddingBottom,
        },
        style,
      ]}
    >
      <TouchableOpacity
        onPress={handleBack}
        style={styles.backBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Wróć"
      >
        <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
      </TouchableOpacity>

      <View style={styles.titleBlock}>
        <Text style={[styles.title, { fontSize: titleSize * 0.56, color: textColor }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.subtitle, { color: subtitleColor ?? textColor }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.right}>{right ?? <View style={styles.backBtn} />}</View>
    </View>
  );
}

/** Icon button sized for Pro Max touch targets. */
export function ScreenHeaderIconButton({
  onPress,
  children,
  backgroundColor,
}: {
  onPress: () => void;
  children: React.ReactNode;
  backgroundColor?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.iconBtn,
        { borderRadius: radius.lg, backgroundColor },
      ]}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
    >
      {children}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTargetMin,
  },
  backBtn: {
    width: touchTargetMin,
    height: touchTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  title: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    opacity: 0.65,
  },
  right: {
    minWidth: touchTargetMin,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  iconBtn: {
    width: touchTargetMin,
    height: touchTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
