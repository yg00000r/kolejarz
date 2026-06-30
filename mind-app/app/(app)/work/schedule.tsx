import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../../constants/theme';
import { useTheme, useColors, Palette } from '../../../contexts/ThemeContext';
import { type Shift, type ShiftTyp, fetchShifts, scheduleTimecardReminder } from '../../../services/work';
import { getNotifPrefs } from '../../../services/notifications';
import { Screen } from '../../../components/Screen';
import { SkeletonList } from '../../../components/Skeleton';

// ── Konfiguracja typów służb ──────────────────────────
const TYP_COLOR: Record<ShiftTyp | 'nieznany', string> = {
  praca:    '#3B82F6',
  inne:     '#8B5CF6',
  wolne:    '#6B7280',
  l4:       '#F59E0B',
  nieznany: '#9CA3AF',
};

const TYP_ICON: Record<ShiftTyp | 'nieznany', string> = {
  praca:    'train',
  inne:     'school-outline',
  wolne:    'sleep',
  l4:       'medical-bag',
  nieznany: 'help-circle-outline',
};

const TIMECARD_BADGE: Record<string, { label: string; color: string; icon: string }> = {
  do_potwierdzenia: { label: 'Do potw.',   color: '#F59E0B', icon: 'alert-circle-outline' },
  zatwierdzona:     { label: 'Zatw.',      color: '#10B981', icon: 'check-circle' },
  wydana:           { label: 'Wydana',     color: '#3B82F6', icon: 'send-check' },
  rozliczona:       { label: 'Rozl.',      color: '#6B7280', icon: 'check-all' },
  edytowalna:       { label: 'Edyt.',      color: '#8B5CF6', icon: 'pencil-circle' },
};

const DAYS_PL = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So'];
const MONTHS_PL = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];

function isToday(iso: string) {
  const t = new Date();
  return iso === `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

const WEEKDAY_HEADER = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

type DayEntry = {
  date: string;
  shift: Shift | null;
};

function buildFullMonth(month: number, year: number, shifts: Shift[]): DayEntry[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const shiftMap = new Map(shifts.map(s => [s.date, s]));
  const entries: DayEntry[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    entries.push({ date, shift: shiftMap.get(date) ?? null });
  }
  return entries;
}

function buildCalendarGrid(month: number, year: number, shifts: Shift[]): (DayEntry | null)[][] {
  const days = buildFullMonth(month, year, shifts);
  const firstDow = new Date(year, month, 1).getDay();
  const offset = firstDow === 0 ? 6 : firstDow - 1;
  const cells: (DayEntry | null)[] = [
    ...Array(offset).fill(null),
    ...days,
  ];
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  const weeks: (DayEntry | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

function CalendarCell({
  entry,
  colors,
  onWorkPress,
}: {
  entry: DayEntry | null;
  colors: Palette;
  onWorkPress: (date: string, shiftCode: string) => void;
}) {
  if (entry === null) {
    return <View style={styles.calCell} />;
  }
  const { date, shift } = entry;
  const today = isToday(date);
  const d = new Date(date + 'T00:00:00');
  const dayNum = d.getDate();
  const color = shift ? (TYP_COLOR[shift.typ] ?? TYP_COLOR.nieznany) : '#6B7280';
  const isWork = shift !== null && (shift.typ === 'praca' || shift.typ === 'inne');

  return (
    <TouchableOpacity
      style={[styles.calCell, today && { borderColor: color, borderWidth: 1.5, borderRadius: 10 }]}
      onPress={isWork && shift ? () => onWorkPress(date, shift.sluzba) : undefined}
      activeOpacity={isWork ? 0.7 : 1}
    >
      {shift ? (
        <View style={[styles.calCellBg, { backgroundColor: color + '22' }]} />
      ) : null}
      <Text style={[styles.calDayNum, { color: today ? color : colors.text }]}>{dayNum}</Text>
      {shift ? (
        <>
          <Text style={[styles.calCode, { color }]} numberOfLines={1}>{shift.sluzba}</Text>
          {shift.start ? (
            <Text style={[styles.calTime, { color: colors.textSecondary }]}>{shift.start}</Text>
          ) : null}
        </>
      ) : null}
    </TouchableOpacity>
  );
}

export default function ScheduleScreen() {
  const { isDark } = useTheme();
  const colors = useColors();
  const router = useRouter();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [year, setYear] = useState(now.getFullYear());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [calendarView, setCalendarView] = useState(false);

  const load = useCallback(async (m: number, y: number, isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(false);
    try {
      const data = await fetchShifts(m + 1, y);
      setShifts(data);
      const prefs = await getNotifPrefs();
      if (prefs.timecardReminder) {
        for (const shift of data) {
          if (shift.statusKarty === 'do_potwierdzenia' && shift.typ === 'praca') {
            scheduleTimecardReminder(shift).catch(() => {});
          }
        }
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(month, year); }, [month, year, load]);

  const prevMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  // Statystyki
  const pracodn = shifts.filter(s => s.typ === 'praca').length;
  const inne    = shifts.filter(s => s.typ === 'inne').length;
  const wolne   = shifts.filter(s => s.typ === 'wolne').length;
  const l4      = shifts.filter(s => s.typ === 'l4').length;

  return (
    <Screen scroll backgroundColor={colors.background}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }} style={styles.backBtn} hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Grafik</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCalendarView(v => !v); }}
            hitSlop={8}
            style={{ marginRight: 12 }}
          >
            <MaterialCommunityIcons
              name={calendarView ? 'format-list-bulleted' : 'calendar-month'}
              size={22}
              color={calendarView ? colors.accent : colors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setRefreshing(true); load(month, year, true); }} hitSlop={8}>
            <MaterialCommunityIcons name="refresh" size={22} color={colors.accent} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Month selector */}
      <View style={[styles.monthBar, { backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={prevMonth} hitSlop={12}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.monthLabel, { color: colors.text }]}>{MONTHS_PL[month]} {year}</Text>
        <TouchableOpacity onPress={nextMonth} hitSlop={12}>
          <MaterialCommunityIcons name="chevron-right" size={28} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Statystyki */}
      {!loading && !error && (
        <View style={[styles.statsRow, { backgroundColor: colors.surface }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: TYP_COLOR.praca }]}>{pracodn}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Praca</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: TYP_COLOR.wolne }]}>{wolne}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Wolne</Text>
          </View>
          {inne > 0 && (
            <>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statNum, { color: TYP_COLOR.inne }]}>{inne}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Szk/Bad</Text>
              </View>
            </>
          )}
          {l4 > 0 && (
            <>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statNum, { color: TYP_COLOR.l4 }]}>{l4}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>L4</Text>
              </View>
            </>
          )}
        </View>
      )}

      {loading ? (
        <SkeletonList count={7} />
      ) : error ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="wifi-off" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Nie można pobrać grafiku
          </Text>
          <TouchableOpacity onPress={() => load(month, year)} style={[styles.retryBtn, { backgroundColor: colors.accent }]}>
            <Text style={styles.retryText}>Spróbuj ponownie</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(month, year, true); }}
              tintColor={colors.accent}
            />
          }
        >
          {(() => {
            const days = buildFullMonth(month, year, shifts);
            const allDaysEmpty = days.every(d => d.shift === null);
            if (allDaysEmpty) {
              return (
                <View style={styles.center}>
                  <MaterialCommunityIcons name="calendar-blank" size={48} color={colors.textSecondary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    Brak dyżurów w tym miesiącu
                  </Text>
                </View>
              );
            }

            const openDuty = (date: string, shiftCode: string) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push({ pathname: '/(app)/work/duty-details', params: { date, shiftCode } } as any);
            };

            if (calendarView) {
              const weeks = buildCalendarGrid(month, year, shifts);
              return (
                <>
                  <View style={styles.calHeader}>
                    {WEEKDAY_HEADER.map(wd => (
                      <View key={wd} style={styles.calHeaderCell}>
                        <Text style={[styles.calHeaderText, { color: colors.textSecondary }]}>{wd}</Text>
                      </View>
                    ))}
                  </View>
                  {weeks.map((week, wi) => (
                    <View key={wi} style={styles.calWeekRow}>
                      {week.map((entry, di) => (
                        <CalendarCell
                          key={entry?.date ?? `pad-${wi}-${di}`}
                          entry={entry}
                          colors={colors}
                          onWorkPress={openDuty}
                        />
                      ))}
                    </View>
                  ))}
                </>
              );
            }

            return days.map(({ date, shift }) => {
              const d = new Date(date + 'T00:00:00');
              const today = isToday(date);

              if (shift === null) {
                return (
                  <View
                    key={date}
                    style={[
                      styles.shiftRow,
                      { backgroundColor: isDark ? '#1f2937' : '#F3F4F6' },
                      today && { borderLeftColor: '#6B7280', borderLeftWidth: 3 },
                    ]}
                  >
                    <View style={styles.datePart}>
                      <Text style={[styles.dayName, { color: colors.textSecondary }]}>
                        {DAYS_PL[d.getDay()]}
                      </Text>
                      <Text style={[styles.dayNum, { color: colors.textSecondary }]}>
                        {d.getDate()}
                      </Text>
                    </View>
                    <View style={{ width: 36 }} />
                    <View style={styles.shiftInfo}>
                      <Text style={{ color: '#6B7280', fontSize: 15, fontWeight: '600' }}>Wolne</Text>
                    </View>
                  </View>
                );
              }

              const color = TYP_COLOR[shift.typ] ?? TYP_COLOR.nieznany;
              const icon = TYP_ICON[shift.typ] ?? TYP_ICON.nieznany;
              const badge = shift.statusKarty ? TIMECARD_BADGE[shift.statusKarty] : null;
              const isWorkDay = shift !== null && (shift.typ === 'praca' || shift.typ === 'inne');
              return (
                <TouchableOpacity
                  key={date}
                  activeOpacity={isWorkDay ? 0.7 : 1}
                  onPress={() => {
                    if (!isWorkDay) return;
                    openDuty(shift.date, shift.sluzba);
                  }}
                  style={[
                    styles.shiftRow,
                    { backgroundColor: today ? color + '18' : colors.surface },
                    today && { borderLeftColor: color, borderLeftWidth: 3 },
                  ]}
                >
                  <View style={styles.datePart}>
                    <Text style={[styles.dayName, { color: colors.textSecondary }]}>
                      {DAYS_PL[d.getDay()]}
                    </Text>
                    <Text style={[styles.dayNum, { color: today ? color : colors.text }]}>
                      {d.getDate()}
                    </Text>
                  </View>

                  <View style={[styles.iconCircle, { backgroundColor: color + '22' }]}>
                    <MaterialCommunityIcons name={icon as any} size={18} color={color} />
                  </View>

                  <View style={styles.shiftInfo}>
                    <View style={styles.shiftInfoTop}>
                      <View style={[styles.codeBadge, { backgroundColor: color + '22' }]}>
                        <Text style={[styles.codeText, { color }]}>{shift.sluzba}</Text>
                      </View>
                      {today && (
                        <View style={[styles.todayBadge, { backgroundColor: color }]}>
                          <Text style={styles.todayText}>Dziś</Text>
                        </View>
                      )}
                      {badge && (
                        <View style={[styles.timecardBadge, { backgroundColor: badge.color + '22' }]}>
                          <MaterialCommunityIcons name={badge.icon as any} size={12} color={badge.color} />
                          <Text style={[styles.timecardText, { color: badge.color }]}>{badge.label}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.opisText, { color: colors.text }]}>{shift.opis}</Text>
                    {shift.start ? (
                      <Text style={[styles.shiftTime, { color: colors.textSecondary }]}>
                        {shift.start} – {shift.end}
                      </Text>
                    ) : null}
                  </View>

                  {isWorkDay ? (
                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                  ) : null}
                </TouchableOpacity>
              );
            });
          })()}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: '700', marginLeft: 8 },
  monthBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 16, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 10,
  },
  monthLabel: { fontSize: 16, fontWeight: '600' },
  statsRow: {
    flexDirection: 'row', marginHorizontal: 16, borderRadius: 14,
    padding: 14, marginBottom: 12, alignItems: 'center',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 30, marginHorizontal: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingTop: 80 },
  emptyText: { fontSize: 15, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 4 },
  retryText: { color: '#fff', fontWeight: '600' },
  list: { paddingHorizontal: 16, gap: 8 },
  shiftRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, padding: 12, gap: 10,
  },
  calCell: {
    flex: 1,
    aspectRatio: 0.75,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  calCellBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 8,
  },
  calDayNum: { fontSize: 13, fontWeight: '600', zIndex: 1 },
  calCode: { fontSize: 9, fontWeight: '700', zIndex: 1, letterSpacing: 0.2 },
  calTime: { fontSize: 8, zIndex: 1 },
  calWeekRow: { flexDirection: 'row' },
  calHeader: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 4 },
  calHeaderCell: { flex: 1, alignItems: 'center' },
  calHeaderText: { fontSize: 11, fontWeight: '600' },
  datePart: { width: 34, alignItems: 'center' },
  dayName: { fontSize: 11, fontWeight: '500' },
  dayNum: { fontSize: 20, fontWeight: '700' },
  iconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  shiftInfo: { flex: 1, gap: 2 },
  shiftInfoTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  codeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  codeText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  todayBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  todayText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  opisText: { fontSize: 13, fontWeight: '500' },
  shiftTime: { fontSize: 12 },
  timecardBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  timecardText: { fontSize: 10, fontWeight: '700' },
});
