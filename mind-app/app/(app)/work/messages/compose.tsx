import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ALL_AIRPORT_STATIONS,
  DELAY_REASONS,
  EMPTY_SESSION,
  MESSAGE_TYPES,
  MessageTypeId,
  TrainSession,
  generateA1,
  generateA2,
  generateA3,
  generateA4,
  generateC1,
  generateC2,
  generateC3,
  generatePRozszerzony,
  generatePSkrocony,
  generatePStart,
  generatePozegnalny,
} from '../../../../constants/komunikaty';
import { Colors } from '../../../../constants/theme';
import { useTheme } from '../../../../contexts/ThemeContext';
import { loadTrainSession } from '../../../../services/trainSession';
import { Screen } from '../../../../components/Screen';

// ─── Pomocnicze komponenty ────────────────────────────────────────────────────

function SectionLabel({ text, colors }: { text: string; colors: any }) {
  return <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>{text}</Text>;
}

function Field({ label, value, onChange, placeholder, keyboardType, colors, multiline }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: any; colors: any; multiline?: boolean;
}) {
  return (
    <View style={s.fieldWrap}>
      <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        style={[s.input, { backgroundColor: colors.surface, color: colors.text }, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
      />
    </View>
  );
}

function Toggle({ label, desc, value, onChange, colors }: {
  label: string; desc?: string; value: boolean; onChange: (v: boolean) => void; colors: any;
}) {
  return (
    <TouchableOpacity
      style={[s.toggleRow, { backgroundColor: colors.surface }]}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onChange(!value); }}
      activeOpacity={0.8}
    >
      <View style={{ flex: 1 }}>
        <Text style={[s.toggleLabel, { color: colors.text }]}>{label}</Text>
        {desc && <Text style={[s.toggleDesc, { color: colors.textSecondary }]}>{desc}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={v => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onChange(v); }}
        trackColor={{ true: colors.accent }}
      />
    </TouchableOpacity>
  );
}

function DelayReasonPicker({ value, onChange, colors }: { value: string; onChange: (v: string) => void; colors: any }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <View style={s.fieldWrap}>
        <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Przyczyna opóźnienia</Text>
        <TouchableOpacity
          style={[s.pickerBtn, { backgroundColor: colors.surface }]}
          onPress={() => setOpen(true)}
        >
          <Text style={[s.pickerText, { color: value ? colors.text : colors.textSecondary }]} numberOfLines={2}>
            {value || 'Wybierz przyczynę…'}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <Modal visible={open} transparent animationType="slide">
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setOpen(false)} />
        <View style={[s.modalSheet, { backgroundColor: colors.surface }]}>
          <Text style={[s.modalTitle, { color: colors.text }]}>Przyczyna opóźnienia</Text>
          <ScrollView>
            {DELAY_REASONS.map(r => (
              <TouchableOpacity
                key={r}
                style={[s.modalOption, value === r && { backgroundColor: colors.accent + '22' }]}
                onPress={() => { onChange(r); setOpen(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              >
                <Text style={[s.modalOptionText, { color: value === r ? colors.accent : colors.text }]}>{r}</Text>
                {value === r && <MaterialCommunityIcons name="check" size={18} color={colors.accent} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function AirportPicker({ value, onChange, colors }: { value: string; onChange: (v: string) => void; colors: any }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <View style={s.fieldWrap}>
        <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Stacja (lotnisko)</Text>
        <TouchableOpacity
          style={[s.pickerBtn, { backgroundColor: colors.surface }]}
          onPress={() => setOpen(true)}
        >
          <Text style={[s.pickerText, { color: value ? colors.text : colors.textSecondary }]}>
            {value || 'Wybierz stację…'}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <Modal visible={open} transparent animationType="slide">
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setOpen(false)} />
        <View style={[s.modalSheet, { backgroundColor: colors.surface }]}>
          <Text style={[s.modalTitle, { color: colors.text }]}>Stacja z lotniskiem</Text>
          <ScrollView>
            {ALL_AIRPORT_STATIONS.map(st => (
              <TouchableOpacity
                key={st}
                style={[s.modalOption, value === st && { backgroundColor: colors.accent + '22' }]}
                onPress={() => { onChange(st); setOpen(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              >
                <Text style={[s.modalOptionText, { color: value === st ? colors.accent : colors.text }]}>{st}</Text>
                {value === st && <MaterialCommunityIcons name="check" size={18} color={colors.accent} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

// ─── Główny komponent ─────────────────────────────────────────────────────────

export default function ComposeScreen() {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const router = useRouter();
  const { typeId } = useLocalSearchParams<{ typeId: MessageTypeId }>();

  const typeDef = MESSAGE_TYPES.find(t => t.id === typeId);

  const [session, setSession] = useState<TrainSession>(EMPTY_SESSION);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  // ── Pola formularza ──
  const [nextStation, setNextStation] = useState('');
  const [timeOfDay, setTimeOfDay] = useState<'dzien' | 'wieczor'>(() => new Date().getHours() >= 18 ? 'wieczor' : 'dzien');
  const [groupWagons, setGroupWagons] = useState(false);
  const [groupWagonsStation, setGroupWagonsStation] = useState('');
  const [delayed, setDelayed] = useState(false);
  const [delayMinutes, setDelayMinutes] = useState('');
  const [delayReason, setDelayReason] = useState('');
  const [onSchedule, setOnSchedule] = useState(false);
  const [longStop, setLongStop] = useState(false);
  const [departureTime, setDepartureTime] = useState('');
  const [transfers, setTransfers] = useState(false);
  const [zka, setZka] = useState(false);
  const [zkaStation, setZkaStation] = useState('');
  const [airport, setAirport] = useState(false);
  const [airportStation, setAirportStation] = useState('');
  const [wagonsDetach, setWagonsDetach] = useState(false);
  const [detachGroupNums, setDetachGroupNums] = useState('');
  const [detachGroupStation, setDetachGroupStation] = useState('');
  const [detachEndWagons, setDetachEndWagons] = useState('');
  const [waitMinutes, setWaitMinutes] = useState('');
  const [connTrain, setConnTrain] = useState(false);
  const [connNumber, setConnNumber] = useState('');
  const [connEnd, setConnEnd] = useState('');
  const [connVia, setConnVia] = useState('');
  const [connTime, setConnTime] = useState('');
  const [connPlatform, setConnPlatform] = useState('');
  const [a4Refused, setA4Refused] = useState(false);
  const [a4Number, setA4Number] = useState('');
  const [a4End, setA4End] = useState('');
  const [a4Via, setA4Via] = useState('');
  const [a4Station, setA4Station] = useState('');
  const [c1Station, setC1Station] = useState('');
  const [c1Outside, setC1Outside] = useState('');
  const [c1Inside, setC1Inside] = useState('');
  const [c3Zastepczye, setC3Zastepczye] = useState(false);
  const [c3WasED250, setC3WasED250] = useState(false);
  const [stationName, setStationName] = useState('');

  useEffect(() => {
    loadTrainSession().then(s => {
      if (s) setSession(s);
      setSessionLoaded(true);
    });
  }, []);

  const fillFromSession = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Pola specyficzne dla typów, które korzystają z danych sesji
    if (typeId === 'a4_skomunikowanie') setA4Station(session.serviceWagon);
  };

  const generate = (): string | null => {
    switch (typeId) {
      case 'p_start':
        return generatePStart({ nextStation }, session);

      case 'p_rozszerzony':
        return generatePRozszerzony(
          { nextStation, timeOfDay, groupWagons, groupWagonsStation, delayed, delayMinutes, delayReason },
          session
        );

      case 'p_skrocony':
        return generatePSkrocony({ nextStation, delayed, delayMinutes, delayReason }, session);

      case 'pp_pozegnalny':
        return generatePozegnalny(
          { stationName, isTransit: true, delayed, longStop, departureTime, transfers, zka, zkaStation, airport, airportStation, wagonsDetach, detachGroupNumbers: detachGroupNums, detachGroupStation, detachEndWagons },
          session
        );

      case 'pozegnalny':
        return generatePozegnalny(
          { stationName, isTransit: false, delayed, longStop, departureTime, transfers, zka, zkaStation, airport, airportStation, wagonsDetach, detachGroupNumbers: detachGroupNums, detachGroupStation, detachEndWagons },
          session
        );

      case 'a1_opoznienie':
        return generateA1({ onSchedule, delayMinutes, delayReason }, session);

      case 'a2_postoj':
        return generateA2({ delayReason, delayMinutes }, session);

      case 'a3_semafor':
        return generateA3({
          stationName, waitMinutes, connectionTrain: connTrain,
          connectionNumber: connNumber, connectionEnd: connEnd, connectionVia: connVia,
          connectionTime: connTime, connectionPlatform: connPlatform,
        });

      case 'a4_skomunikowanie':
        return generateA4({
          refused: a4Refused, trainNumber: a4Number, trainEnd: a4End,
          trainVia: a4Via, waitingStation: a4Station, serviceWagon: session.serviceWagon,
        });

      case 'c1_krotkie_perony':
        return generateC1({ stationName: c1Station, wagonsOutside: c1Outside, wagonsInside: c1Inside });

      case 'c2_postoj_techniczny':
        return generateC2();

      case 'c3_zastepczy':
        return generateC3({ hasZastepczeMiejsca: c3Zastepczye, wasED250: c3WasED250 });

      default:
        return null;
    }
  };

  const handlePreview = () => {
    const text = generate();
    if (!text) return;
    // Use §§ as paragraph separator — survives URL encoding intact
    router.push({
      pathname: '/(app)/work/messages/preview',
      params: { text: text.replace(/\n\n/g, '§§'), title: typeDef?.title ?? '', typeId: typeId ?? '' },
    });
  };

  if (!typeDef) return null;

  const sessionCard = sessionLoaded && (
    <TouchableOpacity
      style={[s.sessionBanner, { backgroundColor: colors.surface }]}
      onPress={() => router.push('/(app)/work/messages/session')}
    >
      <MaterialCommunityIcons name="train" size={16} color={colors.accent} />
      <Text style={[s.sessionBannerText, { color: colors.textSecondary }]}>
        {session.trainNumber
          ? `${session.category} ${session.trainName} ${session.trainNumber} · wag. ${session.serviceWagon}`
          : 'Brak danych pociągu — dotknij, aby dodać'}
      </Text>
      <MaterialCommunityIcons name="pencil-outline" size={14} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <Screen keyboardAvoid backgroundColor={colors.background}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }} hitSlop={8} style={s.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>{typeDef.title}</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {sessionCard}

          {/* ── P_START ── */}
          {typeId === 'p_start' && (
            <>
              <Field label="Następna stacja" value={nextStation} onChange={setNextStation} placeholder="np. Kraków Płaszów" colors={colors} />
            </>
          )}

          {/* ── P_ROZSZERZONY ── */}
          {typeId === 'p_rozszerzony' && (
            <>
              <SectionLabel text="PORA DNIA" colors={colors} />
              <View style={s.radioRow}>
                {(['dzien', 'wieczor'] as const).map(opt => (
                  <TouchableOpacity
                    key={opt}
                    style={[s.radioBtn, { backgroundColor: timeOfDay === opt ? colors.accent : colors.surface }]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTimeOfDay(opt); }}
                  >
                    <Text style={[s.radioBtnText, { color: timeOfDay === opt ? '#fff' : colors.text }]}>
                      {opt === 'dzien' ? '☀️ Dzień dobry' : '🌙 Dobry wieczór'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Field label="Następna stacja" value={nextStation} onChange={setNextStation} placeholder="np. Kraków Płaszów" colors={colors} />
              <Toggle label="Grupy wagonów" desc="Pociąg prowadzi grupę do innej stacji" value={groupWagons} onChange={setGroupWagons} colors={colors} />
              {groupWagons && <Field label="Stacja grupy wagonów" value={groupWagonsStation} onChange={setGroupWagonsStation} placeholder="np. Gdańsk Główny" colors={colors} />}
              <Toggle label="Pociąg opóźniony" value={delayed} onChange={setDelayed} colors={colors} />
              {delayed && <>
                <Field label="Opóźnienie (minut)" value={delayMinutes} onChange={setDelayMinutes} placeholder="np. 15" keyboardType="numeric" colors={colors} />
                <DelayReasonPicker value={delayReason} onChange={setDelayReason} colors={colors} />
              </>}
            </>
          )}

          {/* ── P_SKRÓCONY ── */}
          {typeId === 'p_skrocony' && (
            <>
              <Field label="Następna stacja" value={nextStation} onChange={setNextStation} placeholder="np. Dębica" colors={colors} />
              <Toggle label="Pociąg opóźniony" value={delayed} onChange={setDelayed} colors={colors} />
              {delayed && <>
                <Field label="Opóźnienie (minut)" value={delayMinutes} onChange={setDelayMinutes} placeholder="np. 10" keyboardType="numeric" colors={colors} />
                <DelayReasonPicker value={delayReason} onChange={setDelayReason} colors={colors} />
              </>}
            </>
          )}

          {/* ── PP_POZEGNALNY i POZEGNALNY ── */}
          {(typeId === 'pp_pozegnalny' || typeId === 'pozegnalny') && (
            <>
              <Field label="Nazwa stacji" value={stationName} onChange={setStationName} placeholder="np. Warszawa Centralna" colors={colors} />
              <Toggle label="Pociąg opóźniony (≥5 min)" value={delayed} onChange={setDelayed} colors={colors} />
              <Toggle label="Długi postój (>5 min)" value={longStop} onChange={setLongStop} colors={colors} />
              {longStop && <Field label="Planowany odjazd (gg:mm)" value={departureTime} onChange={setDepartureTime} placeholder="np. 14:32" colors={colors} />}
              <SectionLabel text="PRZESIADKI" colors={colors} />
              <Toggle label="Przesiadki na tej stacji" desc="Dalekobieżne, regionalne, podmiejskie" value={transfers} onChange={setTransfers} colors={colors} />
              {transfers && <>
                <Toggle label="ZKA (Zastępcza Komunikacja Autobusowa)" value={zka} onChange={setZka} colors={colors} />
                {zka && <Field label="ZKA do stacji" value={zkaStation} onChange={setZkaStation} placeholder="np. Katowice" colors={colors} />}
              </>}
              <Toggle label="Pociągi na lotnisko" value={airport} onChange={setAirport} colors={colors} />
              {airport && <AirportPicker value={airportStation} onChange={setAirportStation} colors={colors} />}
              <SectionLabel text="ROZŁĄCZANIE WAGONÓW" colors={colors} />
              <Toggle label="Wagony będą odłączane" value={wagonsDetach} onChange={setWagonsDetach} colors={colors} />
              {wagonsDetach && <>
                <Field label="Numery wagonów grupy relacyjnej" value={detachGroupNums} onChange={setDetachGroupNums} placeholder="np. 1, 2, 3" colors={colors} />
                <Field label="Stacja docelowa grupy" value={detachGroupStation} onChange={setDetachGroupStation} placeholder="np. Gdańsk Główny" colors={colors} />
                <Field label="Wagony kończące bieg (numery)" value={detachEndWagons} onChange={setDetachEndWagons} placeholder="np. 4, 5" colors={colors} />
              </>}
            </>
          )}

          {/* ── A1 OPÓŹNIENIE ── */}
          {typeId === 'a1_opoznienie' && (
            <>
              <Toggle label="Pociąg jedzie zgodnie z rozkładem" desc="Użyj gdy opóźnienie zostało nadrobione" value={onSchedule} onChange={setOnSchedule} colors={colors} />
              {!onSchedule && <>
                <Field label="Opóźnienie (minut)" value={delayMinutes} onChange={setDelayMinutes} placeholder="np. 20" keyboardType="numeric" colors={colors} />
                <DelayReasonPicker value={delayReason} onChange={setDelayReason} colors={colors} />
              </>}
            </>
          )}

          {/* ── A2 POSTÓJ ── */}
          {typeId === 'a2_postoj' && (
            <>
              <Field label="Opóźnienie odjazdu (minut)" value={delayMinutes} onChange={setDelayMinutes} placeholder="np. 10" keyboardType="numeric" colors={colors} />
              <DelayReasonPicker value={delayReason} onChange={setDelayReason} colors={colors} />
            </>
          )}

          {/* ── A3 SEMAFOR ── */}
          {typeId === 'a3_semafor' && (
            <>
              <Field label="Nazwa stacji" value={stationName} onChange={setStationName} placeholder="np. Warszawa Centralna" colors={colors} />
              <Field label="Oczekiwanie (ok. minut)" value={waitMinutes} onChange={setWaitMinutes} placeholder="np. 5" keyboardType="numeric" colors={colors} />
              <Toggle label="Pociąg oczekujący na przesiadkę" value={connTrain} onChange={setConnTrain} colors={colors} />
              {connTrain && <>
                <Field label="Numer pociągu" value={connNumber} onChange={setConnNumber} placeholder="np. 5314" colors={colors} />
                <Field label="Do stacji" value={connEnd} onChange={setConnEnd} placeholder="np. Gdańsk Główny" colors={colors} />
                <Field label="Przez stacje (opcjonalnie)" value={connVia} onChange={setConnVia} placeholder="np. Malbork" colors={colors} />
                <Field label="Godzina odjazdu" value={connTime} onChange={setConnTime} placeholder="np. 15:42" colors={colors} />
                <Field label="Numer peronu" value={connPlatform} onChange={setConnPlatform} placeholder="np. 3" colors={colors} />
              </>}
            </>
          )}

          {/* ── A4 SKOMUNIKOWANIE ── */}
          {typeId === 'a4_skomunikowanie' && (
            <>
              <Toggle label="Odmowa skomunikowania" desc="Pociąg NIE będzie oczekiwał" value={a4Refused} onChange={setA4Refused} colors={colors} />
              <Field label="Numer pociągu" value={a4Number} onChange={setA4Number} placeholder="np. 5314" colors={colors} />
              <Field label="Do stacji" value={a4End} onChange={setA4End} placeholder="np. Gdańsk Główny" colors={colors} />
              <Field label="Przez stacje (opcjonalnie)" value={a4Via} onChange={setA4Via} placeholder="np. Malbork, Tczew" colors={colors} />
              {!a4Refused && <Field label="Stacja oczekiwania" value={a4Station} onChange={setA4Station} placeholder="np. Kraków Główny" colors={colors} />}
            </>
          )}

          {/* ── C1 KRÓTKIE PERONY ── */}
          {typeId === 'c1_krotkie_perony' && (
            <>
              <Field label="Nazwa stacji" value={c1Station} onChange={setC1Station} placeholder="np. Kołobrzeg" colors={colors} />
              <Field label="Wagony poza peronem (numery)" value={c1Outside} onChange={setC1Outside} placeholder="np. 8, 9, 10" colors={colors} />
              <Field label="Wagony przy krawędzi (numery)" value={c1Inside} onChange={setC1Inside} placeholder="np. 1–7" colors={colors} />
            </>
          )}

          {/* ── C2 POSTÓJ TECHNICZNY ── (brak pól) */}
          {typeId === 'c2_postoj_techniczny' && (
            <View style={[s.infoBanner, { backgroundColor: colors.surface }]}>
              <MaterialCommunityIcons name="information-outline" size={18} color={colors.accent} />
              <Text style={[s.infoBannerText, { color: colors.textSecondary }]}>
                Ten komunikat nie wymaga wypełniania pól — treść jest stała.
              </Text>
            </View>
          )}

          {/* ── C3 SKŁAD ZASTĘPCZY ── */}
          {typeId === 'c3_zastepczy' && (
            <>
              <Toggle label="Są oznaczenia miejsc zastępczych" value={c3Zastepczye} onChange={setC3Zastepczye} colors={colors} />
              <Toggle label="Miał kursować ED250 (Pendolino)" desc="Dodaje informację o możliwości reklamacji" value={c3WasED250} onChange={setC3WasED250} colors={colors} />
            </>
          )}

          {/* Przycisk generuj */}
          <TouchableOpacity
            style={[s.generateBtn, { backgroundColor: colors.accent }]}
            onPress={handlePreview}
          >
            <MaterialCommunityIcons name="text-box-check-outline" size={20} color="#fff" />
            <Text style={s.generateBtnText}>Generuj komunikat</Text>
          </TouchableOpacity>

        </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  title: { flex: 1, fontSize: 20, fontWeight: '700', marginLeft: 8 },
  scroll: { paddingHorizontal: 16, paddingBottom: 60, gap: 4 },
  sessionBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, padding: 10, marginBottom: 16,
  },
  sessionBannerText: { flex: 1, fontSize: 12 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 12, marginBottom: 4 },
  fieldWrap: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontWeight: '500', marginBottom: 5 },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 12, padding: 12, marginBottom: 8,
  },
  toggleLabel: { fontSize: 15, fontWeight: '500' },
  toggleDesc: { fontSize: 12, marginTop: 2 },
  radioRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  radioBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  radioBtnText: { fontSize: 14, fontWeight: '600' },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  pickerText: { flex: 1, fontSize: 14, marginRight: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    maxHeight: '60%', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  modalOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#88888833',
  },
  modalOptionText: { fontSize: 15, flex: 1, marginRight: 8 },
  infoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, padding: 14, marginBottom: 8,
  },
  infoBannerText: { flex: 1, fontSize: 14, lineHeight: 20 },
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, paddingVertical: 16, marginTop: 24,
  },
  generateBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
