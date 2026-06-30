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
import {
  KOMBATANCI,
  KODY_ULGI_USTAWOWE,
  KODY_ZNIZEK,
  OFERTY,
  POSEL_SENATOR,
  PROMO_LEVELS,
  SLOWNIK,
  ULGI_USTAWOWE,
  type DiscountCode,
  type Offer,
  type UlgaUstawowa,
} from '../../../constants/abc';
import { Colors } from '../../../constants/theme';
import { useTheme, useColors } from '../../../contexts/ThemeContext';
import { Screen } from '../../../components/Screen';

type Tab = 'oferty' | 'kody' | 'ulgi';

// ─── Wiersz kodu zniżkowego ───────────────────────────────────────────────────

function DiscountRow({ kod, opis, znizka, uprawniony, colors }: DiscountCode & { colors: any }) {
  const isFree = znizka === '100%';
  const isNone = znizka === 'N';
  const chipColor = isFree ? '#4CAF50' : isNone ? colors.textSecondary : colors.accent;
  return (
    <View style={[s.discountRow, { backgroundColor: colors.surface }]}>
      <View style={[s.kodBadge, { backgroundColor: chipColor + '22' }]}>
        <Text style={[s.kodNum, { color: chipColor }]}>{kod}</Text>
      </View>
      <View style={s.discountMid}>
        <Text style={[s.discountOpis, { color: colors.text }]}>{opis}</Text>
        {uprawniony && <Text style={[s.discountUpr, { color: colors.textSecondary }]}>{uprawniony}</Text>}
      </View>
      <View style={[s.znizkaChip, { backgroundColor: chipColor + '22' }]}>
        <Text style={[s.znizkaText, { color: chipColor }]}>{znizka}</Text>
      </View>
    </View>
  );
}

// ─── Karta oferty (rozwijana) ─────────────────────────────────────────────────

function OfferCard({ offer, colors, query }: { offer: Offer; colors: any; query: string }) {
  const [open, setOpen] = useState(false);
  const isPromo = offer.nazwa === 'Promo';

  const matchesQuery = !query || [offer.nazwa, offer.opis ?? '', offer.uwagi ?? '']
    .some(str => str.toLowerCase().includes(query.toLowerCase())) ||
    offer.procedures.some(p =>
      p.sytuacja.toLowerCase().includes(query.toLowerCase()) ||
      p.akcja.toLowerCase().includes(query.toLowerCase())
    );

  if (!matchesQuery) return null;

  return (
    <View style={[s.offerCard, { backgroundColor: colors.surface }]}>
      <TouchableOpacity
        style={s.offerHeader}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setOpen(v => !v); }}
        activeOpacity={0.8}
      >
        <View style={s.offerHeaderLeft}>
          <Text style={[s.offerNazwa, { color: colors.text }]}>{offer.nazwa}</Text>
          {offer.opis && <Text style={[s.offerOpis, { color: colors.textSecondary }]}>{offer.opis}</Text>}
          <View style={s.offerMeta}>
            {offer.klasy && (
              <View style={[s.metaChip, { backgroundColor: colors.accent + '20' }]}>
                <Text style={[s.metaText, { color: colors.accent }]}>Kl. {offer.klasy}</Text>
              </View>
            )}
            {offer.kategorie && (
              <View style={[s.metaChip, { backgroundColor: colors.textSecondary + '18' }]}>
                <Text style={[s.metaText, { color: colors.textSecondary }]}>{offer.kategorie}</Text>
              </View>
            )}
          </View>
        </View>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={colors.textSecondary} />
      </TouchableOpacity>

      {open && (
        <View style={[s.offerBody, { borderTopColor: colors.textSecondary + '22' }]}>
          {offer.uwagi && (
            <View style={[s.uwagiBox, { backgroundColor: '#FF980018', borderLeftColor: '#FF9800' }]}>
              <MaterialCommunityIcons name="information-outline" size={14} color="#FF9800" />
              <Text style={[s.uwagiText, { color: colors.text }]}>{offer.uwagi}</Text>
            </View>
          )}
          <Text style={[s.groupLabel, { color: colors.textSecondary }]}>PROCEDURY</Text>
          {offer.procedures.map((p, idx) => (
            <View key={idx} style={[s.procedureRow, { borderLeftColor: colors.accent }]}>
              <Text style={[s.procedureSyt, { color: colors.text }]}>{p.sytuacja}</Text>
              <Text style={[s.procedureAkc, { color: colors.textSecondary }]}>{p.akcja}</Text>
            </View>
          ))}
          {isPromo && (
            <>
              <Text style={[s.groupLabel, { color: colors.textSecondary, marginTop: 16 }]}>POZIOMY PROMO</Text>
              <View style={[s.promoTable, { borderColor: colors.textSecondary + '33' }]}>
                <View style={[s.promoHeaderRow, { backgroundColor: colors.textSecondary + '18' }]}>
                  <Text style={[s.promoTh, { color: colors.textSecondary, flex: 0.8 }]}>Poziom</Text>
                  <Text style={[s.promoTh, { color: colors.textSecondary, flex: 1.2 }]}>Zniżka</Text>
                  <Text style={[s.promoTh, { color: colors.textSecondary, flex: 0.8 }]}>Kod lit.</Text>
                </View>
                {PROMO_LEVELS.map(pl => (
                  <View key={pl.poziom} style={[s.promoRow, { borderTopColor: colors.textSecondary + '22' }]}>
                    <Text style={[s.promoTd, { color: colors.text, flex: 0.8 }]}>{pl.poziom}</Text>
                    <Text style={[s.promoTd, { color: colors.accent, fontWeight: '600', flex: 1.2 }]}>{pl.znizka}</Text>
                    <Text style={[s.promoTd, { color: colors.text, flex: 0.8 }]}>{pl.kod}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Karta ulgi ustawowej (rozwijana) ────────────────────────────────────────

function UlgaCard({ ulga, colors, query }: { ulga: UlgaUstawowa; colors: any; query: string }) {
  const [open, setOpen] = useState(false);

  const matchesQuery = !query || [ulga.grupa, ulga.znizka_jednorazowa, ulga.dokument ?? '', ulga.uwagi ?? '']
    .some(str => str.toLowerCase().includes(query.toLowerCase()));

  if (!matchesQuery) return null;

  const hasAlarm = ulga.uwagi?.toUpperCase().startsWith('WYŁĄCZNIE') || ulga.uwagi?.toUpperCase().startsWith('TYLKO');

  return (
    <View style={[s.ulgaCard, { backgroundColor: colors.surface }]}>
      <TouchableOpacity
        style={s.ulgaHeader}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setOpen(v => !v); }}
        activeOpacity={0.8}
      >
        <View style={s.ulgaHeaderLeft}>
          <Text style={[s.ulgaGrupa, { color: colors.text }]}>{ulga.grupa}</Text>
          <View style={s.ulgaBadges}>
            <View style={[s.ulgaBadge, { backgroundColor: colors.accent + '22' }]}>
              <Text style={[s.ulgaBadgeText, { color: colors.accent }]}>
                jednoraz. {ulga.znizka_jednorazowa}
              </Text>
            </View>
            {ulga.znizka_miesieczna && (
              <View style={[s.ulgaBadge, { backgroundColor: '#9C27B022' }]}>
                <Text style={[s.ulgaBadgeText, { color: '#9C27B0' }]}>
                  mies. {ulga.znizka_miesieczna}
                </Text>
              </View>
            )}
            {hasAlarm && (
              <MaterialCommunityIcons name="alert" size={14} color="#FF9800" style={{ marginLeft: 2 }} />
            )}
          </View>
        </View>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      {open && (
        <View style={[s.ulgaBody, { borderTopColor: colors.textSecondary + '22' }]}>
          {ulga.uwagi && (
            <View style={[s.uwagiBox, { backgroundColor: '#FF980018', borderLeftColor: '#FF9800' }]}>
              <MaterialCommunityIcons name="alert-outline" size={14} color="#FF9800" />
              <Text style={[s.uwagiText, { color: colors.text }]}>{ulga.uwagi}</Text>
            </View>
          )}
          {ulga.dokument && (
            <View style={[s.docBox, { backgroundColor: colors.accent + '12', borderLeftColor: colors.accent }]}>
              <MaterialCommunityIcons name="card-account-details-outline" size={14} color={colors.accent} />
              <Text style={[s.docText, { color: colors.text }]}>{ulga.dokument}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Główny ekran ─────────────────────────────────────────────────────────────

export default function AbcScreen() {
  const { isDark } = useTheme();
  const colors = useColors();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('oferty');
  const [query, setQuery] = useState('');

  const filteredKodyHandlowe = useMemo(() => {
    if (!query) return KODY_ZNIZEK;
    const q = query.toLowerCase();
    return KODY_ZNIZEK.filter(k =>
      k.kod.includes(q) || k.opis.toLowerCase().includes(q) ||
      (k.uprawniony?.toLowerCase().includes(q) ?? false) || k.znizka.toLowerCase().includes(q)
    );
  }, [query]);

  const filteredKodyUstawowe = useMemo(() => {
    if (!query) return KODY_ULGI_USTAWOWE;
    const q = query.toLowerCase();
    return KODY_ULGI_USTAWOWE.filter(k =>
      k.kod.includes(q) || k.opis.toLowerCase().includes(q) ||
      (k.uprawniony?.toLowerCase().includes(q) ?? false) || k.znizka.toLowerCase().includes(q)
    );
  }, [query]);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'oferty', label: 'Oferty' },
    { id: 'kody',   label: 'Kody' },
    { id: 'ulgi',   label: 'Ulgi ustaw.' },
  ];

  return (
    <Screen backgroundColor={colors.background}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }} hitSlop={8} style={s.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.title, { color: colors.text }]}>ABC Odprawa</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Wyszukiwarka */}
      <View style={[s.searchWrap, { backgroundColor: colors.surface }]}>
        <MaterialCommunityIcons name="magnify" size={18} color={colors.textSecondary} />
        <TextInput
          style={[s.searchInput, { color: colors.text }]}
          placeholder="Szukaj oferty, kodu, uprawnienia…"
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Tabs */}
      <View style={[s.tabBar, { backgroundColor: colors.surface }]}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[s.tabBtn, tab === t.id && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTab(t.id); }}
          >
            <Text style={[s.tabText, { color: tab === t.id ? colors.accent : colors.textSecondary }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── TAB: Oferty ── */}
      {tab === 'oferty' && (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={[s.note, { color: colors.textSecondary }]}>Dotknij oferty, aby zobaczyć procedury</Text>
          {OFERTY.map((offer, idx) => (
            <OfferCard key={idx} offer={offer} colors={colors} query={query} />
          ))}
        </ScrollView>
      )}

      {/* ── TAB: Kody ── */}
      {tab === 'kody' && (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={[s.groupLabel, { color: colors.textSecondary }]}>HANDLOWE</Text>
          {filteredKodyHandlowe.map(k => <DiscountRow key={k.kod} {...k} colors={colors} />)}
          {filteredKodyHandlowe.length === 0 && (
            <Text style={[s.emptyText, { color: colors.textSecondary }]}>Brak wyników</Text>
          )}

          <Text style={[s.groupLabel, { color: colors.textSecondary, marginTop: 20 }]}>USTAWOWE</Text>
          {filteredKodyUstawowe.map(k => <DiscountRow key={k.kod} {...k} colors={colors} />)}
          {filteredKodyUstawowe.length === 0 && (
            <Text style={[s.emptyText, { color: colors.textSecondary }]}>Brak wyników</Text>
          )}
        </ScrollView>
      )}

      {/* ── TAB: Ulgi ustawowe ── */}
      {tab === 'ulgi' && (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          <Text style={[s.note, { color: colors.textSecondary }]}>Dotknij grupy, aby zobaczyć wymagany dokument</Text>

          {ULGI_USTAWOWE.map((ulga, idx) => (
            <UlgaCard key={idx} ulga={ulga} colors={colors} query={query} />
          ))}

          {/* Kombatanci */}
          <Text style={[s.groupLabel, { color: colors.textSecondary, marginTop: 20 }]}>KOMBATANCI I INWALIDZI WOJENNI</Text>
          <Text style={[s.note, { color: colors.textSecondary, marginBottom: 8 }]}>
            Zniżka zależy od kategorii pociągu i klasy
          </Text>
          <View style={[s.kombTable, { borderColor: colors.textSecondary + '33' }]}>
            <View style={[s.kombHeaderRow, { backgroundColor: colors.textSecondary + '18' }]}>
              <Text style={[s.kombTh, { color: colors.textSecondary, flex: 2 }]}>Grupa</Text>
              <Text style={[s.kombTh, { color: colors.textSecondary, flex: 1 }]}>TLK/IC</Text>
              <Text style={[s.kombTh, { color: colors.textSecondary, flex: 1 }]}>EIC/P kl.2</Text>
              <Text style={[s.kombTh, { color: colors.textSecondary, flex: 1 }]}>EIC/P kl.1</Text>
            </View>
            {KOMBATANCI.map((row, idx) => (
              <View key={idx} style={[s.kombRow, { borderTopColor: colors.textSecondary + '22' }]}>
                <Text style={[s.kombTdGrupa, { color: colors.text, flex: 2 }]}>{row.grupa}</Text>
                <Text style={[s.kombTd, { color: colors.accent, flex: 1 }]}>{row.tlk_ic}</Text>
                <Text style={[s.kombTd, { color: colors.accent, flex: 1 }]}>{row.eic_eip_kl2}</Text>
                <Text style={[s.kombTd, { color: colors.accent, flex: 1 }]}>{row.eic_eip_kl1}</Text>
              </View>
            ))}
          </View>

          {/* Posłowie i Senatorowie */}
          <Text style={[s.groupLabel, { color: colors.textSecondary, marginTop: 20 }]}>POSŁOWIE I SENATOROWIE</Text>
          <View style={[s.specialCard, { backgroundColor: colors.surface }]}>
            <View style={s.specialRow}>
              <MaterialCommunityIcons name="shield-star-outline" size={18} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[s.specialLabel, { color: colors.textSecondary }]}>Zniżka</Text>
                <Text style={[s.specialVal, { color: colors.text }]}>{POSEL_SENATOR.znizka}</Text>
              </View>
            </View>
            <View style={[s.specialDivider, { backgroundColor: colors.textSecondary + '22' }]} />
            <View style={s.specialRow}>
              <MaterialCommunityIcons name="train" size={18} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[s.specialLabel, { color: colors.textSecondary }]}>Kategorie</Text>
                <Text style={[s.specialVal, { color: colors.text }]}>{POSEL_SENATOR.kategorie}</Text>
              </View>
            </View>
            <View style={[s.specialDivider, { backgroundColor: colors.textSecondary + '22' }]} />
            <View style={s.specialRow}>
              <MaterialCommunityIcons name="bed-outline" size={18} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[s.specialLabel, { color: colors.textSecondary }]}>Miejsca sypialne / kuszetki</Text>
                <Text style={[s.specialVal, { color: colors.text }]}>{POSEL_SENATOR.miejsca}</Text>
              </View>
            </View>
            <View style={[s.specialDivider, { backgroundColor: colors.textSecondary + '22' }]} />
            <View style={s.specialRow}>
              <MaterialCommunityIcons name="card-account-details-outline" size={18} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[s.specialLabel, { color: colors.textSecondary }]}>Dokument</Text>
                <Text style={[s.specialVal, { color: colors.text }]}>{POSEL_SENATOR.dokumenty}</Text>
              </View>
            </View>
          </View>

          {/* Słownik pojęć */}
          <Text style={[s.groupLabel, { color: colors.textSecondary, marginTop: 20 }]}>SŁOWNIK POJĘĆ</Text>
          {SLOWNIK.map((entry, idx) => (
            <View key={idx} style={[s.slownikRow, { backgroundColor: colors.surface }]}>
              <Text style={[s.slownikTerm, { color: colors.text }]}>{entry.term}</Text>
              <Text style={[s.slownikOpis, { color: colors.textSecondary }]}>{entry.opis}</Text>
            </View>
          ))}

        </ScrollView>
      )}

    </Screen>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  title: { flex: 1, fontSize: 22, fontWeight: '700', marginLeft: 8 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15 },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16, marginBottom: 10, borderRadius: 12, overflow: 'hidden',
  },
  tabBtn: {
    flex: 1, paddingVertical: 11, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 12, fontWeight: '600' },
  scroll: { paddingHorizontal: 16, paddingBottom: 60, gap: 8 },
  note: { fontSize: 12, marginBottom: 2 },
  groupLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6 },
  emptyText: { textAlign: 'center', marginTop: 20, fontSize: 14 },

  // Discount rows
  discountRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 12, padding: 12,
  },
  kodBadge: {
    width: 44, height: 44, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  kodNum: { fontSize: 16, fontWeight: '800' },
  discountMid: { flex: 1 },
  discountOpis: { fontSize: 14, fontWeight: '600' },
  discountUpr: { fontSize: 12, marginTop: 2 },
  znizkaChip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  znizkaText: { fontSize: 13, fontWeight: '700' },

  // Offer cards
  offerCard: { borderRadius: 14, overflow: 'hidden' },
  offerHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 8 },
  offerHeaderLeft: { flex: 1, gap: 4 },
  offerNazwa: { fontSize: 16, fontWeight: '700' },
  offerOpis: { fontSize: 13 },
  offerMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  metaChip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  metaText: { fontSize: 11, fontWeight: '600' },
  offerBody: {
    paddingHorizontal: 14, paddingBottom: 16, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, gap: 10,
  },
  uwagiBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderLeftWidth: 3, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8,
  },
  uwagiText: { flex: 1, fontSize: 13, lineHeight: 19 },
  procedureRow: { borderLeftWidth: 3, paddingLeft: 10, gap: 3 },
  procedureSyt: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  procedureAkc: { fontSize: 13, lineHeight: 19 },
  promoTable: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, overflow: 'hidden' },
  promoHeaderRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 12 },
  promoRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 12, borderTopWidth: StyleSheet.hairlineWidth },
  promoTh: { fontSize: 11, fontWeight: '700' },
  promoTd: { fontSize: 13 },

  // Ulga cards
  ulgaCard: { borderRadius: 14, overflow: 'hidden' },
  ulgaHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 8 },
  ulgaHeaderLeft: { flex: 1, gap: 6 },
  ulgaGrupa: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  ulgaBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  ulgaBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  ulgaBadgeText: { fontSize: 11, fontWeight: '700' },
  ulgaBody: {
    paddingHorizontal: 14, paddingBottom: 14, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, gap: 8,
  },
  docBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderLeftWidth: 3, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8,
  },
  docText: { flex: 1, fontSize: 13, lineHeight: 19 },

  // Kombatanci table
  kombTable: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, overflow: 'hidden' },
  kombHeaderRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 10 },
  kombRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 10, borderTopWidth: StyleSheet.hairlineWidth },
  kombTh: { fontSize: 10, fontWeight: '700' },
  kombTdGrupa: { fontSize: 12, lineHeight: 17 },
  kombTd: { fontSize: 12, fontWeight: '600' },

  // Poseł/Senator card
  specialCard: { borderRadius: 14, overflow: 'hidden' },
  specialRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  specialDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 14 },
  specialLabel: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
  specialVal: { fontSize: 14, lineHeight: 20 },

  // Słownik
  slownikRow: { borderRadius: 12, padding: 12, gap: 4 },
  slownikTerm: { fontSize: 14, fontWeight: '700' },
  slownikOpis: { fontSize: 13, lineHeight: 19 },
});
