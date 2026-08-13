import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { FadeSlideIn } from '../../../components/FadeSlideIn';
import { PressScale } from '../../../components/PressScale';
import { Screen } from '../../../components/Screen';
import { ScreenHeader, ScreenHeaderIconButton } from '../../../components/ScreenHeader';
import { iosContinuousCurve, radius } from '../../../constants/layout';
import { Colors } from '../../../constants/theme';
import { useTheme, useColors } from '../../../contexts/ThemeContext';
import { useAppLayout } from '../../../hooks/useAppLayout';
import { type Shift, type ShiftTyp, fetchNextShift, fetchShifts, syncShifts } from '../../../services/work';

const TYP_COLOR: Record<ShiftTyp | 'nieznany', string> = {
  praca:    '#3B82F6',
  inne:     '#8B5CF6',
  wolne:    '#6B7280',
  l4:       '#F59E0B',
  nieznany: '#9CA3AF',
};

const TIMECARD_COLOR: Record<string, string> = {
  do_potwierdzenia: '#F59E0B',
  zatwierdzona:     '#10B981',
  wydana:           '#3B82F6',
  rozliczona:       '#6B7280',
  edytowalna:       '#8B5CF6',
};

const TIMECARD_LABEL: Record<string, string> = {
  do_potwierdzenia: 'Do potwierdzenia',
  zatwierdzona:     'Zatwierdzona',
  wydana:           'Wydana',
  rozliczona:       'Rozliczona',
  edytowalna:       'Edytowalna',
};

const DAYS_PL = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
const MONTHS_PL = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

type WorkViewMode = 'grid' | 'list';
const VIEW_MODE_KEY = 'mind_work_view_mode';

function formatShiftDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return `${DAYS_PL[d.getDay()]}, ${d.getDate()} ${MONTHS_PL[d.getMonth()]}`;
}

function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(iso + 'T00:00:00').getTime() - today.getTime()) / 86_400_000);
}

const SUB_MODULES = [
  { id: 'schedule',        label: 'Grafik',          icon: 'calendar-month-outline', desc: 'Twoje służby' },
  { id: 'portal-messages', label: 'Wiadomości',      icon: 'email-outline',          desc: 'Skrzynka odbiorcza' },
  { id: 'accounts',        label: 'Konta',           icon: 'chart-bar',              desc: 'Statystyki pracy' },
  { id: 'timecard',        label: 'Karty pracy',     icon: 'clipboard-check-outline',desc: 'tylko podgląd' },
  { id: 'messages',        label: 'Komunikaty',      icon: 'message-text-outline',   desc: 'tylko podgląd' },
  { id: 'trains',          label: 'Pociąg',          icon: 'train',                  desc: 'w trasie' },
  { id: 'crew',            label: 'Załoga',          icon: 'account-group-outline',  desc: 'Drużyna pociągowa' },
  { id: 'routes',          label: 'Kontrolka',       icon: 'map-marker-path',        desc: 'Szlaków' },
  { id: 'station',         label: 'Sprawdź rozkład', icon: 'timetable',              desc: 'na stacji' },
  { id: 'abc',             label: 'Opracowania',     icon: 'book-open-outline',      desc: 'od instruktorów' },
  { id: 'dodatki',         label: 'Dodatki',         icon: 'train-car-passenger',    desc: 'Zestawienia pociągów' },
] as const;

type SubModuleId = (typeof SUB_MODULES)[number]['id'];

export default function WorkScreen() {
  const { isDark } = useTheme();
  const colors = useColors();
  const router = useRouter();
  const { sectionLabelSize, isLargePhone, tileWidth, tileGap } = useAppLayout();
  const cardRadius = isLargePhone ? radius.lg : radius.md;
  const tileRadius = isLargePhone ? radius.lg : radius.md;

  const [nextShift, setNextShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [hasPendingTimecards, setHasPendingTimecards] = useState(false);
  const [viewMode, setViewMode] = useState<WorkViewMode>('grid');

  useEffect(() => {
    AsyncStorage.getItem(VIEW_MODE_KEY).then((v) => {
      if (v === 'grid' || v === 'list') setViewMode(v);
    });
  }, []);

  const toggleViewMode = () => {
    Haptics.selectionAsync();
    setViewMode((prev) => {
      const next: WorkViewMode = prev === 'grid' ? 'list' : 'grid';
      AsyncStorage.setItem(VIEW_MODE_KEY, next).catch(() => {});
      return next;
    });
  };

  useEffect(() => {
    fetchNextShift()
      .then(setNextShift)
      .catch(() => setNextShift(null))
      .finally(() => setLoading(false));

    const now = new Date();
    fetchShifts(now.getMonth() + 1, now.getFullYear())
      .then(shifts => {
        const hasPending = shifts.some(s => ['do_potwierdzenia', 'wydana'].includes(s.statusKarty ?? '') && s.typ === 'praca');
        setHasPendingTimecards(hasPending);
      })
      .catch(() => {});
  }, []);

  const handleSync = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSyncing(true);
    try {
      const { count } = await syncShifts();
      await fetchNextShift().then(setNextShift).catch(() => {});
      const now = new Date();
      fetchShifts(now.getMonth() + 1, now.getFullYear())
        .then(shifts => {
          setHasPendingTimecards(shifts.some(s => ['do_potwierdzenia', 'wydana'].includes(s.statusKarty ?? '') && s.typ === 'praca'));
        })
        .catch(() => {});
      Alert.alert('Portal', `Zsynchronizowano ${count} służb`);
    } catch (e) {
      Alert.alert('Błąd', e instanceof Error ? e.message : 'Nie udało się zsynchronizować grafiku');
    } finally {
      setSyncing(false);
    }
  };

  const handleSubModule = (id: SubModuleId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/(app)/work/${id}` as any);
  };

  const shiftColor = nextShift ? (TYP_COLOR[nextShift.typ] ?? TYP_COLOR.nieznany) : colors.accent;
  const daysLeft = nextShift ? daysUntil(nextShift.date) : null;

  return (
    <Screen scroll centerContent backgroundColor={colors.background}>
      <ScreenHeader
        title="Praca"
        textColor={colors.text}
        right={
          <View style={styles.headerActions}>
            <ScreenHeaderIconButton onPress={toggleViewMode}>
              <MaterialCommunityIcons
                name={viewMode === 'grid' ? 'view-list-outline' : 'view-grid-outline'}
                size={22}
                color={colors.accent}
              />
            </ScreenHeaderIconButton>
            {syncing ? (
              <View style={styles.syncSpinner}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            ) : (
              <ScreenHeaderIconButton onPress={handleSync}>
                <MaterialCommunityIcons name="refresh" size={22} color={colors.accent} />
              </ScreenHeaderIconButton>
            )}
          </View>
        }
      />

      <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontSize: sectionLabelSize }]}>
        Najbliższa służba
      </Text>

        {loading ? (
          <View style={[styles.nextShiftCard, { backgroundColor: colors.surface }]}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : nextShift ? (
          <PressScale
            style={[
              styles.nextShiftCard,
              Platform.OS === 'ios' && iosContinuousCurve,
              { backgroundColor: shiftColor + '18', borderColor: shiftColor + '44', borderWidth: 1, borderRadius: cardRadius },
            ]}
            onPress={() => handleSubModule('schedule')}
          >
            <View style={styles.nextShiftTop}>
              <View style={[styles.codeBadge, { backgroundColor: shiftColor }]}>
                <Text style={styles.codeBadgeText}>{nextShift.sluzba}</Text>
              </View>
              <Text style={[styles.daysLeft, { color: shiftColor }]}>
                {daysLeft === 0 ? 'Dziś' : daysLeft === 1 ? 'Jutro' : `Za ${daysLeft} dni`}
              </Text>
            </View>
            <Text style={[styles.nextShiftDate, { color: colors.text }]}>{formatShiftDate(nextShift.date)}</Text>
            <Text style={[styles.nextShiftOpisText, { color: colors.textSecondary }]}>{nextShift.opis}</Text>
            {nextShift.start && (
              <Text style={[styles.nextShiftTime, { color: colors.text }]}>
                {nextShift.start} – {nextShift.end}
              </Text>
            )}
            {nextShift.statusKarty && (
              <View style={[styles.timecardBadge, { backgroundColor: TIMECARD_COLOR[nextShift.statusKarty] ?? '#6B7280' }]}>
                <Text style={styles.timecardBadgeText}>{TIMECARD_LABEL[nextShift.statusKarty] ?? nextShift.statusKarty}</Text>
              </View>
            )}
          </PressScale>
        ) : (
          <PressScale
            style={[
              styles.nextShiftCard,
              Platform.OS === 'ios' && iosContinuousCurve,
              { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: cardRadius },
            ]}
            onPress={() => handleSubModule('schedule')}
          >
            <MaterialCommunityIcons name="calendar-blank" size={32} color={colors.textSecondary} />
            <Text style={[styles.noShiftText, { color: colors.textSecondary }]}>
              Brak danych grafiku
            </Text>
            <Text style={[styles.noShiftSub, { color: colors.textSecondary }]}>
              Kliknij odśwież, żeby pobrać grafik
            </Text>
          </PressScale>
        )}

        {viewMode === 'grid' ? (
          <View style={[styles.subGrid, { gap: tileGap }]}>
            {SUB_MODULES.map((mod, i) => (
              <FadeSlideIn key={mod.id} delay={i * 50} style={{ width: tileWidth }}>
                <PressScale
                  style={[
                    styles.subTile,
                    Platform.OS === 'ios' && iosContinuousCurve,
                    { backgroundColor: colors.surface, borderRadius: tileRadius },
                  ]}
                  onPress={() => handleSubModule(mod.id)}
                >
                  {mod.id === 'timecard' && hasPendingTimecards && (
                    <View style={styles.pendingDot} />
                  )}
                  <MaterialCommunityIcons name={mod.icon as any} size={26} color={colors.accent} />
                  <Text style={[styles.subTileLabel, { color: colors.text }]}>{mod.label}</Text>
                  <Text style={[styles.subTileDesc, { color: colors.textSecondary }]}>{mod.desc}</Text>
                </PressScale>
              </FadeSlideIn>
            ))}
          </View>
        ) : (
          <View style={styles.subList}>
            {SUB_MODULES.map((mod, i) => (
              <FadeSlideIn key={mod.id} delay={i * 35}>
                <PressScale
                  style={[
                    styles.listRow,
                    Platform.OS === 'ios' && iosContinuousCurve,
                    { backgroundColor: colors.surface, borderRadius: tileRadius },
                  ]}
                  onPress={() => handleSubModule(mod.id)}
                >
                  <View style={[styles.listIcon, { backgroundColor: colors.accent + '18' }]}>
                    <MaterialCommunityIcons name={mod.icon as any} size={22} color={colors.accent} />
                  </View>
                  <View style={styles.listText}>
                    <Text style={[styles.listLabel, { color: colors.text }]}>{mod.label}</Text>
                    <Text style={[styles.listDesc, { color: colors.textSecondary }]}>{mod.desc}</Text>
                  </View>
                  {mod.id === 'timecard' && hasPendingTimecards && (
                    <View style={[styles.pendingDot, styles.pendingDotList]} />
                  )}
                  <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textSecondary} />
                </PressScale>
              </FadeSlideIn>
            ))}
          </View>
        )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
    width: '100%',
  },
  nextShiftCard: {
    borderRadius: radius.lg,
    padding: 18,
    marginBottom: 28,
    minHeight: 100,
    justifyContent: 'center',
    gap: 6,
    width: '100%',
  },
  nextShiftTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  codeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  codeBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  daysLeft: { fontSize: 13, fontWeight: '700' },
  nextShiftDate: { fontSize: 20, fontWeight: '700' },
  nextShiftOpisText: { fontSize: 13 },
  nextShiftTime: { fontSize: 16, fontWeight: '600' },
  noShiftText: { fontSize: 15, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  noShiftSub: { fontSize: 12, textAlign: 'center' },
  timecardBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4 },
  timecardBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  syncSpinner: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  subGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%' },
  subTile: {
    padding: 16,
    gap: 6,
    minHeight: 100,
    justifyContent: 'center',
    position: 'relative',
  },
  pendingDot: {
    position: 'absolute', top: 10, right: 10,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  subTileLabel: { fontSize: 15, fontWeight: '600' },
  subTileDesc: { fontSize: 12 },

  // Compact list view
  subList: { width: '100%', gap: 8 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  listIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  listText: { flex: 1, gap: 2 },
  listLabel: { fontSize: 16, fontWeight: '600' },
  listDesc: { fontSize: 12 },
  pendingDotList: { position: 'relative', top: 0, right: 0, marginRight: 4 },
});
