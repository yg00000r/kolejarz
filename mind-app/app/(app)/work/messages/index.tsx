import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { TrainRunSession } from '../../../../constants/komunikaty';
import { Colors } from '../../../../constants/theme';
import { useTheme } from '../../../../contexts/ThemeContext';
import { isRunSessionValid, loadRunSession } from '../../../../services/trainSession';
import { getQueue, QueuedMessage } from '../../../../services/messageQueue';
import { Screen } from '../../../../components/Screen';

export default function MessagesIndex() {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const router = useRouter();

  const [run, setRun] = useState<TrainRunSession | null>(null);
  const [queueCount, setQueueCount] = useState(0);

  useFocusEffect(useCallback(() => {
    loadRunSession().then(setRun);
    setQueueCount(getQueue().length);
  }, []));

  const hasRun = isRunSessionValid(run);

  return (
    <Screen backgroundColor={colors.background}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }} hitSlop={8} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Komunikaty</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* ── Pilnowanie card ── */}
        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.accent + '15', borderColor: colors.accent, borderWidth: 1.5 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (hasRun) {
              router.push('/(app)/work/messages/watch');
            } else {
              router.push('/(app)/work/messages/setup-run');
            }
          }}
          activeOpacity={0.75}
        >
          <View style={[styles.cardIcon, { backgroundColor: colors.accent }]}>
            <MaterialCommunityIcons name="shield-check-outline" size={26} color="#fff" />
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Pilnowanie</Text>
            {hasRun && run ? (
              <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                {run.category} {run.trainName ? `„${run.trainName}" ` : ''}{run.trainNumber} · {run.stationFrom} → {run.stationTo}
              </Text>
            ) : (
              <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                Skonfiguruj trasę i generuj komunikaty automatycznie
              </Text>
            )}
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.accent} />
        </TouchableOpacity>

        {/* Queue indicator */}
        {queueCount > 0 && (
          <TouchableOpacity
            style={[styles.queueBanner, { backgroundColor: colors.surface }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(app)/work/messages/queue');
            }}
          >
            <View style={[styles.queueDot, { backgroundColor: colors.accent }]}>
              <Text style={styles.queueDotText}>{queueCount}</Text>
            </View>
            <Text style={[styles.queueLabel, { color: colors.text }]}>Komunikaty w kolejce</Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}

        {/* ── Classic templates card ── */}
        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.surface, marginTop: 12 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/(app)/work/messages/classic');
          }}
          activeOpacity={0.75}
        >
          <View style={[styles.cardIcon, { backgroundColor: colors.textSecondary + '33' }]}>
            <MaterialCommunityIcons name="format-list-bulleted" size={24} color={colors.textSecondary} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Klasyczne szablony</Text>
            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>Ręczne tworzenie komunikatów po typie</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* ── Setup link ── */}
        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.surface, marginTop: 8 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/(app)/work/messages/setup-run');
          }}
          activeOpacity={0.75}
        >
          <View style={[styles.cardIcon, { backgroundColor: colors.textSecondary + '33' }]}>
            <MaterialCommunityIcons name="cog-outline" size={24} color={colors.textSecondary} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Konfiguracja trasy</Text>
            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>Import z PLK lub ręczne wprowadzanie danych</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textSecondary} />
        </TouchableOpacity>

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

  card: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, borderRadius: 16, padding: 16, gap: 14,
  },
  cardIcon: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  cardSub: { fontSize: 13, marginTop: 3, lineHeight: 18 },

  queueBanner: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 12,
    borderRadius: 12, padding: 12, gap: 10,
  },
  queueDot: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  queueDotText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  queueLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
});
