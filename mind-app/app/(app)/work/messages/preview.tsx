import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MessageTypeId } from '../../../../constants/komunikaty';
import { useTheme, useColors } from '../../../../contexts/ThemeContext';
import { addToQueue } from '../../../../services/messageQueue';
import { Screen } from '../../../../components/Screen';

export default function PreviewScreen() {
  const { isDark } = useTheme();
  const colors = useColors();
  const router = useRouter();

  const { text, title, typeId, fromQueue } = useLocalSearchParams<{
    text: string;
    title: string;
    typeId: MessageTypeId;
    fromQueue?: string;
  }>();

  const [copied, setCopied] = useState(false);
  const [addedToQueue, setAddedToQueue] = useState(false);

  // Paragraphs are separated by §§ (URL-safe) when coming from compose,
  // or by \n\n when coming from the queue (stored in memory).
  const rawText = text ?? '';
  const paragraphs = (rawText.includes('§§')
    ? rawText.split('§§')
    : rawText.split('\n\n')
  ).filter(Boolean);

  const handleCopy = async () => {
    await Clipboard.setStringAsync((text ?? '').replace(/§§/g, '\n\n'));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleAddToQueue = () => {
    if (!fromQueue && !addedToQueue) {
      addToQueue({
        id: Date.now().toString(),
        typeId: typeId ?? 'p_start',
        title: title ?? 'Komunikat',
        text: (text ?? '').replace(/§§/g, '\n\n'),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAddedToQueue(true);
      // Navigate to combined queue view immediately
      router.push('/(app)/work/messages/queue');
    }
  };

  return (
    <Screen scroll backgroundColor={colors.background}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }} hitSlop={8} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>
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

      {/* Tekst komunikatu */}
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.textCard, { backgroundColor: colors.surface }]}>
          {paragraphs.map((para, idx) => (
            <View key={idx}>
              {idx > 0 && <View style={[styles.divider, { backgroundColor: colors.textSecondary + '33' }]} />}
              <Text style={[styles.paraText, { color: colors.text }]}>{para}</Text>
            </View>
          ))}
        </View>

        {/* Akcje */}
        <View style={styles.actions}>

          {/* Kopiuj */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.surface }]}
            onPress={handleCopy}
          >
            <MaterialCommunityIcons name={copied ? 'check' : 'content-copy'} size={20} color={copied ? colors.accent : colors.text} />
            <Text style={[styles.actionText, { color: copied ? colors.accent : colors.text }]}>
              {copied ? 'Skopiowano' : 'Kopiuj tekst'}
            </Text>
          </TouchableOpacity>

          {/* Dodaj do kolejki (tylko dla nowych, nie z kolejki) */}
          {!fromQueue && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: addedToQueue ? colors.accent + '22' : colors.surface }]}
              onPress={handleAddToQueue}
              disabled={addedToQueue}
            >
              <MaterialCommunityIcons
                name={addedToQueue ? 'check-circle' : 'playlist-plus'}
                size={20}
                color={addedToQueue ? colors.accent : colors.text}
              />
              <Text style={[styles.actionText, { color: addedToQueue ? colors.accent : colors.text }]}>
                {addedToQueue ? 'Dodano do kolejki' : 'Dodaj do kolejki'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Nowy komunikat */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.accent }]}
            onPress={() => router.push('/(app)/work/messages')}
          >
            <MaterialCommunityIcons name="plus" size={20} color="#fff" />
            <Text style={[styles.actionText, { color: '#fff' }]}>Nowy komunikat</Text>
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
  divider: { height: 1, marginVertical: 16 },
  paraText: { fontSize: 18, lineHeight: 28, fontWeight: '400' },
  actions: { gap: 10 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderRadius: 14, paddingVertical: 14,
  },
  actionText: { fontSize: 15, fontWeight: '600' },
});
