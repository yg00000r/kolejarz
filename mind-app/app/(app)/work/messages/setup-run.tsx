import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  EMPTY_RUN_SESSION,
  GastroType,
  TrainRunSession,
  TrainStop,
} from '../../../../constants/komunikaty';
import { useTheme, useColors } from '../../../../contexts/ThemeContext';
import {
  loadRunSession,
  saveRunSession,
} from '../../../../services/trainSession';
import { searchTrain, TrainSearchResult } from '../../../../services/work';
import { Screen } from '../../../../components/Screen';

type Step = 'search' | 'stations' | 'details';

const CATEGORIES = ['IC', 'TLK', 'EIC', 'EIP', 'EN', 'IRE', 'IR', 'REG'];

const GASTRO_OPTIONS: { value: GastroType; label: string; desc: string }[] = [
  { value: 'wars',                label: 'WARS',                  desc: 'Wagon restauracyjny' },
  { value: 'wars_automat',       label: 'WARS + automat',         desc: 'Wagon restauracyjny i automat' },
  { value: 'automat',            label: 'Tylko automat',          desc: 'Automaty vendingowe, bez WARS' },
  { value: 'minibar',            label: 'Wózek mini-bar',         desc: 'Wózek gastronomiczny' },
  { value: 'brak_zastepstwo',    label: 'Brak WARS (zast.)',      desc: 'Wyjątkowo brak, jest zastępstwo' },
  { value: 'brak_bez_zastepstwa', label: 'Brak WARS (bez zast.)', desc: 'Planowo WARS, nie jedzie, brak zastępstwa' },
  { value: 'brak',               label: 'Brak gastronomii',       desc: 'Całkowity brak oferty' },
];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function SetupRunScreen() {
  const { isDark } = useTheme();
  const colors = useColors();
  const router = useRouter();

  const [step, setStep] = useState<Step>('search');

  // Step 1: search
  const [trainNumber, setTrainNumber] = useState('');
  const [date, setDate] = useState(todayISO);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [result, setResult] = useState<TrainSearchResult | null>(null);

  // Step 2: station selection
  const [workStart, setWorkStart] = useState<number | null>(null);
  const [workEnd, setWorkEnd] = useState<number | null>(null);

  // Step 3: manual fields
  const [form, setForm] = useState<TrainRunSession>({ ...EMPTY_RUN_SESSION });
  const [saving, setSaving] = useState(false);

  // Restore existing session on mount
  useEffect(() => {
    loadRunSession().then(existing => {
      if (!existing) return;
      setForm(existing);
      if (existing.trainNumber) setTrainNumber(existing.trainNumber);
      if (existing.date) setDate(existing.date);
      if (existing.stops.length >= 2) {
        setWorkStart(existing.workStartIndex);
        setWorkEnd(existing.workEndIndex);
      }
    });
  }, []);

  // ── Step 1: Search ──────────────────────────────────────────────────────────

  const handleSearch = async () => {
    if (!trainNumber.trim()) {
      Alert.alert('Brakujące dane', 'Wpisz numer pociągu.');
      return;
    }
    setSearching(true);
    setSearchError('');
    try {
      const res = await searchTrain(trainNumber.trim(), date);
      setResult(res);

      const stops: TrainStop[] = res.stations.map((st, idx) => ({
        name: st.name,
        arrivalPlanned: st.arrivalPlanned,
        departurePlanned: st.departurePlanned,
        orderIndex: idx,
      }));

      setForm(prev => ({
        ...prev,
        version: 2,
        orderId: res.orderId,
        scheduleId: res.scheduleId,
        date,
        trainNumber: res.number,
        category: res.category || prev.category,
        trainName: res.name || '',
        stationFrom: res.from,
        stationTo: res.to,
        stops,
      }));

      setWorkStart(null);
      setWorkEnd(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('stations');
    } catch (e: any) {
      setSearchError(e?.message || 'Błąd wyszukiwania');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSearching(false);
    }
  };

  // ── Step 2: Station segment selection ───────────────────────────────────────

  const handleStationTap = (idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (workStart === null || (workStart !== null && workEnd !== null)) {
      setWorkStart(idx);
      setWorkEnd(null);
    } else {
      if (idx <= workStart) {
        setWorkStart(idx);
      } else {
        setWorkEnd(idx);
      }
    }
  };

  const confirmStations = () => {
    if (workStart === null || workEnd === null || workEnd <= workStart) {
      Alert.alert('Wybierz odcinek', 'Zaznacz stację początkową i końcową twojego odcinka pracy.');
      return;
    }
    const fromName = form.stops[workStart]?.name ?? '';
    const toName = form.stops[workEnd]?.name ?? '';

    const viaStops = form.stops.slice(workStart + 1, workEnd);
    const viaText = viaStops.length > 2
      ? viaStops.slice(0, 2).map(s => s.name).join(', ') + '…'
      : viaStops.map(s => s.name).join(', ');

    setForm(prev => ({
      ...prev,
      workStartIndex: workStart,
      workEndIndex: workEnd,
      stationFrom: fromName,
      stationTo: toName,
      stationsVia: viaText,
    }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep('details');
  };

  // ── Step 3: Save ───────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.serviceWagon.trim()) {
      Alert.alert('Brakujące dane', 'Podaj numer wagonu służbowego.');
      return;
    }
    setSaving(true);
    await saveRunSession(form);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaving(false);
    router.back();
  };

  const set = <K extends keyof TrainRunSession>(key: K, val: TrainRunSession[K]) =>
    setForm(prev => ({ ...prev, [key]: val }));

  // ── Derived ────────────────────────────────────────────────────────────────

  const showWarsWagon = form.gastroType === 'wars' || form.gastroType === 'wars_automat';
  const showAutomatWagon = form.gastroType === 'wars_automat' || form.gastroType === 'automat' || form.gastroType === 'brak_zastepstwo';
  const showMinibarEnd = form.gastroType === 'minibar';
  const showWarsEnd = form.gastroType === 'wars' || form.gastroType === 'wars_automat';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Screen scroll backgroundColor={colors.background}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (step === 'details') setStep('stations');
              else if (step === 'stations') setStep('search');
              else router.back();
            }}
            hitSlop={8}
            style={styles.backBtn}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>
            {step === 'search' ? 'Konfiguracja trasy' : step === 'stations' ? 'Wybór odcinka' : 'Dane składu'}
          </Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Step indicator */}
        <View style={styles.stepRow}>
          {(['search', 'stations', 'details'] as Step[]).map((s, i) => (
            <View key={s} style={styles.stepItem}>
              <View style={[
                styles.stepDot,
                {
                  backgroundColor: step === s ? colors.accent
                    : (['search', 'stations', 'details'].indexOf(step) > i ? colors.success : colors.surfaceSecondary),
                },
              ]}>
                {['search', 'stations', 'details'].indexOf(step) > i ? (
                  <MaterialCommunityIcons name="check" size={12} color="#fff" />
                ) : (
                  <Text style={styles.stepNum}>{i + 1}</Text>
                )}
              </View>
              <Text style={[styles.stepLabel, { color: step === s ? colors.text : colors.textSecondary }]}>
                {i === 0 ? 'Szukaj' : i === 1 ? 'Odcinek' : 'Skład'}
              </Text>
            </View>
          ))}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* ══════════ STEP 1: SEARCH ══════════ */}
          {step === 'search' && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>WYSZUKAJ POCIĄG</Text>

              <View style={styles.fieldWrap}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Numer pociągu</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
                  value={trainNumber}
                  onChangeText={setTrainNumber}
                  placeholder="np. 4512"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  returnKeyType="search"
                  onSubmitEditing={handleSearch}
                />
              </View>

              <View style={styles.fieldWrap}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Data (RRRR-MM-DD)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
                  value={date}
                  onChangeText={setDate}
                  placeholder="2026-03-21"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              {searchError !== '' && (
                <View style={[styles.errorBanner, { backgroundColor: colors.error + '22' }]}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.error} />
                  <Text style={[styles.errorText, { color: colors.error }]}>{searchError}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.accent, opacity: searching ? 0.6 : 1 }]}
                onPress={handleSearch}
                disabled={searching}
              >
                {searching ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <MaterialCommunityIcons name="magnify" size={20} color="#fff" />
                )}
                <Text style={styles.primaryBtnText}>
                  {searching ? 'Szukam…' : 'Wyszukaj w rozkładzie PLK'}
                </Text>
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                <Text style={[styles.dividerText, { color: colors.textSecondary }]}>lub</Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              </View>

              <TouchableOpacity
                style={[styles.secondaryBtn, { backgroundColor: colors.surface }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/(app)/work/messages/session');
                }}
              >
                <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.textSecondary} />
                <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Wpisz dane ręcznie (klasycznie)</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ══════════ STEP 2: STATIONS ══════════ */}
          {step === 'stations' && result && (
            <>
              {/* Train summary */}
              <View style={[styles.trainCard, { backgroundColor: colors.surface }]}>
                <View style={styles.trainCardHeader}>
                  <MaterialCommunityIcons name="train" size={20} color={colors.accent} />
                  <Text style={[styles.trainCardTitle, { color: colors.text }]}>
                    {result.category} {result.name ? `„${result.name}" ` : ''}{result.number}
                  </Text>
                </View>
                <Text style={[styles.trainCardSub, { color: colors.textSecondary }]}>
                  {result.from} → {result.to}
                </Text>
                <Text style={[styles.trainCardSub, { color: colors.textSecondary }]}>
                  Odj. {result.departureTime} · Przyj. {result.arrivalTime}
                </Text>
              </View>

              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                WYBIERZ ODCINEK PRACY
              </Text>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                Dotknij stację początkową, potem końcową twojego odcinka.
              </Text>

              {form.stops.map((stop, idx) => {
                const isStart = workStart === idx;
                const isEnd = workEnd === idx;
                const inRange = workStart !== null && workEnd !== null && idx >= workStart && idx <= workEnd;
                const isFirst = idx === 0;
                const isLast = idx === form.stops.length - 1;

                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.stationRow,
                      {
                        backgroundColor: (isStart || isEnd)
                          ? colors.accent + '22'
                          : inRange
                            ? colors.success + '11'
                            : colors.surface,
                        borderColor: (isStart || isEnd) ? colors.accent : 'transparent',
                        borderWidth: (isStart || isEnd) ? 1.5 : 0,
                      },
                    ]}
                    onPress={() => handleStationTap(idx)}
                    activeOpacity={0.7}
                  >
                    {/* Timeline */}
                    <View style={styles.timeline}>
                      <View style={[
                        styles.timelineDot,
                        {
                          backgroundColor: (isStart || isEnd)
                            ? colors.accent
                            : inRange ? colors.success : colors.border,
                        },
                      ]} />
                      {!isLast && (
                        <View style={[
                          styles.timelineLine,
                          { backgroundColor: inRange && idx < (workEnd ?? 0) ? colors.success : colors.border },
                        ]} />
                      )}
                    </View>

                    {/* Station info */}
                    <View style={styles.stationInfo}>
                      <Text style={[styles.stationName, { color: colors.text }]}>{stop.name}</Text>
                      <View style={styles.stationTimes}>
                        {stop.arrivalPlanned && (
                          <Text style={[styles.stationTime, { color: colors.textSecondary }]}>
                            przyj. {stop.arrivalPlanned}
                          </Text>
                        )}
                        {stop.departurePlanned && (
                          <Text style={[styles.stationTime, { color: colors.textSecondary }]}>
                            odj. {stop.departurePlanned}
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Selection badge */}
                    {isStart && (
                      <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                        <Text style={styles.badgeText}>START</Text>
                      </View>
                    )}
                    {isEnd && (
                      <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                        <Text style={styles.badgeText}>KONIEC</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  {
                    backgroundColor: colors.accent,
                    opacity: (workStart !== null && workEnd !== null && workEnd > workStart) ? 1 : 0.4,
                    marginTop: 16,
                  },
                ]}
                onPress={confirmStations}
                disabled={workStart === null || workEnd === null || workEnd <= workStart}
              >
                <MaterialCommunityIcons name="check" size={20} color="#fff" />
                <Text style={styles.primaryBtnText}>Potwierdź odcinek</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ══════════ STEP 3: DETAILS ══════════ */}
          {step === 'details' && (
            <>
              {/* Summary card */}
              <View style={[styles.trainCard, { backgroundColor: colors.surface }]}>
                <View style={styles.trainCardHeader}>
                  <MaterialCommunityIcons name="train" size={20} color={colors.accent} />
                  <Text style={[styles.trainCardTitle, { color: colors.text }]}>
                    {form.category} {form.trainName ? `„${form.trainName}" ` : ''}{form.trainNumber}
                  </Text>
                </View>
                <Text style={[styles.trainCardSub, { color: colors.textSecondary }]}>
                  Odcinek: {form.stationFrom} → {form.stationTo}
                </Text>
                {form.stationsVia ? (
                  <Text style={[styles.trainCardSub, { color: colors.textSecondary }]}>
                    Przez: {form.stationsVia}
                  </Text>
                ) : null}
              </View>

              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>POCIĄG</Text>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Kategoria</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {CATEGORIES.map(cat => {
                  const active = form.category === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.chip, { backgroundColor: active ? colors.accent : colors.surface }]}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); set('category', cat); }}
                    >
                      <Text style={[styles.chipText, { color: active ? '#fff' : colors.textSecondary }]}>{cat}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <FieldInput label="Nazwa pociągu" value={form.trainName} onChange={v => set('trainName', v)} placeholder="np. Wawel" colors={colors} />

              <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 20 }]}>SKŁAD</Text>
              <FieldInput label="Wagon służbowy (numer)" value={form.serviceWagon} onChange={v => set('serviceWagon', v)} placeholder="np. 5" keyboardType="numeric" colors={colors} />

              <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 20 }]}>GASTRONOMIA</Text>
              {GASTRO_OPTIONS.map(opt => {
                const active = form.gastroType === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.gastroRow, { backgroundColor: colors.surface, borderColor: active ? colors.accent : 'transparent', borderWidth: 1.5 }]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); set('gastroType', opt.value); }}
                  >
                    <View style={styles.gastroText}>
                      <Text style={[styles.gastroLabel, { color: colors.text }]}>{opt.label}</Text>
                      <Text style={[styles.gastroDesc, { color: colors.textSecondary }]}>{opt.desc}</Text>
                    </View>
                    {active && <MaterialCommunityIcons name="check-circle" size={20} color={colors.accent} />}
                  </TouchableOpacity>
                );
              })}

              {showWarsWagon && (
                <FieldInput label="Wagon WARS (numer)" value={form.gastroWarsWagon} onChange={v => set('gastroWarsWagon', v)} placeholder="np. 3" keyboardType="numeric" colors={colors} />
              )}
              {showWarsEnd && (
                <FieldInput label="WARS do stacji (opcjonalnie)" value={form.gastroWarsEndStation} onChange={v => set('gastroWarsEndStation', v)} placeholder="zostaw puste jeśli pełna trasa" colors={colors} />
              )}
              {showAutomatWagon && (
                <FieldInput label="Wagon automat (numer)" value={form.gastroAutomatWagon} onChange={v => set('gastroAutomatWagon', v)} placeholder="np. 2" keyboardType="numeric" colors={colors} />
              )}
              {showMinibarEnd && (
                <FieldInput label="Mini-bar do stacji (opcjonalnie)" value={form.gastroMinibarEndStation} onChange={v => set('gastroMinibarEndStation', v)} placeholder="zostaw puste jeśli pełna trasa" colors={colors} />
              )}

              <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 20 }]}>TRASA (EDYCJA RĘCZNA)</Text>
              <FieldInput label="Stacje pośrednie (tekst)" value={form.stationsVia} onChange={v => set('stationsVia', v)} placeholder="np. Kielce, Radom" colors={colors} />

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.accent, opacity: saving ? 0.6 : 1, marginTop: 24 }]}
                onPress={handleSave}
                disabled={saving}
              >
                <MaterialCommunityIcons name="content-save-outline" size={20} color="#fff" />
                <Text style={styles.primaryBtnText}>{saving ? 'Zapisywanie…' : 'Zapisz i wróć'}</Text>
              </TouchableOpacity>
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function FieldInput({ label, value, onChange, placeholder, keyboardType, colors }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: any; colors: any;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        keyboardType={keyboardType ?? 'default'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
  },
  backBtn: { padding: 4 },
  title: { flex: 1, fontSize: 20, fontWeight: '700', marginLeft: 8 },

  stepRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 32,
    paddingVertical: 12, paddingHorizontal: 16,
  },
  stepItem: { alignItems: 'center', gap: 4 },
  stepDot: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNum: { color: '#fff', fontSize: 12, fontWeight: '700' },
  stepLabel: { fontSize: 11, fontWeight: '600' },

  scroll: { paddingHorizontal: 16 },

  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10, marginTop: 4 },
  fieldWrap: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '500', marginBottom: 5 },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  hint: { fontSize: 13, marginBottom: 12, lineHeight: 18 },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, padding: 12, marginBottom: 12,
  },
  errorText: { fontSize: 14, flex: 1 },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, paddingVertical: 16,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, paddingVertical: 14,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '600' },

  divider: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginVertical: 16,
  },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: 13 },

  trainCard: {
    borderRadius: 14, padding: 14, marginBottom: 16,
  },
  trainCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  trainCardTitle: { fontSize: 16, fontWeight: '700' },
  trainCardSub: { fontSize: 13, marginTop: 2 },

  stationRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12,
    marginBottom: 2,
  },
  timeline: { width: 24, alignItems: 'center', marginRight: 10 },
  timelineDot: { width: 10, height: 10, borderRadius: 5 },
  timelineLine: { width: 2, flex: 1, marginTop: 2, minHeight: 20 },
  stationInfo: { flex: 1 },
  stationName: { fontSize: 15, fontWeight: '500' },
  stationTimes: { flexDirection: 'row', gap: 12, marginTop: 2 },
  stationTime: { fontSize: 12 },

  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  chips: { gap: 8, flexDirection: 'row', marginBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  chipText: { fontSize: 13, fontWeight: '600' },

  gastroRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, padding: 12, marginBottom: 6,
  },
  gastroText: { flex: 1 },
  gastroLabel: { fontSize: 15, fontWeight: '600' },
  gastroDesc: { fontSize: 12, marginTop: 1 },
});
