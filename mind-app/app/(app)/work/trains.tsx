import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { FadeSlideIn } from '../../../components/FadeSlideIn';
import { Colors } from '../../../constants/theme';
import { trainBadgeLabel, trainBadgeStyle } from '../../../constants/trainBadge';
import { useTheme } from '../../../contexts/ThemeContext';
import { Screen } from '../../../components/Screen';
import {
  type TrainLive,
  type TrainSearchResult,
  type TrainStation,
  fetchTrainLive,
  searchTrain,
} from '../../../services/work';

function getDateIso(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}


function calcDelayMin(planned?: string, actual?: string): number | null {
  if (!planned || !actual) return null;
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  let d = toMin(actual) - toMin(planned);
  if (d < -120) d += 1440; // midnight crossing
  return d;
}

function TimeRow({
  label, planned, actual, accentColor,
}: {
  label: string; planned?: string; actual?: string; accentColor: string;
}) {
  if (!planned && !actual) return null;
  const delay = calcDelayMin(planned, actual);
  const showDiff = delay !== null && actual !== planned;
  return (
    <View style={styles.timeRow}>
      <Text style={styles.timeLabel}>{label}</Text>
      {showDiff ? (
        <>
          <Text style={styles.timePlannedStrike}>{planned}</Text>
          <Text style={[styles.timeActual, { color: delay! > 0 ? '#F59E0B' : '#10B981' }]}>{actual}</Text>
          {delay! > 0 && <Text style={styles.timeDelay}>+{delay}</Text>}
        </>
      ) : (
        <Text style={[styles.timePlain, { color: actual ? accentColor : '#6B7280' }]}>
          {actual ?? planned}
        </Text>
      )}
    </View>
  );
}

function StationTimes({ st, accentColor }: { st: TrainStation; accentColor: string }) {
  const hasArr = st.arrivalPlanned || st.arrivalActual;
  const hasDep = st.departurePlanned || st.departureActual;
  if (!hasArr && !hasDep) return null;
  return (
    <View style={styles.stationTimesCol}>
      {!!hasArr && (
        <TimeRow label="Prz" planned={st.arrivalPlanned} actual={st.arrivalActual} accentColor={accentColor} />
      )}
      {!!hasDep && (
        <TimeRow label="Odj" planned={st.departurePlanned} actual={st.departureActual} accentColor={accentColor} />
      )}
    </View>
  );
}

export default function TrainsScreen() {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const router = useRouter();
  const params = useLocalSearchParams<{ number?: string; date?: string }>();

  const [query, setQuery] = useState(params.number ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrainSearchResult | null>(null);
  const [live, setLive] = useState<TrainLive | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);

  const handleSearch = async (dateOffset = 0, overrideQuery?: string, overrideDate?: string) => {
    const num = (overrideQuery ?? query).trim();
    if (!num) return;
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setError(null);
    setResult(null);
    setLive(null);
    const date = overrideDate ?? getDateIso(dateOffset);
    try {
      const data = await searchTrain(num, date);
      setResult(data);
      setLiveLoading(true);
      try {
        const liveData = await fetchTrainLive(data.orderId, data.scheduleId, date);
        setLive(liveData);
      } catch {
        // live data not available — not critical
      } finally {
        setLiveLoading(false);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Błąd wyszukiwania');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.number) {
      handleSearch(0, params.number, params.date);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const badge = result ? trainBadgeStyle(result.category, result.carrier ?? '') : { bg: colors.accent, text: '#fff' };

  return (
    <Screen backgroundColor={colors.background}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }} style={styles.backBtn} hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Pociągi w trasie</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Search bar */}
      <View style={[styles.searchRow, { backgroundColor: colors.surface }]}>
        <MaterialCommunityIcons name="train" size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Numer pociągu (np. 13100)"
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          keyboardType="numeric"
          returnKeyType="search"
          onSubmitEditing={() => handleSearch(0)}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setResult(null); setError(null); setLive(null); }} hitSlop={8}>
            <MaterialCommunityIcons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Search buttons */}
      <View style={styles.btnRow}>
        <TouchableOpacity
          style={[styles.btnSecondary, { backgroundColor: colors.surface, opacity: loading ? 0.5 : 1 }]}
          onPress={() => handleSearch(-1)}
          disabled={loading}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="chevron-left" size={16} color={colors.textSecondary} />
          <Text style={[styles.btnSecondaryText, { color: colors.textSecondary }]}>Wczoraj</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnPrimary, { backgroundColor: colors.accent, opacity: loading ? 0.7 : 1 }]}
          onPress={() => handleSearch(0)}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <MaterialCommunityIcons name="magnify" size={18} color="#fff" />
              <Text style={styles.btnPrimaryText}>Szukaj (dziś)</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Error */}
        {error && (
          <View style={[styles.errorCard, { backgroundColor: colors.error + '22', borderColor: colors.error + '44' }]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        )}

        {/* Result card */}
        {result && (
          <FadeSlideIn key={result.orderId} style={[styles.resultCard, { backgroundColor: colors.surface }]}>
            {/* Train header */}
            <View style={styles.trainHeader}>
              <View style={[styles.catBadge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.catText, { color: badge.text }]}>
                  {trainBadgeLabel(result.category || '?')}
                </Text>
              </View>
              <View style={styles.trainTitleGroup}>
                <Text style={[styles.trainNum, { color: colors.text }]}>#{result.number}</Text>
                {!!result.name && (
                  <Text style={[styles.trainName, { color: colors.textSecondary }]}>{result.name}</Text>
                )}
              </View>
              {live && (
                <View style={[styles.delayBadge, { backgroundColor: live.delay > 0 ? '#F59E0B22' : '#10B98122' }]}>
                  <Text style={[styles.delayText, { color: live.delay > 0 ? '#F59E0B' : '#10B981' }]}>
                    {live.delay > 0 ? `+${live.delay} min` : 'Na czas'}
                  </Text>
                </View>
              )}
            </View>

            {/* Route */}
            <View style={styles.routeRow}>
              <View style={styles.routeEndpoint}>
                <Text style={[styles.routeLabel, { color: colors.textSecondary }]}>Z</Text>
                <Text style={[styles.routeCity, { color: colors.text }]}>{result.from}</Text>
                <Text style={[styles.routeTime, { color: colors.textSecondary }]}>{result.departureTime}</Text>
              </View>
              <MaterialCommunityIcons name="arrow-right" size={20} color={badge.bg} />
              <View style={styles.routeEndpoint}>
                <Text style={[styles.routeLabel, { color: colors.textSecondary }]}>Do</Text>
                <Text style={[styles.routeCity, { color: colors.text }]}>{result.to}</Text>
                <Text style={[styles.routeTime, { color: colors.textSecondary }]}>{result.arrivalTime}</Text>
              </View>
            </View>

            {/* Live position */}
            {liveLoading ? (
              <View style={[styles.liveRow, { borderTopColor: colors.border }]}>
                <ActivityIndicator color={colors.accent} size="small" />
                <Text style={[styles.liveLabel, { color: colors.textSecondary }]}>Pobieranie pozycji...</Text>
              </View>
            ) : live ? (
              <View style={[styles.liveRow, { borderTopColor: colors.border }]}>
                <MaterialCommunityIcons name="map-marker-outline" size={18} color={colors.accent} />
                <View>
                  <Text style={[styles.liveLabel, { color: colors.textSecondary }]}>Aktualna pozycja</Text>
                  <Text style={[styles.liveStation, { color: colors.text }]}>{live.currentStation}</Text>
                </View>
              </View>
            ) : null}
          </FadeSlideIn>
        )}

        {/* Stations list */}
        {(() => {
          const stations = live?.stations?.length ? live.stations : result?.stations ?? [];
          if (!stations.length) return null;
          const isLive = !!(live?.stations?.length);
          return (
          <View style={[styles.stationsCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.stationsTitle, { color: colors.textSecondary }]}>
              {isLive ? 'Trasa (live)' : 'Trasa (rozkład)'}
            </Text>
            {stations.map((st, i) => (
              <View
                key={i}
                style={[
                  styles.stationRow,
                  i < stations.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
                ]}
              >
                <MaterialCommunityIcons
                  name={st.confirmed ? 'check-circle' : 'circle-outline'}
                  size={14}
                  color={st.confirmed ? '#10B981' : colors.border}
                />
                <Text
                  style={[styles.stationName, { color: st.confirmed ? colors.text : colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {st.name}
                </Text>
                <StationTimes st={st} accentColor={colors.accent} />
              </View>
            ))}
          </View>
          );
        })()}

        {/* Empty state */}
        {!result && !error && !loading && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="train-variant" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Wyszukaj pociąg</Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              Wpisz numer pociągu IC/TLK/RE i kliknij Szukaj (dziś) lub Wczoraj dla nocnych przyjazdów.
            </Text>
          </View>
        )}
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
  headerTitle: { flex: 1, fontSize: 22, fontWeight: '700', marginLeft: 8 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 8, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 10, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 16 },
  btnRow: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, gap: 8,
  },
  btnSecondary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, gap: 4,
  },
  btnSecondaryText: { fontSize: 15, fontWeight: '600' },
  btnPrimary: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, paddingVertical: 12, gap: 8,
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  content: { paddingHorizontal: 16, gap: 12 },
  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, padding: 14, borderWidth: 1,
  },
  errorText: { fontSize: 14, flex: 1 },
  resultCard: { borderRadius: 16, padding: 16, gap: 0 },
  trainHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  catBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  catText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  trainTitleGroup: { flex: 1 },
  trainNum: { fontSize: 18, fontWeight: '700' },
  trainName: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  delayBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  delayText: { fontSize: 13, fontWeight: '700' },
  routeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 14,
  },
  routeEndpoint: { flex: 1, alignItems: 'center', gap: 2 },
  routeLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  routeCity: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  routeTime: { fontSize: 13 },
  liveRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderTopWidth: 1, paddingTop: 12,
  },
  liveLabel: { fontSize: 11 },
  liveStation: { fontSize: 15, fontWeight: '600' },
  stationsCard: { borderRadius: 16, padding: 16 },
  stationsTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  stationRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  stationName: { flex: 1, fontSize: 14 },
  stationTimesCol: { alignItems: 'flex-end', gap: 2 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  timeLabel: { fontSize: 10, color: '#9CA3AF', width: 22 },
  timePlannedStrike: { fontSize: 11, color: '#9CA3AF', textDecorationLine: 'line-through' },
  timeActual: { fontSize: 12, fontWeight: '600' },
  timeDelay: { fontSize: 10, color: '#F59E0B', fontWeight: '700' },
  timePlain: { fontSize: 12, fontWeight: '500' },
  emptyState: { alignItems: 'center', gap: 12, paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
