import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme, useColors } from '../../../../contexts/ThemeContext';
import { clearQueue, getQueue, removeFromQueue, QueuedMessage } from '../../../../services/messageQueue';
import { Screen } from '../../../../components/Screen';

export default function QueueScreen() {
  const { isDark } = useTheme();
  const colors = useColors();
  const router = useRouter();

  const [items, setItems] = useState<QueuedMessage[]>(() => [...getQueue()]);
  const [copied, setCopied] = useState(false);

  const fullText = items
    .map(item => item.text.replace(/§§/g, '\n\n'))
    .join('\n\n* * *\n\n');

  const handleCopy = async () => {
    await Clipboard.setStringAsync(fullText);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleRemove = (id: string) => {
    Alert.alert('Usuń komunikat', 'Usunąć ten komunikat z kolejki?', [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń', style: 'destructive', onPress: () => {
          removeFromQueue(id);
          setItems([...getQueue()]);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const handleClearAll = () => {
    Alert.alert('Wyczyść kolejkę', 'Usunąć wszystkie komunikaty z kolejki?', [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Wyczyść', style: 'destructive', onPress: () => {
          clearQueue();
          setItems([]);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  if (items.length === 0) {
    return (
      <Screen scroll backgroundColor={colors.background}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }} hitSlop={8} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Kolejka</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.emptyWrap}>
          <MaterialCommunityIcons name="playlist-remove" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Kolejka jest pusta</Text>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.accent }]}
            onPress={() => router.push('/(app)/work/messages')}
          >
            <MaterialCommunityIcons name="plus" size={20} color="#fff" />
            <Text style={styles.addBtnText}>Dodaj komunikat</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll backgroundColor={colors.background}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }} hitSlop={8} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Kolejka ({items.length})</Text>
        <TouchableOpacity onPress={handleCopy} hitSlop={8}>
          <MaterialCommunityIcons
            name={copied ? 'check-circle' : 'content-copy'}
            size={22}
            color={copied ? colors.accent : colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {copied && (
        <View style={[styles.copiedBanner, { backgroundColor: colors.accent }]}>
          <MaterialCommunityIcons name="check" size={16} color="#fff" />
          <Text style={styles.copiedText}>Skopiowano do schowka</Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Połączony tekst */}
        <View style={[styles.textCard, { backgroundColor: colors.surface }]}>
          {items.map((item, idx) => {
            const paragraphs = item.text.replace(/§§/g, '\n\n').split('\n\n').filter(Boolean);
            return (
              <View key={item.id}>
                {/* Nagłówek komunikatu z przyciskiem usunięcia */}
                <View style={styles.msgHeader}>
                  <View style={[styles.msgBadge, { backgroundColor: colors.accent }]}>
                    <Text style={styles.msgBadgeText}>{idx + 1}</Text>
                  </View>
                  <Text style={[styles.msgTitle, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <TouchableOpacity onPress={() => handleRemove(item.id)} hitSlop={8}>
                    <MaterialCommunityIcons name="close-circle-outline" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Treść komunikatu */}
                {paragraphs.map((para, pIdx) => (
                  <View key={pIdx}>
                    {pIdx > 0 && <View style={[styles.paraDivider, { backgroundColor: colors.textSecondary + '33' }]} />}
                    <Text style={[styles.paraText, { color: colors.text }]}>{para}</Text>
                  </View>
                ))}

                {/* Separator między komunikatami */}
                {idx < items.length - 1 && (
                  <View style={styles.msgSeparator}>
                    <View style={[styles.msgSeparatorLine, { backgroundColor: colors.textSecondary + '44' }]} />
                    <MaterialCommunityIcons name="asterisk" size={12} color={colors.textSecondary + '88'} />
                    <View style={[styles.msgSeparatorLine, { backgroundColor: colors.textSecondary + '44' }]} />
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Akcje */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: copied ? colors.accent + '22' : colors.surface }]}
            onPress={handleCopy}
          >
            <MaterialCommunityIcons name={copied ? 'check' : 'content-copy'} size={20} color={copied ? colors.accent : colors.text} />
            <Text style={[styles.actionText, { color: copied ? colors.accent : colors.text }]}>
              {copied ? 'Skopiowano' : 'Kopiuj całość'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.accent }]}
            onPress={() => router.push('/(app)/work/messages')}
          >
            <MaterialCommunityIcons name="plus" size={20} color="#fff" />
            <Text style={[styles.actionText, { color: '#fff' }]}>Dodaj kolejny komunikat</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.surface }]}
            onPress={handleClearAll}
          >
            <MaterialCommunityIcons name="playlist-remove" size={20} color={colors.textSecondary} />
            <Text style={[styles.actionText, { color: colors.textSecondary }]}>Wyczyść kolejkę</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  title: { flex: 1, fontSize: 20, fontWeight: '700', marginLeft: 8 },
  copiedBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginHorizontal: 16, borderRadius: 10, paddingVertical: 8, marginBottom: 4,
  },
  copiedText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  scroll: { padding: 16 },
  textCard: { borderRadius: 16, padding: 20, marginBottom: 20 },
  msgHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12,
  },
  msgBadge: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  msgBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  msgTitle: { flex: 1, fontSize: 12, fontWeight: '500' },
  paraDivider: { height: 1, marginVertical: 14 },
  paraText: { fontSize: 18, lineHeight: 28, fontWeight: '400' },
  msgSeparator: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginVertical: 20,
  },
  msgSeparatorLine: { flex: 1, height: 1 },
  actions: { gap: 10 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderRadius: 14, paddingVertical: 14,
  },
  actionText: { fontSize: 15, fontWeight: '600' },
  emptyWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16,
  },
  emptyText: { fontSize: 16, fontWeight: '500' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, marginTop: 8,
  },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
