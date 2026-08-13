import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  DELAY_REASONS,
  TrainRunSession,
  TrainStop,
  generatePRozszerzony,
  generatePSkrocony,
  generatePStart,
  generatePozegnalny,
  isVoivodeshipCapital,
  runSessionToTrainSession,
  travelTimeMinutes,
  workStops,
} from '../../../../constants/komunikaty';
import { useTheme, useColors } from '../../../../contexts/ThemeContext';
import {
  isRunSessionValid,
  loadRunSession,
  saveRunSession,
} from '../../../../services/trainSession';
import { addToQueue, QueuedMessage } from '../../../../services/messageQueue';
import { Screen } from '../../../../components/Screen';
import {
  cancelAllStationNotifications,
  getScheduledCount,
  requestNotificationPermissions,
  scheduleStationNotifications,
} from '../../../../services/stationNotifications';

type GeneratedMessage = {
  key: string;
  label: string;
  icon: string;
  color: string;
  text: string;
  title: string;
};

function buildMessages(
  run: TrainRunSession,
  stops: TrainStop[],
  delayMinutes: number,
  delayReason: string,
): GeneratedMessage[] {
  const session = runSessionToTrainSession(run);
  const msgs: GeneratedMessage[] = [];
  const delayed = delayMinutes >= 5;
  const delayStr = String(delayMinutes);
  const timeOfDay = new Date().getHours() >= 18 ? 'wieczor' as const : 'dzien' as const;

  let extendedWelcomeDelivered = false;

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    const isFirst = i === 0;
    const isLast = i === stops.length - 1;
    const nextStop = i + 1 < stops.length ? stops[i + 1] : null;
    const prevStop = i - 1 >= 0 ? stops[i - 1] : null;

    const travelFromPrev = prevStop
      ? travelTimeMinutes(prevStop.departurePlanned, stop.arrivalPlanned)
      : null;
    const isTransitArrival = travelFromPrev !== null && travelFromPrev <= 7;

    const travelToNext = nextStop
      ? travelTimeMinutes(stop.departurePlanned, nextStop.arrivalPlanned)
      : null;
    const nextIsTransit = travelToNext !== null && travelToNext <= 7;

    const stopDuration = travelTimeMinutes(stop.arrivalPlanned, stop.departurePlanned);
    const longStop = stopDuration !== null && stopDuration >= 5;

    // #region agent log — H1-H4 per-station decision
    fetch('http://127.0.0.1:7712/ingest/bae5bd1d-7baa-4e09-9547-8b9b3c9701cc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d3ca34'},body:JSON.stringify({sessionId:'d3ca34',location:'watch.tsx:buildMessages:loop',message:'per-station decision',data:{i,station:stop.name,isFirst,isLast,travelFromPrev,isTransitArrival,travelToNext,nextIsTransit,isVoivodeship:isVoivodeshipCapital(stop.name),extendedWelcomeDelivered,prevDep:prevStop?.departurePlanned,curArr:stop.arrivalPlanned,curDep:stop.departurePlanned,nextArr:nextStop?.arrivalPlanned},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    // ── Before arriving at station (farewell / transit) — skip first station ──
    if (!isFirst) {
      const isFinal = isLast;

      if (isTransitArrival) {
        const text = generatePozegnalny(
          {
            stationName: stop.name,
            isTransit: true,
            isFinal,
            delayed,
            longStop,
            departureTime: stop.departurePlanned ?? '',
            transfers: false,
            zka: false,
            zkaStation: '',
            airport: false,
            airportStation: '',
            wagonsDetach: false,
            detachGroupNumbers: '',
            detachGroupStation: '',
            detachEndWagons: '',
          },
          session,
        );
        msgs.push({
          key: `transit-${i}`,
          label: `Tranzyt: ${stop.name}`,
          icon: 'swap-horizontal',
          color: '#FF9800',
          text,
          title: `Powitalno-pożegnalny (tranzyt) — ${stop.name}`,
        });
      } else {
        const text = generatePozegnalny(
          {
            stationName: stop.name,
            isTransit: false,
            isFinal,
            delayed,
            longStop: false,
            departureTime: stop.departurePlanned ?? '',
            transfers: false,
            zka: false,
            zkaStation: '',
            airport: false,
            airportStation: '',
            wagonsDetach: false,
            detachGroupNumbers: '',
            detachGroupStation: '',
            detachEndWagons: '',
          },
          session,
        );
        msgs.push({
          key: `farewell-${i}`,
          label: `Przed: ${stop.name}`,
          icon: 'hand-wave-outline',
          color: '#2196F3',
          text,
          title: isFinal
            ? `Pożegnalny (stacja docelowa) — ${stop.name}`
            : `Pożegnalny — ${stop.name}`,
        });
      }
    }

    // ── After departing from station (welcome) — skip last station ──
    // Skip welcome if next gap is transit (transit message will cover it)
    if (!isLast && nextStop && !nextIsTransit) {
      let text: string;
      let title: string;

      const needsExtended = isFirst || isVoivodeshipCapital(stop.name) || !extendedWelcomeDelivered;

      if (needsExtended) {
        text = generatePRozszerzony(
          {
            nextStation: nextStop.name,
            timeOfDay,
            groupWagons: false,
            groupWagonsStation: '',
            delayed,
            delayMinutes: delayStr,
            delayReason,
          },
          session,
        );
        title = isFirst
          ? `Powitalny rozszerzony — za ${stop.name}`
          : isVoivodeshipCapital(stop.name)
            ? `Powitalny rozszerzony — za ${stop.name} (woj.)`
            : `Powitalny rozszerzony — za ${stop.name}`;
        extendedWelcomeDelivered = true;
      } else {
        text = generatePSkrocony(
          {
            nextStation: nextStop.name,
            delayed,
            delayMinutes: delayStr,
            delayReason,
          },
          session,
        );
        title = `Powitalny skrócony — za ${stop.name}`;
      }

      msgs.push({
        key: `welcome-${i}`,
        label: `Po: ${stop.name}`,
        icon: needsExtended ? 'microphone' : 'microphone-outline',
        color: '#4CAF50',
        text,
        title,
      });
    }
  }

  return msgs;
}

export default function WatchScreen() {
  const { isDark } = useTheme();
  const colors = useColors();
  const router = useRouter();

  const [run, setRun] = useState<TrainRunSession | null>(null);
  const [delayMinutes, setDelayMinutes] = useState(0);
  const [delayReason, setDelayReason] = useState(DELAY_REASONS[0]);
  const [delayInput, setDelayInput] = useState('0');
  const [reasonPickerOpen, setReasonPickerOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [notificationsOn, setNotificationsOn] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadRunSession().then(rs => {
        if (rs) {
          setRun(rs);
          setDelayMinutes(rs.delayMinutes);
          setDelayInput(String(rs.delayMinutes));
          setNotifCount(getScheduledCount());
        }
      });
    }, []),
  );

  // #region agent log — H1,H2,H4,H5 debug instrumentation
  React.useEffect(() => {
    if (!run || !isRunSessionValid(run)) return;
    const stops = workStops(run);
    const messages = buildMessages(run, stops, delayMinutes, delayReason);
    const farewellMsgs = messages.filter(m => m.key.startsWith('farewell-'));
    const transitMsgs = messages.filter(m => m.key.startsWith('transit-'));
    const welcomeMsgs = messages.filter(m => m.key.startsWith('welcome-'));
    const gastroInFarewell = farewellMsgs.filter(m => m.text.toLowerCase().includes('gastronom') || m.text.toLowerCase().includes('wars') || m.text.toLowerCase().includes('automat'));
    const numericStationNames = stops.filter(s => /^\d+$/.test(s.name));
    const delayReasonsList = DELAY_REASONS;
    const hasTimeStrips = messages.some(m => m.key.startsWith('time-'));
    const voivodeshipWelcomes = welcomeMsgs.filter(m => m.title.includes('(woj.)'));

    fetch('http://127.0.0.1:7712/ingest/bae5bd1d-7baa-4e09-9547-8b9b3c9701cc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d3ca34'},body:JSON.stringify({sessionId:'d3ca34',location:'watch.tsx:debug',message:'WatchScreen debug snapshot',data:{H1_numericStationNames: numericStationNames.map(s => s.name),H1_allStationNames: stops.map(s => s.name),H2_farewellCount: farewellMsgs.length,H2_farewellWithGastro: gastroInFarewell.map(m => ({key:m.key,snippet:m.text.substring(0,120)})),H2_gastroType: run.gastroType,H4_delayReasonsCount: delayReasonsList.length,H4_delayReasonsIsFlat: !Array.isArray(delayReasonsList[0]),H4_firstThreeReasons: delayReasonsList.slice(0,3),H5_hasTimeStrips: hasTimeStrips,H5_messageKeys: messages.map(m => m.key),H6_transitCount: transitMsgs.length,H6_transitKeys: transitMsgs.map(m => m.key),H7_voivodeshipWelcomes: voivodeshipWelcomes.map(m => m.title)},timestamp:Date.now()})}).catch(()=>{});
  }, [run, delayMinutes, delayReason]);
  // #endregion

  if (!run || !isRunSessionValid(run)) {
    return (
      <Screen scroll backgroundColor={colors.background}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }} hitSlop={8} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Pilnowanie</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="train-variant" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Brak skonfigurowanej trasy</Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            Skonfiguruj trasę pociągu, aby rozpocząć pilnowanie.
          </Text>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
            onPress={() => router.push('/(app)/work/messages/setup-run')}
          >
            <MaterialCommunityIcons name="cog-outline" size={20} color="#fff" />
            <Text style={styles.primaryBtnText}>Konfiguruj trasę</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  const stops = workStops(run);
  const messages = buildMessages(run, stops, delayMinutes, delayReason);

  const handleDelayChange = (text: string) => {
    setDelayInput(text);
    const val = parseInt(text, 10);
    if (!isNaN(val) && val >= 0) {
      setDelayMinutes(val);
      const updated = { ...run, delayMinutes: val };
      saveRunSession(updated);
      if (notificationsOn) {
        if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
        delayTimerRef.current = setTimeout(async () => {
          const count = await scheduleStationNotifications(updated);
          setNotifCount(count);
        }, 800);
      }
    }
  };

  const handleToggleNotifications = async (enabled: boolean) => {
    if (enabled) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert('Brak uprawnień', 'Włącz powiadomienia w ustawieniach systemu.');
        return;
      }
      setNotificationsOn(true);
      if (run) {
        const count = await scheduleStationNotifications(run);
        setNotifCount(count);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } else {
      setNotificationsOn(false);
      await cancelAllStationNotifications();
      setNotifCount(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleCopy = async (text: string, key: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleAddToQueue = (msg: GeneratedMessage) => {
    addToQueue({
      id: Date.now().toString(),
      typeId: 'pozegnalny',
      title: msg.title,
      text: msg.text,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Dodano', 'Komunikat dodany do kolejki.');
  };

  const handlePreview = (msg: GeneratedMessage) => {
    router.push({
      pathname: '/(app)/work/messages/preview',
      params: {
        text: msg.text.replace(/\n\n/g, '§§'),
        title: msg.title,
        typeId: 'pozegnalny',
      },
    });
  };

  const toggleExpand = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedKey(prev => (prev === key ? null : key));
  };

  // Group messages by station for visual clarity
  let currentStopIdx = -1;

  return (
    <Screen scroll backgroundColor={colors.background}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }} hitSlop={8} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Pilnowanie</Text>
        <TouchableOpacity onPress={() => router.push('/(app)/work/messages/setup-run')} hitSlop={8}>
          <MaterialCommunityIcons name="cog-outline" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Train summary */}
        <View style={[styles.trainCard, { backgroundColor: colors.surface }]}>
          <View style={styles.trainRow}>
            <MaterialCommunityIcons name="train" size={18} color={colors.accent} />
            <Text style={[styles.trainTitle, { color: colors.text }]}>
              {run.category} {run.trainName ? `„${run.trainName}" ` : ''}{run.trainNumber}
            </Text>
          </View>
          <Text style={[styles.trainSub, { color: colors.textSecondary }]}>
            {run.stationFrom} → {run.stationTo} · wag. {run.serviceWagon}
          </Text>
        </View>

        {/* Delay control */}
        <View style={[styles.delayCard, { backgroundColor: delayMinutes >= 5 ? colors.warning + '22' : colors.surface }]}>
          <View style={styles.delayRow}>
            <MaterialCommunityIcons
              name={delayMinutes >= 5 ? 'clock-alert-outline' : 'clock-check-outline'}
              size={20}
              color={delayMinutes >= 5 ? colors.warning : colors.success}
            />
            <Text style={[styles.delayLabel, { color: colors.text }]}>
              {delayMinutes >= 5 ? 'Opóźnienie' : 'Zgodnie z rozkładem'}
            </Text>
            <TextInput
              style={[styles.delayInput, { backgroundColor: colors.background, color: colors.text }]}
              value={delayInput}
              onChangeText={handleDelayChange}
              keyboardType="numeric"
              selectTextOnFocus
            />
            <Text style={[styles.delayUnit, { color: colors.textSecondary }]}>min</Text>
          </View>
          {delayMinutes >= 5 && (
            <TouchableOpacity
              style={[styles.reasonBtn, { backgroundColor: colors.background }]}
              onPress={() => setReasonPickerOpen(true)}
            >
              <Text style={[styles.reasonText, { color: colors.text }]} numberOfLines={1}>
                {delayReason}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Notifications toggle */}
        <View style={[styles.notifCard, { backgroundColor: colors.surface }]}>
          <View style={styles.notifRow}>
            <MaterialCommunityIcons
              name={notificationsOn ? 'bell-ring-outline' : 'bell-off-outline'}
              size={20}
              color={notificationsOn ? colors.accent : colors.textSecondary}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.notifLabel, { color: colors.text }]}>Powiadomienia</Text>
              {notificationsOn && notifCount > 0 && (
                <Text style={[styles.notifSub, { color: colors.textSecondary }]}>
                  Zaplanowano {notifCount} przypomnień (−5 min)
                </Text>
              )}
            </View>
            <Switch
              value={notificationsOn}
              onValueChange={handleToggleNotifications}
              trackColor={{ true: colors.accent }}
            />
          </View>
        </View>

        {/* Station list with messages */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          KOMUNIKATY ({stops.length} stacji · {messages.length} komunikatów)
        </Text>

        {messages.map(msg => {
          const isExpanded = expandedKey === msg.key;
          const isCopied = copied === msg.key;

          return (
            <View key={msg.key} style={[styles.msgCard, { backgroundColor: colors.surface }]}>
              <TouchableOpacity style={styles.msgHeader} onPress={() => toggleExpand(msg.key)} activeOpacity={0.7}>
                <View style={[styles.msgIcon, { backgroundColor: msg.color + '22' }]}>
                  <MaterialCommunityIcons name={msg.icon as any} size={18} color={msg.color} />
                </View>
                <View style={styles.msgInfo}>
                  <Text style={[styles.msgLabel, { color: colors.text }]}>{msg.label}</Text>
                </View>
                <MaterialCommunityIcons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.msgBody}>
                  <Text style={[styles.msgText, { color: colors.text }]}>{msg.text}</Text>
                  <View style={styles.msgActions}>
                    <TouchableOpacity
                      style={[styles.msgActionBtn, { backgroundColor: isCopied ? colors.success + '22' : colors.background }]}
                      onPress={() => handleCopy(msg.text, msg.key)}
                    >
                      <MaterialCommunityIcons
                        name={isCopied ? 'check' : 'content-copy'}
                        size={16}
                        color={isCopied ? colors.success : colors.textSecondary}
                      />
                      <Text style={[styles.msgActionText, { color: isCopied ? colors.success : colors.textSecondary }]}>
                        {isCopied ? 'Skopiowano' : 'Kopiuj'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.msgActionBtn, { backgroundColor: colors.background }]}
                      onPress={() => handleAddToQueue(msg)}
                    >
                      <MaterialCommunityIcons name="playlist-plus" size={16} color={colors.textSecondary} />
                      <Text style={[styles.msgActionText, { color: colors.textSecondary }]}>Kolejka</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.msgActionBtn, { backgroundColor: colors.accent + '22' }]}
                      onPress={() => handlePreview(msg)}
                    >
                      <MaterialCommunityIcons name="eye-outline" size={16} color={colors.accent} />
                      <Text style={[styles.msgActionText, { color: colors.accent }]}>Podgląd</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        })}

        {/* Classic templates link */}
        <TouchableOpacity
          style={[styles.classicLink, { backgroundColor: colors.surface }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/(app)/work/messages/classic');
          }}
        >
          <MaterialCommunityIcons name="format-list-bulleted" size={20} color={colors.textSecondary} />
          <Text style={[styles.classicLinkText, { color: colors.text }]}>Klasyczne szablony</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

      </ScrollView>

      {/* Delay reason picker modal */}
      <Modal visible={reasonPickerOpen} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setReasonPickerOpen(false)} />
        <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Przyczyna opóźnienia</Text>
          <ScrollView>
            {DELAY_REASONS.map(r => (
              <TouchableOpacity
                key={r}
                style={[styles.modalOption, delayReason === r && { backgroundColor: colors.accent + '22' }]}
                onPress={() => {
                  setDelayReason(r);
                  setReasonPickerOpen(false);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={[styles.modalOptionText, { color: delayReason === r ? colors.accent : colors.text }]}>{r}</Text>
                {delayReason === r && <MaterialCommunityIcons name="check" size={18} color={colors.accent} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  title: { flex: 1, fontSize: 22, fontWeight: '700', marginLeft: 8 },
  scroll: { paddingHorizontal: 16 },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  trainCard: { borderRadius: 14, padding: 14, marginBottom: 12 },
  trainRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trainTitle: { fontSize: 16, fontWeight: '700' },
  trainSub: { fontSize: 13, marginTop: 4 },

  delayCard: { borderRadius: 14, padding: 14, marginBottom: 16 },
  delayRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  delayLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  delayInput: {
    width: 56, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 6,
    fontSize: 16, fontWeight: '700', textAlign: 'center',
  },
  delayUnit: { fontSize: 13 },
  reasonBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginTop: 10,
  },
  reasonText: { fontSize: 13, flex: 1, marginRight: 4 },

  notifCard: { borderRadius: 14, padding: 14, marginBottom: 16 },
  notifRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notifLabel: { fontSize: 15, fontWeight: '600' },
  notifSub: { fontSize: 12, marginTop: 2 },

  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },

  msgCard: { borderRadius: 12, marginBottom: 8, overflow: 'hidden' },
  msgHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 12, gap: 10,
  },
  msgIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  msgInfo: { flex: 1 },
  msgLabel: { fontSize: 14, fontWeight: '600' },
  msgBody: { paddingHorizontal: 12, paddingBottom: 12 },
  msgText: { fontSize: 15, lineHeight: 22, marginBottom: 12 },
  msgActions: { flexDirection: 'row', gap: 8 },
  msgActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  msgActionText: { fontSize: 12, fontWeight: '600' },

  classicLink: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, padding: 14, marginTop: 8,
  },
  classicLinkText: { flex: 1, fontSize: 15, fontWeight: '600' },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, paddingVertical: 16, paddingHorizontal: 24, marginTop: 16,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

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
});
