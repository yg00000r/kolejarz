import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BreadRain } from '../../../components/BreadRain';
import { FadeSlideIn } from '../../../components/FadeSlideIn';
import { Screen } from '../../../components/Screen';
import { useTheme, useColors, Palette } from '../../../contexts/ThemeContext';
import { type CrewMember, type CrewOnTrip, fetchCrewOnTrip } from '../../../services/work';

const DAYS_PL = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
const MONTHS_PL = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateLabel(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return `${DAYS_PL[d.getDay()]}, ${d.getDate()} ${MONTHS_PL[d.getMonth()]}`;
}

const ROLE_COLOR: Record<string, string> = {
  KP: '#8B5CF6',
  K: '#3B82F6',
  M: '#F59E0B',
};

const ROLE_ICON: Record<string, any> = {
  KP: 'account-tie',
  K: 'ticket-confirmation-outline',
  M: 'train',
};

/** Sort order: kierownik → konduktor → maszynista → reszta. */
const ROLE_RANK: Record<string, number> = { KP: 0, K: 1, M: 2 };

type ThemeColors = Palette;

function CrewCard({ member, accentColor, colors }: { member: CrewMember; accentColor: string; colors: ThemeColors }) {
  const code = (member.crewType ?? '').toUpperCase();
  const roleColor = ROLE_COLOR[code] ?? accentColor;
  const icon = ROLE_ICON[code] ?? 'account';
  const seg = member.segment;

  const callPhone = () => {
    if (!member.phone) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(`tel:${member.phone}`);
  };

  const hasSeg = !!(seg.startStation || seg.endStation);
  const segLine = hasSeg
    ? `${seg.startTime ?? '—'} ${seg.startStation ?? ''} → ${seg.endTime ?? '—'} ${seg.endStation ?? ''}`.replace(/\s+/g, ' ').trim()
    : null;

  return (
    <View style={[styles.crewCard, { backgroundColor: colors.surface }]}>
      <View style={[styles.roleChip, { backgroundColor: roleColor + '22' }]}>
        <MaterialCommunityIcons name={icon} size={20} color={roleColor} />
      </View>
      <View style={styles.crewMain}>
        <Text style={[styles.crewName, { color: colors.text }]} numberOfLines={1}>{member.name}</Text>
        <Text style={[styles.crewRole, { color: roleColor }]} numberOfLines={1}>{member.role}</Text>
        {segLine && (
          <View style={styles.segLineRow}>
            <MaterialCommunityIcons name="map-marker-path" size={13} color={colors.textSecondary} />
            <Text style={[styles.crewSeg, { color: colors.textSecondary }]} numberOfLines={1}>{segLine}</Text>
          </View>
        )}
      </View>
      {member.phone && (
        <TouchableOpacity style={[styles.phoneIconBtn, { backgroundColor: accentColor + '18' }]} onPress={callPhone} hitSlop={8} activeOpacity={0.7}>
          <MaterialCommunityIcons name="phone" size={20} color={accentColor} />
        </TouchableOpacity>
      )}
    </View>
  );
}

/** Easter egg: KP „Dariusz Poręba" w załodze → deszcz chleba. */
function hasDariuszPoreba(members: CrewMember[]): boolean {
  return members.some((m) => {
    const isKp = (m.crewType ?? '').toUpperCase() === 'KP' || m.role === 'Kierownik pociągu';
    const name = m.name.toLowerCase().replace(/\+$/, '').trim();
    return isKp && name === 'dariusz poręba';
  });
}

export default function CrewScreen() {
  const { isDark } = useTheme();
  const colors = useColors();
  const router = useRouter();

  const [trip, setTrip] = useState('');
  const [date, setDate] = useState(toIso(new Date()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CrewOnTrip | null>(null);
  const [showBread, setShowBread] = useState(false);

  const shiftDate = (days: number) => {
    Haptics.selectionAsync();
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setDate(toIso(d));
  };

  const handleSearch = async () => {
    const num = trip.trim();
    if (!num) return;
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await fetchCrewOnTrip(date, num);
      setResult(data);
      if (data.notFound || data.members.length === 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (hasDariuszPoreba(data.members)) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setShowBread(true);
        }
      }
    } catch (e: any) {
      setError(e?.message ?? 'Błąd wyszukiwania');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const sortedMembers = result?.members
    ? [...result.members].sort((a, b) => {
        const ra = ROLE_RANK[(a.crewType ?? '').toUpperCase()] ?? 9;
        const rb = ROLE_RANK[(b.crewType ?? '').toUpperCase()] ?? 9;
        return ra - rb;
      })
    : [];

  return (
    <Screen backgroundColor={colors.background}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }} style={styles.backBtn} hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Załoga pociągu</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Date stepper */}
      <View style={styles.dateRow}>
        <TouchableOpacity onPress={() => shiftDate(-1)} style={[styles.dateArrow, { backgroundColor: colors.surface }]} hitSlop={6}>
          <MaterialCommunityIcons name="chevron-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync(); setDate(toIso(new Date())); }}
          style={[styles.dateLabel, { backgroundColor: colors.surface }]}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="calendar" size={16} color={colors.accent} />
          <Text style={[styles.dateLabelText, { color: colors.text }]}>{formatDateLabel(date)}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => shiftDate(1)} style={[styles.dateArrow, { backgroundColor: colors.surface }]} hitSlop={6}>
          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={[styles.searchRow, { backgroundColor: colors.surface }]}>
        <MaterialCommunityIcons name="train" size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Numer pociągu (np. 6200)"
          placeholderTextColor={colors.textSecondary}
          value={trip}
          onChangeText={setTrip}
          keyboardType="numeric"
          returnKeyType="search"
          onSubmitEditing={handleSearch}
        />
        {trip.length > 0 && (
          <TouchableOpacity onPress={() => { setTrip(''); setResult(null); setError(null); }} hitSlop={8}>
            <MaterialCommunityIcons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={[styles.btnPrimary, { backgroundColor: colors.accent, opacity: loading || !trip.trim() ? 0.6 : 1 }]}
        onPress={handleSearch}
        disabled={loading || !trip.trim()}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <MaterialCommunityIcons name="account-group" size={18} color="#fff" />
            <Text style={styles.btnPrimaryText}>Pokaż załogę</Text>
          </>
        )}
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {error && (
          <View style={[styles.errorCard, { backgroundColor: colors.error + '22', borderColor: colors.error + '44' }]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        )}

        {result && (result.notFound || sortedMembers.length === 0) && !error && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="account-search-outline" size={56} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Brak danych załogi</Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              Dla pociągu {trip} w dniu {formatDateLabel(date)} portal nie zwrócił obsady. Sprawdź numer i datę.
            </Text>
          </View>
        )}

        {result && sortedMembers.length > 0 && (
          <>
            {/* Trip header */}
            <FadeSlideIn style={[styles.tripCard, { backgroundColor: colors.surface }]}>
              <View style={styles.tripTitleRow}>
                <View style={[styles.tripBadge, { backgroundColor: colors.accent }]}>
                  <Text style={styles.tripBadgeText}>#{result.tripNumber}</Text>
                </View>
                <Text style={[styles.tripCount, { color: colors.textSecondary }]}>
                  {sortedMembers.length} {sortedMembers.length === 1 ? 'osoba' : 'os.'}
                </Text>
              </View>
              {(result.fromStation || result.toStation) && (
                <View style={styles.tripRoute}>
                  <View style={styles.routeEndpoint}>
                    <Text style={[styles.routeCity, { color: colors.text }]}>{result.fromStation ?? '—'}</Text>
                    <Text style={[styles.routeTime, { color: colors.textSecondary }]}>{result.startTime ?? ''}</Text>
                  </View>
                  <MaterialCommunityIcons name="arrow-right" size={18} color={colors.accent} />
                  <View style={styles.routeEndpoint}>
                    <Text style={[styles.routeCity, { color: colors.text }]}>{result.toStation ?? '—'}</Text>
                    <Text style={[styles.routeTime, { color: colors.textSecondary }]}>{result.endTime ?? ''}</Text>
                  </View>
                </View>
              )}
            </FadeSlideIn>

            {sortedMembers.map((m, i) => (
              <FadeSlideIn key={`${m.name}-${i}`} delay={i * 40}>
                <CrewCard member={m} accentColor={colors.accent} colors={colors} />
              </FadeSlideIn>
            ))}
          </>
        )}

        {!result && !error && !loading && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="account-group-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Sprawdź drużynę pociągową</Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              Wybierz datę, wpisz numer pociągu i zobacz kierownika, konduktorów i maszynistów wraz z odcinkami i telefonami.
            </Text>
          </View>
        )}
      </ScrollView>

      {showBread && <BreadRain onDone={() => setShowBread(false)} />}
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
  dateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 8,
  },
  dateArrow: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  dateLabel: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 44, borderRadius: 14,
  },
  dateLabelText: { fontSize: 15, fontWeight: '600' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 8, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 10, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 16 },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 16, marginBottom: 16,
    borderRadius: 14, paddingVertical: 12, gap: 8,
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  content: { paddingHorizontal: 16, gap: 12, paddingBottom: 24 },
  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, padding: 14, borderWidth: 1,
  },
  errorText: { fontSize: 14, flex: 1 },
  tripCard: { borderRadius: 16, padding: 16, gap: 12 },
  tripTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tripBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  tripBadgeText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  tripCount: { fontSize: 13, fontWeight: '600' },
  tripRoute: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  routeEndpoint: { flex: 1, alignItems: 'center', gap: 2 },
  routeCity: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  routeTime: { fontSize: 13 },
  crewCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, paddingVertical: 13, paddingHorizontal: 14,
  },
  roleChip: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
  crewMain: { flex: 1, gap: 3 },
  crewName: { fontSize: 16, fontWeight: '700' },
  crewRole: { fontSize: 13, fontWeight: '700' },
  segLineRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  crewSeg: { fontSize: 13, flex: 1 },
  phoneIconBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyState: { alignItems: 'center', gap: 12, paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
