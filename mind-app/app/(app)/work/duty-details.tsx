import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../../constants/theme';
import { useTheme, useColors } from '../../../contexts/ThemeContext';
import { type DutyDetails, fetchDutyDetails } from '../../../services/work';
import { Screen } from '../../../components/Screen';

const COMPONENT_COLOR: Record<string, string> = {
  ADM:    '#8B5CF6',
  OBJ:    '#3B82F6',
  BrdPce: '#10B981',
  Umlstk: '#10B981',
  PRZ:    '#F59E0B',
  AblHin: '#6B7280',
  AblRück:'#6B7280',
  BEZPAU: '#EF4444',
  Rez:    '#EC4899',
};

const COMPONENT_ICON: Record<string, string> = {
  ADM:    'clipboard-text-outline',
  OBJ:    'train',
  BrdPce: 'train-variant',
  Umlstk: 'train-variant',
  PRZ:    'swap-horizontal',
  AblHin: 'walk',
  AblRück:'walk',
  BEZPAU: 'coffee-outline',
  Rez:    'clock-outline',
};

export default function DutyDetailsScreen() {
  const { isDark } = useTheme();
  const colors = useColors();
  const router = useRouter();
  const { date, shiftCode } = useLocalSearchParams<{ date: string; shiftCode: string }>();

  const [details, setDetails] = useState<DutyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!date) return;
    fetchDutyDetails(date)
      .then(setDetails)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [date]);

  const d = date ? new Date(date + 'T00:00:00') : null;
  const DAYS_PL = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
  const MONTHS_PL = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
  const dateLabel = d ? `${DAYS_PL[d.getDay()]}, ${d.getDate()} ${MONTHS_PL[d.getMonth()]}` : date;

  return (
    <Screen scroll backgroundColor={colors.background}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }} style={styles.backBtn} hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{shiftCode ?? 'Szczegóły'}</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>{dateLabel}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>Nie udało się pobrać szczegółów</Text>
        </View>
      ) : !details || details.components.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="calendar-blank" size={48} color={colors.textSecondary} />
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>Brak rozbicia dla tego dnia</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header info */}
          <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
            {details.crewType && (
              <InfoRow icon="account-group" label="Typ załogi" value={details.crewType} colors={colors} />
            )}
            {details.depot && (
              <InfoRow icon="home-city-outline" label="Betriebshof" value={details.depot} colors={colors} />
            )}
            {details.startTime && (
              <InfoRow icon="clock-start" label="Początek" value={details.startTime} colors={colors} />
            )}
            {details.workTime && (
              <InfoRow icon="briefcase-clock" label="Czas pracy" value={details.workTime} colors={colors} />
            )}
            {details.paidTime && (
              <InfoRow icon="cash-clock" label="Czas płatny" value={details.paidTime} colors={colors} />
            )}
            {details.needsConfirmation && (
              <View style={[styles.confirmBanner, { backgroundColor: '#F59E0B22' }]}>
                <MaterialCommunityIcons name="alert-circle" size={16} color="#F59E0B" />
                <Text style={{ color: '#F59E0B', fontWeight: '600', fontSize: 13 }}>Karta wymaga potwierdzenia</Text>
              </View>
            )}
          </View>

          {/* Timeline */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Elementy służby</Text>

          {details.components.map((comp, i) => {
            const cColor = COMPONENT_COLOR[comp.type] ?? '#6B7280';
            const cIcon = COMPONENT_ICON[comp.type] ?? 'circle-outline';
            const isLast = i === details.components.length - 1;

            return (
              <View key={`${comp.type}-${i}`} style={styles.timelineItem}>
                {/* Timeline connector */}
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineDot, { backgroundColor: cColor }]}>
                    <MaterialCommunityIcons name={cIcon as any} size={14} color="#fff" />
                  </View>
                  {!isLast && <View style={[styles.timelineLine, { backgroundColor: cColor + '33' }]} />}
                </View>

                {/* Content */}
                <View style={[styles.timelineCard, { backgroundColor: colors.surface }]}>
                  <View style={styles.compHeader}>
                    <View style={[styles.compBadge, { backgroundColor: cColor + '22' }]}>
                      <Text style={[styles.compBadgeText, { color: cColor }]}>{comp.type}</Text>
                    </View>
                    <Text style={[styles.compLongName, { color: colors.textSecondary }]}>{comp.typeLongName}</Text>
                  </View>

                  <View style={styles.compTimes}>
                    <View style={styles.compTimeBlock}>
                      <Text style={[styles.compTimeLabel, { color: colors.textSecondary }]}>Od</Text>
                      <Text style={[styles.compTime, { color: colors.text }]}>{comp.startTime}</Text>
                      <Text style={[styles.compStation, { color: colors.textSecondary }]} numberOfLines={1}>{comp.startStation}</Text>
                    </View>
                    <MaterialCommunityIcons name="arrow-right" size={16} color={colors.textSecondary} />
                    <View style={[styles.compTimeBlock, { alignItems: 'flex-end' }]}>
                      <Text style={[styles.compTimeLabel, { color: colors.textSecondary }]}>Do</Text>
                      <Text style={[styles.compTime, { color: colors.text }]}>{comp.endTime}</Text>
                      <Text style={[styles.compStation, { color: colors.textSecondary }]} numberOfLines={1}>{comp.endStation}</Text>
                    </View>
                  </View>

                  {(comp.tripNumber || comp.vehicleType) && (
                    <View style={styles.compMeta}>
                      {comp.tripNumber && (
                        <View style={styles.compMetaItem}>
                          <MaterialCommunityIcons name="train" size={12} color={colors.textSecondary} />
                          <Text style={[styles.compMetaText, { color: colors.textSecondary }]}>{comp.tripNumber}</Text>
                        </View>
                      )}
                      {comp.vehicleType && (
                        <View style={styles.compMetaItem}>
                          <MaterialCommunityIcons name="train-car-passenger" size={12} color={colors.textSecondary} />
                          <Text style={[styles.compMetaText, { color: colors.textSecondary }]}>{comp.vehicleType}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </Screen>
  );
}

function InfoRow({ icon, label, value, colors }: { icon: string; label: string; value: string; colors: any }) {
  return (
    <View style={styles.infoRow}>
      <MaterialCommunityIcons name={icon as any} size={18} color={colors.textSecondary} />
      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { fontSize: 22, fontWeight: '700' },
  headerSub: { fontSize: 13 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  errorText: { fontSize: 15, textAlign: 'center' },
  scroll: { paddingHorizontal: 16 },

  infoCard: { borderRadius: 14, padding: 14, marginBottom: 20, gap: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel: { fontSize: 13, flex: 1 },
  infoValue: { fontSize: 14, fontWeight: '600' },

  confirmBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 10, marginTop: 4 },

  sectionLabel: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', marginBottom: 14,
  },

  timelineItem: { flexDirection: 'row', marginBottom: 0 },
  timelineLeft: { width: 32, alignItems: 'center' },
  timelineDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  timelineLine: { width: 2, flex: 1, marginTop: -2, marginBottom: -2 },

  timelineCard: { flex: 1, borderRadius: 12, padding: 12, marginLeft: 8, marginBottom: 10, gap: 8 },
  compHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  compBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  compLongName: { fontSize: 12, flex: 1 },

  compTimes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  compTimeBlock: { gap: 2 },
  compTimeLabel: { fontSize: 10, textTransform: 'uppercase' },
  compTime: { fontSize: 18, fontWeight: '700' },
  compStation: { fontSize: 12, maxWidth: 120 },

  compMeta: { flexDirection: 'row', gap: 14 },
  compMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  compMetaText: { fontSize: 11 },
});
