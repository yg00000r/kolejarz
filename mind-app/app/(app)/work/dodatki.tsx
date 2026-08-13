import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DODATEK_A_RAW from '../../../constants/dodatek_a.json';
import DODATEK_B_RAW from '../../../constants/dodatek_b.json';
import { trainBadgeStyle } from '../../../constants/trainBadge';
import { useTheme, useColors, Palette } from '../../../contexts/ThemeContext';
import { Screen } from '../../../components/Screen';

// ─── Types ────────────────────────────────────────────────────────────────────

type Trakcja = {
  pojazd: string | null;
  nr: number | null;
  od: string | null;
  do: string | null;
  wlasciciel: string | null;
  vmax: number | null;
  info: string | null;
};

type Wagon = {
  typ: string | null;
  seria?: string | null;
  mark?: string | null;
  uwaga_kod: string | null;
  nr: number | string | null;
  relacja: string | null;
  vmax?: number | null;
  kody?: string | null;
};

type Uwaga = { kod: string | null; tekst: string };
type UwagaKurs = string | { kod: string | null; tekst: string };

type Train = {
  kategoria: string;
  nr_krajowy: string;
  nr_miedzynarodowy?: string | null;
  nazwa: string | null;
  skad: string | null;
  via: string | null;
  dokad: string | null;
  kursuje: string | null;
  is_emu?: boolean;
  depot?: string;
  uwagi_kursowania: UwagaKurs[];
  trakcja: Trakcja[];
  wagony: Wagon[];
  uwagi: Uwaga[];
};

const TRAINS_A: Train[] = DODATEK_A_RAW as unknown as Train[];
const TRAINS_B: Train[] = DODATEK_B_RAW as unknown as Train[];

// ─── Helpers ──────────────────────────────────────────────────────────────────


function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function matchesTrain(t: Train, q: string): boolean {
  if (!q) return true;
  const n = normalize(q);
  return (
    normalize(t.nr_krajowy).includes(n) ||
    normalize(t.nr_miedzynarodowy ?? '').includes(n) ||
    normalize(t.nazwa ?? '').includes(n)
  );
}

// ─── Sklad entry types ────────────────────────────────────────────────────────

type SkladEntry = {
  badge: string;       // [LOK] / [11] / [JKT]
  typ: string;         // X4EA / Amnouz (61) / ED250
  relacja?: string;
  vmax?: number | null;
  info?: string | null;
  isLok: boolean;
  isEmu: boolean;
};

function buildSklad(train: Train): SkladEntry[] {
  const entries: SkladEntry[] = [];
  const isEmuTrain = train.is_emu ?? train.trakcja.some(t => t.pojazd && /^ED/.test(String(t.pojazd)));

  // Trakcja — tylko dla pociągów lokomotywowych (nie EZT)
  if (!isEmuTrain) {
    for (const t of train.trakcja) {
      const p = t.pojazd;
      if (!p || typeof p !== 'string') continue;
      if (/^\d+$/.test(p)) continue;      // pomiń czysto numeryczne
      if (/^\d+t\b/.test(p)) continue;    // pomiń notacje wagowe "390t na odc."
      entries.push({
        badge: '[LOK]',
        typ: t.nr ? `${p}  nr ${t.nr}` : p,
        relacja: [t.od, t.do].filter(Boolean).join(' → ') || undefined,
        vmax: t.vmax,
        info: t.info,
        isLok: true,
        isEmu: false,
      });
    }
  }
  // Dla EZT trakcja jest pominięta — numery jednostek widoczne w wagony

  // Wagony (dla EZT: numery modułów; dla lokomotywowych: wagony pasażerskie)
  for (const w of train.wagony) {
    const typ = w.typ ?? '?';
    const nr = w.nr != null ? String(w.nr) : null;
    entries.push({
      badge: nr ? `[${nr}]` : '[W]',
      typ,
      relacja: w.relacja ?? undefined,
      vmax: w.vmax,
      info: w.uwaga_kod ?? undefined,
      isLok: false,
      isEmu: /^ED/.test(typ),
    });
  }

  return entries;
}

// ─── Wagon row (pionowy) ──────────────────────────────────────────────────────

function SkladRow({ entry, accent, colors }: {
  entry: SkladEntry;
  accent: string;
  colors: Palette;
}) {
  const badgeBg = entry.isLok ? '#1E293B' : entry.isEmu ? '#0F172A' : accent + '22';
  const badgeColor = entry.isLok ? '#F8FAFC' : entry.isEmu ? '#94A3B8' : accent;
  const borderColor = entry.isLok ? '#475569' : entry.isEmu ? '#334155' : accent + '44';

  return (
    <View style={styles.skladRow}>
      <View style={[styles.skladBadge, { backgroundColor: badgeBg, borderColor }]}>
        <Text style={[styles.skladBadgeText, { color: badgeColor }]}>{entry.badge}</Text>
      </View>
      <View style={styles.skladRowInfo}>
        <Text style={[styles.skladTyp, { color: colors.text }]}>{entry.typ}</Text>
        {!!entry.relacja && (
          <Text style={[styles.skladRelacja, { color: colors.textSecondary }]} numberOfLines={1}>
            {entry.relacja}
          </Text>
        )}
      </View>
      {entry.vmax != null && entry.vmax > 10 && (
        <Text style={[styles.skladVmax, { color: colors.textSecondary }]}>{entry.vmax} km/h</Text>
      )}
    </View>
  );
}

// ─── Train card ───────────────────────────────────────────────────────────────

function TrainCard({ train, colors }: { train: Train; colors: Palette }) {
  const [open, setOpen] = useState(false);
  const badge = trainBadgeStyle(train.kategoria, '');
  const cc = badge.bg;
  const sklad = buildSklad(train);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface }]}
      activeOpacity={0.85}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setOpen(o => !o); }}
    >
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={[styles.katBadge, { backgroundColor: cc }]}>
          <Text style={[styles.katText, { color: badge.text }]}>{train.kategoria}</Text>
        </View>
        <View style={styles.cardTitleGroup}>
          <Text style={[styles.cardNr, { color: colors.text }]}>{train.nr_krajowy}</Text>
          {train.nr_miedzynarodowy && (
            <Text style={[styles.cardNrMiedz, { color: colors.textSecondary }]}>int. {train.nr_miedzynarodowy}</Text>
          )}
        </View>
        {!!train.nazwa && (
          <Text style={[styles.cardNazwa, { color: cc }]} numberOfLines={1}>{train.nazwa}</Text>
        )}
        <MaterialCommunityIcons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textSecondary}
        />
      </View>

      {/* Relacja zawsze widoczna */}
      <Text style={[styles.relacjaText, { color: colors.text }]} numberOfLines={1}>
        {[train.skad, train.dokad].filter(Boolean).join(' → ')}
      </Text>

      {/* Rozwinięcie */}
      {open && (
        <View style={[styles.expandBody, { borderTopColor: colors.border }]}>

          {/* Via */}
          {!!train.via && (
            <View style={styles.metaRow}>
              <MaterialCommunityIcons name="ray-start-arrow" size={13} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>{train.via}</Text>
            </View>
          )}

          {/* Kursuje */}
          {!!train.kursuje && (
            <View style={styles.metaRow}>
              <MaterialCommunityIcons name="calendar-clock" size={13} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>{train.kursuje}</Text>
            </View>
          )}
          {train.uwagi_kursowania.map((u, i) => (
            <Text key={i} style={[styles.metaExtra, { color: colors.textSecondary }]}>
              {typeof u === 'string' ? u : `${(u as { kod: string | null; tekst: string }).kod ? (u as { kod: string | null; tekst: string }).kod + ' ' : ''}${(u as { kod: string | null; tekst: string }).tekst}`}
            </Text>
          ))}

          {/* Skład */}
          {sklad.length > 0 && (
            <View style={styles.skladSection}>
              <Text style={[styles.skladLabel, { color: colors.textSecondary }]}>SKŁAD</Text>
              {sklad.map((entry, i) => (
                <SkladRow key={i} entry={entry} accent={cc} colors={colors} />
              ))}
            </View>
          )}

          {/* Uwagi */}
          {train.uwagi.length > 0 && (
            <View style={[styles.uwagiBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
              {train.uwagi.map((u, i) => (
                <Text key={i} style={[styles.uwagiText, { color: colors.textSecondary }]}>
                  {u.kod ? <Text style={{ color: colors.text, fontWeight: '700' }}>{u.kod} </Text> : null}
                  {u.tekst}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

type Tab = 'A' | 'B';

export default function DodatkiScreen() {
  const { isDark } = useTheme();
  const colors = useColors();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('A');
  const [query, setQuery] = useState('');

  const data = tab === 'A' ? TRAINS_A : TRAINS_B;

  const filtered = useMemo(() => {
    const q = query.trim();
    return q ? data.filter(t => matchesTrain(t, q)) : data;
  }, [data, query]);

  const switchTab = (t: Tab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTab(t);
    setQuery('');
  };

  return (
    <Screen scroll backgroundColor={colors.background}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }} hitSlop={8} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Zestawienia składów</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: colors.surface }]}>
        {(['A', 'B'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && { backgroundColor: colors.accent }]}
            onPress={() => switchTab(t)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, { color: tab === t ? '#fff' : colors.textSecondary }]}>
              Dodatek {t}
            </Text>
            <Text style={[styles.tabSub, { color: tab === t ? '#ffffff99' : colors.textSecondary + '88' }]}>
              {t === 'A' ? 'Międzynarodowe' : 'Krajowe'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={[styles.searchRow, { backgroundColor: colors.surface }]}>
        <MaterialCommunityIcons name="magnify" size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Numer pociągu lub nazwa (np. 1300, SILESIA)"
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="characters"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <MaterialCommunityIcons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Count */}
      <Text style={[styles.countLabel, { color: colors.textSecondary }]}>
        {filtered.length} pociągów
      </Text>

      {/* List */}
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {filtered.map((t, i) => (
          <TrainCard key={`${t.nr_krajowy}-${i}`} train={t} colors={colors} />
        ))}
        {filtered.length === 0 && (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="train-variant" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Brak wyników</Text>
          </View>
        )}
      </ScrollView>

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
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', marginLeft: 8 },
  tabBar: {
    flexDirection: 'row', marginHorizontal: 16, borderRadius: 14,
    marginBottom: 10, padding: 4, gap: 4,
  },
  tabBtn: {
    flex: 1, borderRadius: 11, paddingVertical: 10, alignItems: 'center',
  },
  tabText: { fontSize: 14, fontWeight: '700' },
  tabSub: { fontSize: 10, marginTop: 1 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 8, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 10, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15 },
  countLabel: {
    fontSize: 11, fontWeight: '600', letterSpacing: 0.5,
    paddingHorizontal: 20, marginBottom: 8,
  },
  list: { paddingHorizontal: 16, gap: 8 },
  card: { borderRadius: 16, padding: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  katBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  katText: { fontSize: 11, fontWeight: '700' },
  cardTitleGroup: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  cardNr: { fontSize: 16, fontWeight: '700' },
  cardNrMiedz: { fontSize: 11 },
  cardNazwa: { flex: 1, fontSize: 13, fontWeight: '600', textAlign: 'right' },
  relacjaText: { fontSize: 13, fontWeight: '500', marginBottom: 2 },
  expandBody: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 10, paddingTop: 10, gap: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  metaText: { fontSize: 12, flex: 1, lineHeight: 17 },
  metaExtra: { fontSize: 11, paddingLeft: 19, lineHeight: 16 },
  skladSection: { marginTop: 4, gap: 4 },
  skladLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 2 },
  skladRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  skladBadge: {
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, minWidth: 46, alignItems: 'center',
  },
  skladBadgeText: { fontSize: 11, fontWeight: '700', fontFamily: 'monospace' },
  skladRowInfo: { flex: 1 },
  skladTyp: { fontSize: 13, fontWeight: '600' },
  skladRelacja: { fontSize: 11, marginTop: 1 },
  skladVmax: { fontSize: 11 },
  uwagiBox: {
    borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 4, gap: 3,
  },
  uwagiText: { fontSize: 11, lineHeight: 16 },
  empty: { alignItems: 'center', gap: 12, paddingTop: 80 },
  emptyText: { fontSize: 15 },
});
