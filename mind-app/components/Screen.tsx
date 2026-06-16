import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { useAppLayout } from '../hooks/useAppLayout';

type ScreenProps = {
  children: React.ReactNode;
  backgroundColor?: string;
  edges?: Edge[];
  scroll?: boolean;
  keyboardAvoid?: boolean;
  centerContent?: boolean;
  padded?: boolean;
  contentContainerStyle?: ViewStyle;
  showsVerticalScrollIndicator?: boolean;
};

export function Screen({
  children,
  backgroundColor,
  edges,
  scroll = false,
  keyboardAvoid = false,
  centerContent = false,
  padded = true,
  contentContainerStyle,
  showsVerticalScrollIndicator = false,
}: ScreenProps) {
  const { contentPaddingHorizontal, scrollPaddingBottom, contentMaxWidth } = useAppLayout();
  const horizontalPad = padded ? contentPaddingHorizontal : 0;

  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingHorizontal: horizontalPad,
          paddingBottom: scrollPaddingBottom,
        },
        centerContent && styles.centeredScroll,
        contentContainerStyle,
      ]}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      keyboardShouldPersistTaps="handled"
    >
      {centerContent ? (
        <View style={[styles.contentColumn, { maxWidth: contentMaxWidth }]}>{children}</View>
      ) : (
        children
      )}
    </ScrollView>
  ) : centerContent ? (
    <View style={[styles.fill, styles.centeredFill]}>
      <View
        style={[
          styles.contentColumn,
          styles.fillWidth,
          { maxWidth: contentMaxWidth, paddingHorizontal: horizontalPad },
        ]}
      >
        {children}
      </View>
    </View>
  ) : (
    <View style={[styles.fill, padded && { paddingHorizontal: horizontalPad }]}>{children}</View>
  );

  const body = keyboardAvoid ? (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {inner}
    </KeyboardAvoidingView>
  ) : (
    inner
  );

  return (
    <SafeAreaView
      style={[styles.safe, backgroundColor != null && { backgroundColor }]}
      edges={edges ?? ['top', 'bottom', 'left', 'right']}
    >
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  fill: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  centeredScroll: { alignItems: 'center' },
  centeredFill: { alignItems: 'center' },
  contentColumn: { width: '100%' },
  fillWidth: { flex: 1 },
});
