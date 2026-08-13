import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Screen } from '../../../components/Screen';
import { ScreenHeader, ScreenHeaderIconButton } from '../../../components/ScreenHeader';
import { radius } from '../../../constants/layout';
import { useTheme, useColors } from '../../../contexts/ThemeContext';
import { type Shift, confirmTimecard, confirmTimecardsBulk, fetchShifts, syncPortalStatus } from '../../../services/work';

type SendStatus = 'idle' | 'sending' | 'done';
type CardResult = { date: string; success: boolean; message?: string; debug?: Record<string, unknown> };

const DAYS_PL = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So'];
const MONTHS_PL = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

export default function TimecardScreen() {
  const { isDark } = useTheme();
  const colors = useColors();
  const router = useRouter();

  const [pending, setPending] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sendStatus, setSendStatus] = useState<SendStatus>('idle');
  const [sendResults, setSendResults] = useState<CardResult[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const now = new Date();
      // Pobierz bieżący i następny miesiąc
      const [curr, next] = await Promise.all([
        fetchShifts(now.getMonth() + 1, now.getFullYear()),
        fetchShifts(now.getMonth() === 11 ? 1 : now.getMonth() + 2, now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear()),
      ]);
      const all = [...curr, ...next];
      // wydana = karta wydana przez pracodawcę, czeka na potwierdzenie
      // do_potwierdzenia = karta wymaga potwierdzenia (parser z HTML grafiku)
      const CONFIRMABLE = ['do_potwierdzenia', 'wydana'];
      const todayStr = new Date().toISOString().slice(0, 10);
      setPending(all.filter(s =>
        CONFIRMABLE.includes(s.statusKarty ?? '') &&
        s.typ === 'praca' &&
        s.date <= todayStr
      ));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleConfirmOne = (shift: Shift) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Wyślij kartę pracy',
      `Potwierdzić kartę za ${shift.date}?\n${shift.sluzba}${shift.start ? ` (${shift.start}–${shift.end})` : ''}`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Wyślij',
          style: 'default',
          onPress: async () => {
            setConfirming(true);
            try {
              const result = await confirmTimecard(shift.date);
              if (result.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                await load();
              } else {
                Alert.alert('Błąd', result.message ?? 'Nie udało się potwierdzić karty');
              }
            } catch {
              Alert.alert('Błąd', 'Błąd połączenia z serwerem');
            } finally {
              setConfirming(false);
            }
          },
        },
      ],
    );
  };

  const handleSyncPortal = async () => {
    setSyncing(true);
    try {
      const r = await syncPortalStatus();
      await load();
      if (r.synced > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      Alert.alert('Błąd', e instanceof Error ? e.message : 'Nie udało się zsynchronizować z portalem');
    } finally {
      setSyncing(false);
    }
  };

  const handleConfirmSelected = async () => {
    if (selected.size === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSendStatus('sending');
    setSendResults([]);
    const dates = [...selected].sort();
    try {
      const results = await confirmTimecardsBulk(dates, 8000);
      setSendResults(results);
      setSendStatus('done');
      setSelected(new Set());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    } catch {
      setSendStatus('idle');
      Alert.alert('Błąd', 'Nie udało się połączyć z serwerem');
    }
  };

  return (
    <Screen backgroundColor={colors.background}>
      <ScreenHeader
        title="Karty pracy"
        textColor={colors.text}
        right={
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <ScreenHeaderIconButton onPress={handleSyncPortal} backgroundColor="transparent">
              {syncing
                ? <ActivityIndicator size="small" color={colors.accent} />
                : <MaterialCommunityIcons name="cloud-sync" size={22} color={colors.accent} />}
            </ScreenHeaderIconButton>
            <ScreenHeaderIconButton onPress={load} backgroundColor="transparent">
              <MaterialCommunityIcons name="refresh" size={22} color={colors.accent} />
            </ScreenHeaderIconButton>
          </View>
        }
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Nie udało się pobrać kart</Text>
          <TouchableOpacity onPress={load} style={[styles.retryBtn, { backgroundColor: colors.accent }]}>
            <Text style={styles.retryText}>Spróbuj ponownie</Text>
          </TouchableOpacity>
        </View>
      ) : pending.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="check-circle-outline" size={64} color="#10B981" />
          <Text style={[styles.allDoneTitle, { color: colors.text }]}>Wszystko potwierdzone</Text>
          <Text style={[styles.allDoneSub, { color: colors.textSecondary }]}>
            Brak kart pracy do potwierdzenia
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          <View style={[styles.infoBanner, { backgroundColor: '#3B82F618' }]}>
            <MaterialCommunityIcons name="information-outline" size={18} color="#3B82F6" />
            <Text style={[styles.infoText, { color: '#3B82F6' }]}>
              {pending.length === 1 ? '1 karta' : `${pending.length} kart`} do potwierdzenia
            </Text>
          </View>

          {selected.size > 0 && (
            <TouchableOpacity
              style={[styles.bulkBtn, { backgroundColor: colors.accent }]}
              onPress={handleConfirmSelected}
              disabled={confirming || sendStatus === 'sending'}
            >
              {sendStatus === 'sending'
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.bulkBtnText}>Wyślij zaznaczone ({selected.size})</Text>
              }
            </TouchableOpacity>
          )}

          {pending.map((shift) => {
            const d = new Date(shift.date + 'T00:00:00');
            const toggleSelect = () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelected(prev => {
                const next = new Set(prev);
                if (next.has(shift.date)) next.delete(shift.date);
                else next.add(shift.date);
                return next;
              });
            };
            return (
              <View
                key={shift.date}
                style={[
                  styles.card,
                  { backgroundColor: colors.surface },
                  selected.has(shift.date) && { borderColor: colors.accent, borderWidth: 1.5 },
                ]}
              >
                <TouchableOpacity hitSlop={8} onPress={toggleSelect}>
                  <MaterialCommunityIcons
                    name={selected.has(shift.date) ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                    size={22}
                    color={selected.has(shift.date) ? colors.accent : colors.textSecondary}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cardMainTap}
                  activeOpacity={0.7}
                  onPress={() => handleConfirmOne(shift)}
                  onLongPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    toggleSelect();
                  }}
                >
                  <View style={styles.datePart}>
                    <Text style={[styles.dayName, { color: colors.textSecondary }]}>
                      {DAYS_PL[d.getDay()]}
                    </Text>
                    <Text style={[styles.dayNum, { color: colors.text }]}>
                      {d.getDate()}
                    </Text>
                    <Text style={[styles.dayMonth, { color: colors.textSecondary }]}>
                      {MONTHS_PL[d.getMonth()]} {d.getFullYear()}
                    </Text>
                  </View>

                  <View style={styles.cardInfo}>
                    <View style={styles.cardTop}>
                      <View style={[styles.codeBadge, { backgroundColor: '#3B82F622' }]}>
                        <Text style={[styles.codeText, { color: '#3B82F6' }]}>{shift.sluzba}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: '#F59E0B22' }]}>
                        <MaterialCommunityIcons name="alert-circle-outline" size={12} color="#F59E0B" />
                        <Text style={styles.statusText}>Do potw.</Text>
                      </View>
                    </View>
                    <Text style={[styles.opisText, { color: colors.text }]}>{shift.opis}</Text>
                    {shift.start ? (
                      <Text style={[styles.timeText, { color: colors.textSecondary }]}>
                        {shift.start} – {shift.end}
                      </Text>
                    ) : null}
                  </View>

                  <MaterialCommunityIcons name="send-outline" size={20} color={colors.accent} />
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}

      {sendStatus !== 'idle' && (
        <View style={[styles.sendOverlay, { backgroundColor: colors.background }]}>
          {sendStatus === 'sending' ? (
            <>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.sendTitle, { color: colors.text }]}>Wysyłanie kart…</Text>
              <Text style={[styles.sendSub, { color: colors.textSecondary }]}>
                Karty są wysyłane z opóźnieniem, żeby portal nie zablokował.{'\n'}
                Nie zamykaj ekranu.
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.sendTitle, { color: colors.text }]}>Wyniki wysyłania</Text>
              <ScrollView style={{ width: '100%' }} contentContainerStyle={{ gap: 8, paddingBottom: 32 }}>
                {sendResults.map(r => (
                  <View key={r.date} style={[styles.resultRow, { backgroundColor: colors.surface }]}>
                    <MaterialCommunityIcons
                      name={r.success ? 'check-circle' : 'close-circle'}
                      size={20}
                      color={r.success ? '#10B981' : '#EF4444'}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.resultDate, { color: colors.text }]}>{r.date}</Text>
                      <Text style={[styles.resultMsg, { color: colors.textSecondary }]}>
                        {r.message ?? (r.success ? 'OK' : 'Błąd')}
                      </Text>
                      {r.debug && (
                        <Text style={[styles.resultDebug, { color: colors.textSecondary }]}>
                          {JSON.stringify(r.debug)}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={[styles.sendDoneBtn, { backgroundColor: colors.accent }]}
                onPress={() => setSendStatus('idle')}
              >
                <Text style={styles.sendDoneBtnText}>Zamknij</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32 },
  emptyText: { fontSize: 15, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 4 },
  retryText: { color: '#fff', fontWeight: '600' },
  allDoneTitle: { fontSize: 20, fontWeight: '700' },
  allDoneSub: { fontSize: 14, textAlign: 'center' },
  list: { paddingBottom: 16, gap: 8, flexGrow: 1 },

  infoBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: 14, marginBottom: 6 },
  infoText: { fontSize: 13, fontWeight: '500', flex: 1 },

  bulkBtn: {
    marginHorizontal: 0, marginBottom: 10, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  bulkBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  card: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: radius.lg, padding: 12, gap: 10,
  },
  cardMainTap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  datePart: { width: 46, alignItems: 'center' },
  dayName: { fontSize: 11, fontWeight: '500' },
  dayNum: { fontSize: 20, fontWeight: '700' },
  dayMonth: { fontSize: 9, fontWeight: '500', textAlign: 'center' },
  cardInfo: { flex: 1, gap: 3 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  codeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  codeText: { fontSize: 12, fontWeight: '700' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  statusText: { color: '#F59E0B', fontSize: 10, fontWeight: '700' },
  opisText: { fontSize: 13, fontWeight: '500' },
  timeText: { fontSize: 12 },

  sendOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  sendTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  sendSub: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  resultRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 12, borderRadius: 12,
  },
  resultDate: { fontSize: 14, fontWeight: '600' },
  resultMsg: { fontSize: 12, marginTop: 2 },
  resultDebug: { fontSize: 10, marginTop: 4, fontFamily: 'monospace' },
  sendDoneBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
  sendDoneBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
