import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MESSAGE_TYPES, MessageTypeDef, TrainSession } from '../../../../constants/komunikaty';
import { Colors } from '../../../../constants/theme';
import { useTheme } from '../../../../contexts/ThemeContext';
import { isSessionValid, loadTrainSession } from '../../../../services/trainSession';
import { Screen } from '../../../../components/Screen';
import {
  QueuedMessage,
  getQueue,
  removeFromQueue,
  clearQueue,
} from '../../../../services/messageQueue';

const CATEGORY_ORDER = ['Powitalne', 'Pożegnalne', 'Opóźnienia', 'Specjalne'] as const;

const CATEGORY_COLORS: Record<string, string> = {
  'Powitalne': '#4CAF50',
  'Pożegnalne': '#2196F3',
  'Opóźnienia': '#FF9800',
  'Specjalne': '#9C27B0',
};

export default function ClassicScreen() {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const router = useRouter();

  const [session, setSession] = useState<TrainSession | null>(null);
  const [queue, setQueue] = useState<QueuedMessage[]>([]);

  useFocusEffect(useCallback(() => {
    loadTrainSession().then(setSession);
    setQueue([...getQueue()]);
  }, []));

  const sessionValid = isSessionValid(session);

  const handleType = (type: MessageTypeDef) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: '/(app)/work/messages/compose', params: { typeId: type.id } });
  };

  const handleQueueItem = (item: QueuedMessage) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/(app)/work/messages/preview', params: { text: item.text, title: item.title, fromQueue: item.id } });
  };

  const handleRemoveQueue = (id: string) => {
    Alert.alert('Usuń z kolejki', 'Usunąć ten komunikat z kolejki?', [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń', style: 'destructive', onPress: () => {
          removeFromQueue(id);
          setQueue([...getQueue()]);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      },
    ]);
  };

  const grouped = CATEGORY_ORDER.map(cat => ({
    cat,
    types: MESSAGE_TYPES.filter(t => t.category === cat),
  }));

  return (
    <Screen backgroundColor={colors.background}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }} hitSlop={8} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Klasyczne szablony</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Karta pociągu */}
        <TouchableOpacity
          style={[styles.sessionCard, { backgroundColor: colors.surface, borderColor: sessionValid ? colors.accent : colors.textSecondary, borderWidth: 1.5 }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(app)/work/messages/setup-run'); }}
        >
          <View style={styles.sessionRow}>
            <MaterialCommunityIcons
              name={sessionValid ? 'train' : 'train-variant'}
              size={22}
              color={sessionValid ? colors.accent : colors.textSecondary}
            />
            <View style={styles.sessionInfo}>
              {sessionValid && session ? (
                <>
                  <Text style={[styles.sessionTitle, { color: colors.text }]}>
                    {session.category} {session.trainName} {session.trainNumber}
                  </Text>
                  <Text style={[styles.sessionSub, { color: colors.textSecondary }]}>
                    {session.stationStart} → {session.stationEnd} · wag. służb. {session.serviceWagon}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={[styles.sessionTitle, { color: colors.textSecondary }]}>Brak danych pociągu</Text>
                  <Text style={[styles.sessionSub, { color: colors.textSecondary }]}>Dotknij, aby skonfigurować skład</Text>
                </>
              )}
            </View>
            <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>

        {/* Kolejka */}
        {queue.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>KOLEJKA ({queue.length})</Text>
              <View style={styles.sectionActions}>
                <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(app)/work/messages/queue'); }} style={[styles.readAllBtn, { backgroundColor: colors.accent }]}>
                  <Text style={styles.readAllBtnText}>Czytaj</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { clearQueue(); setQueue([]); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                  <Text style={[styles.clearBtn, { color: colors.textSecondary }]}>Wyczyść</Text>
                </TouchableOpacity>
              </View>
            </View>
            {queue.map((item, idx) => (
              <View key={item.id} style={[styles.queueItem, { backgroundColor: colors.surface }]}>
                <TouchableOpacity style={styles.queueMain} onPress={() => handleQueueItem(item)}>
                  <View style={[styles.queueBadge, { backgroundColor: colors.accent }]}>
                    <Text style={styles.queueBadgeText}>{idx + 1}</Text>
                  </View>
                  <Text style={[styles.queueTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleRemoveQueue(item.id)} hitSlop={8} style={styles.queueDelete}>
                  <MaterialCommunityIcons name="close" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {/* Typy komunikatów */}
        {grouped.map(({ cat, types }) => (
          <View key={cat}>
            <Text style={[styles.catLabel, { color: CATEGORY_COLORS[cat] }]}>{cat.toUpperCase()}</Text>
            {types.map(type => (
              <TouchableOpacity
                key={type.id}
                style={[styles.typeRow, { backgroundColor: colors.surface }]}
                onPress={() => handleType(type)}
                activeOpacity={0.75}
              >
                <View style={[styles.typeIcon, { backgroundColor: CATEGORY_COLORS[type.category] + '22' }]}>
                  <MaterialCommunityIcons name={type.icon as any} size={20} color={CATEGORY_COLORS[type.category]} />
                </View>
                <View style={styles.typeInfo}>
                  <Text style={[styles.typeName, { color: colors.text }]}>{type.title}</Text>
                  <Text style={[styles.typeSub, { color: colors.textSecondary }]}>{type.subtitle}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        ))}

      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16,
  },
  backBtn: { padding: 4 },
  title: { flex: 1, fontSize: 22, fontWeight: '700', marginLeft: 8 },
  sessionCard: {
    marginHorizontal: 16, marginBottom: 20,
    borderRadius: 14, padding: 14,
  },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sessionInfo: { flex: 1 },
  sessionTitle: { fontSize: 15, fontWeight: '600' },
  sessionSub: { fontSize: 13, marginTop: 2 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 8,
  },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  sectionActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  readAllBtn: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  readAllBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  clearBtn: { fontSize: 13 },
  queueItem: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 6,
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12,
  },
  queueMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  queueBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  queueBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  queueTitle: { fontSize: 14, fontWeight: '500', flex: 1 },
  queueDelete: { padding: 4 },
  catLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
    paddingHorizontal: 16, marginTop: 20, marginBottom: 8,
  },
  typeRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 6,
    borderRadius: 14, padding: 12, gap: 12,
  },
  typeIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  typeInfo: { flex: 1 },
  typeName: { fontSize: 15, fontWeight: '600' },
  typeSub: { fontSize: 12, marginTop: 2 },
});
