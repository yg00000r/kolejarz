import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BASE_URL } from '../../../constants/api';
import { Colors } from '../../../constants/theme';
import { trainBadgeLabel, trainBadgeStyle } from '../../../constants/trainBadge';
import { useTheme } from '../../../contexts/ThemeContext';
import { Screen } from '../../../components/Screen';

// ─── Types ────────────────────────────────────────────────────────────────────

type TimetableEntry = {
  orderId: number;
  trainNumber: string;
  name: string | null;
  category: string;
  carrier: string;
  scheduledTime: string;
  actualTime: string | null;
  delayMin: number;
  direction: string;
  platform: string | null;
  track: string | null;
  cancelled: boolean;
};

type Station = { id: number; name: string };
type TabType = 'departure' | 'arrival';

// ─── Constants ────────────────────────────────────────────────────────────────

const FAVOURITE_STATIONS: Station[] = [
  { id: 80416, name: 'Kraków Główny' },
  { id: 33605, name: 'Warszawa Centralna' },
  { id: 60103, name: 'Wrocław Główny' },
  { id: 30601, name: 'Poznań Główny' },
  { id: 73312, name: 'Katowice' },
  { id: 7500,  name: 'Gdańsk Główny' },
  { id: 46706, name: 'Łódź Kaliska' },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function StationScreen() {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const router = useRouter();

  const [tab, setTab] = useState<TabType>('departure');
  const [station, setStation] = useState<Station>(FAVOURITE_STATIONS[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Station[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [fromTime, setFromTime] = useState<string>(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch timetable ──────────────────────────────────────────────────────────
  const fetchTimetable = useCallback(async (st: Station, t: TabType, ft: string) => {
    setLoading(true);
    setError(null);
    try {
      const date = new Date().toISOString().slice(0, 10);
      const url = `${BASE_URL}/station/timetable?stationId=${st.id}&date=${date}&type=${t}&fromTime=${encodeURIComponent(ft)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: TimetableEntry[] = await res.json();
      setEntries(data);
      setLastUpdated(new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }));
    } catch {
      setError('Błąd pobierania rozkładu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTimetable(station, tab, fromTime);
  }, [station, tab, fromTime, fetchTimetable]);

  // ── Station search ───────────────────────────────────────────────────────────
  const onSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (text.length < 2) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`${BASE_URL}/station/search?q=${encodeURIComponent(text)}`);
        const data: Station[] = await res.json();
        setSearchResults(data);
      } catch { /* ignore */ }
    }, 300);
  };

  const selectStation = (s: Station) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStation(s);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const switchTab = (t: TabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTab(t);
  };

  const refresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    fetchTimetable(station, tab, fromTime);
  };

  const shiftTime = (deltaHours: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFromTime(prev => {
      const [h, m] = prev.split(':').map(Number);
      const totalMin = Math.max(0, Math.min(23 * 60 + 59, h * 60 + m + deltaHours * 60));
      return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
    });
  };

  const resetToNow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const now = new Date();
    setFromTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
  };

  const showFullDay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFromTime('00:00');
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <Screen scroll backgroundColor={colors.background}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }} style={styles.backBtn} hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Rozkład stacyjny</Text>
        <TouchableOpacity onPress={refresh} hitSlop={8}>
          <MaterialCommunityIcons name="refresh" size={24} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Station selector */}
      <TouchableOpacity
        style={[styles.stationSelector, { backgroundColor: colors.surface }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowSearch(v => !v); }}
      >
        <MaterialCommunityIcons name="map-marker-outline" size={20} color={colors.accent} />
        <Text style={[styles.stationName, { color: colors.text }]}>{station.name}</Text>
        <MaterialCommunityIcons name={showSearch ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      {/* Search panel */}
      {showSearch && (
        <View style={[styles.searchPanel, { backgroundColor: colors.surface }]}>
          <View style={[styles.searchRow, { borderColor: colors.border }]}>
            <MaterialCommunityIcons name="magnify" size={18} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Szukaj stacji..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={onSearchChange}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                <MaterialCommunityIcons name="close-circle" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Favourites or search results */}
          {(searchResults.length > 0 ? searchResults : FAVOURITE_STATIONS).map(s => (
            <TouchableOpacity
              key={s.id}
              style={[styles.stationItem, s.id === station.id && { backgroundColor: colors.accent + '22' }]}
              onPress={() => selectStation(s)}
            >
              <MaterialCommunityIcons
                name={searchResults.length === 0 ? 'star-outline' : 'train'}
                size={14}
                color={s.id === station.id ? colors.accent : colors.textSecondary}
              />
              <Text style={[styles.stationItemText, { color: s.id === station.id ? colors.accent : colors.text }]}>
                {s.name}
              </Text>
              {s.id === station.id && <MaterialCommunityIcons name="check" size={14} color={colors.accent} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Tabs */}
      <View style={[styles.tabs, { backgroundColor: colors.surface }]}>
        {(['departure', 'arrival'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && { backgroundColor: colors.accent }]}
            onPress={() => switchTab(t)}
          >
            <MaterialCommunityIcons
              name={t === 'departure' ? 'train-car' : 'train-car-flatbed-car'}
              size={16}
              color={tab === t ? '#fff' : colors.textSecondary}
            />
            <Text style={[styles.tabText, { color: tab === t ? '#fff' : colors.textSecondary }]}>
              {t === 'departure' ? 'Odjazdy' : 'Przyjazdy'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Time filter */}
      <View style={[styles.timeRow, { backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={() => shiftTime(-1)} style={styles.timeBtn} hitSlop={8}>
          <MaterialCommunityIcons name="chevron-left" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={fromTime === '00:00' ? resetToNow : showFullDay} style={styles.timeMid} hitSlop={4}>
          <MaterialCommunityIcons name="clock-outline" size={14} color={colors.accent} />
          <Text style={[styles.timeLabel, { color: colors.text }]}>
            {fromTime === '00:00' ? 'Cały dzień' : `Od ${fromTime}`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => shiftTime(1)} style={styles.timeBtn} hitSlop={8}>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Table header */}
      <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
        <Text style={[styles.colTime, styles.colHeader, { color: colors.textSecondary }]}>Czas</Text>
        <Text style={[styles.colTrain, styles.colHeader, { color: colors.textSecondary }]}>Pociąg</Text>
        <Text style={[styles.colDir, styles.colHeader, { color: colors.textSecondary }]}>
          {tab === 'departure' ? 'Kierunek' : 'Skąd'}
        </Text>
        <Text style={[styles.colPlatform, styles.colHeader, { color: colors.textSecondary }]}>Tor</Text>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="alert-circle-outline" size={40} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          <TouchableOpacity onPress={refresh} style={[styles.retryBtn, { backgroundColor: colors.accent }]}>
            <Text style={styles.retryText}>Spróbuj ponownie</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {lastUpdated && (
            <Text style={[styles.updatedAt, { color: colors.textSecondary }]}>
              Aktualizacja: {lastUpdated}
            </Text>
          )}
          {entries.length === 0 ? (
            <View style={styles.center}>
              <MaterialCommunityIcons name="train-variant" size={48} color={colors.textSecondary} />
              <Text style={[styles.errorText, { color: colors.textSecondary }]}>Brak połączeń</Text>
            </View>
          ) : entries.map(entry => {
            const delayed = entry.delayMin > 0;
            const badge = trainBadgeStyle(entry.category, entry.carrier);
            const realTime = delayed && entry.actualTime ? entry.actualTime : null;
            const today = new Date().toISOString().slice(0, 10);

            return (
              <TouchableOpacity
                key={entry.orderId}
                activeOpacity={0.7}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({ pathname: '/(app)/work/trains', params: { number: entry.trainNumber, date: today } });
                }}
                style={[styles.tableRow, { borderBottomColor: colors.border }, entry.cancelled && styles.cancelled]}
              >
                {/* Czas */}
                <View style={styles.colTime}>
                  <Text style={[styles.timeScheduled, { color: delayed ? colors.textSecondary : colors.text, textDecorationLine: delayed ? 'line-through' : 'none' }]}>
                    {entry.scheduledTime}
                  </Text>
                  {realTime && (
                    <Text style={[styles.timeReal, { color: colors.warning }]}>{realTime}</Text>
                  )}
                  {delayed && !realTime && (
                    <Text style={[styles.timeReal, { color: colors.warning }]}>+{entry.delayMin}</Text>
                  )}
                </View>

                {/* Pociąg */}
                <View style={[styles.colTrain, styles.trainCell]}>
                  <View style={[styles.catBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.catText, { color: badge.text }]}>
                      {trainBadgeLabel(entry.category)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.trainNum, { color: colors.text }]}>{entry.trainNumber}</Text>
                    {entry.name && (
                      <Text style={[styles.trainName, { color: badge.bg }]} numberOfLines={1}>{entry.name}</Text>
                    )}
                  </View>
                </View>

                {/* Kierunek */}
                <View style={styles.colDir}>
                  <Text style={[styles.direction, { color: entry.cancelled ? colors.error : colors.text }]} numberOfLines={2}>
                    {entry.cancelled ? '⊘ Odwołany' : entry.direction}
                  </Text>
                </View>

                {/* Tor */}
                <View style={styles.colPlatform}>
                  {entry.platform && (
                    <Text style={[styles.platform, { color: colors.accent }]}>{entry.platform}</Text>
                  )}
                  {entry.track && (
                    <Text style={[styles.track, { color: colors.textSecondary }]}>{entry.track}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </Screen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: '700', marginLeft: 8 },
  stationSelector: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 4, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  stationName: { flex: 1, fontSize: 16, fontWeight: '600' },
  searchPanel: {
    marginHorizontal: 16, marginBottom: 6, borderRadius: 14, overflow: 'hidden', paddingBottom: 4,
  },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 10, marginVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 15 },
  stationItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  stationItemText: { flex: 1, fontSize: 14 },
  tabs: {
    flexDirection: 'row', marginHorizontal: 16, marginVertical: 8,
    borderRadius: 14, padding: 4, gap: 4,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 8, borderRadius: 10,
  },
  tabText: { fontSize: 14, fontWeight: '600' },
  tableHeader: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1,
  },
  colHeader: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, alignItems: 'center',
  },
  cancelled: { opacity: 0.45 },
  colTime: { width: 52 },
  colTrain: { width: 94 },
  colDir: { flex: 1 },
  colPlatform: { width: 36, alignItems: 'center' },
  timeScheduled: { fontSize: 14, fontWeight: '600' },
  timeReal: { fontSize: 13, fontWeight: '700' },
  trainCell: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  catBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, marginTop: 1 },
  catText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  trainNum: { fontSize: 12, fontWeight: '600' },
  trainName: { fontSize: 10, fontWeight: '500' },
  direction: { fontSize: 14 },
  platform: { fontSize: 15, fontWeight: '700' },
  track: { fontSize: 11, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  errorText: { fontSize: 15, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 4 },
  retryText: { color: '#fff', fontWeight: '600' },
  updatedAt: { fontSize: 11, textAlign: 'right', paddingHorizontal: 16, paddingVertical: 6 },
  timeRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 6, borderRadius: 10,
    paddingVertical: 4,
  },
  timeBtn: { padding: 6 },
  timeMid: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
  },
  timeLabel: { fontSize: 13, fontWeight: '600' },
});
