import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Switch } from 'react-native-paper';
import { Colors } from '../../../constants/theme';
import { BASE_URL } from '../../../constants/api';
import { APP_VERSION } from '../../../constants/version';
import {
  checkForUpdates,
  getOtaBundleLabel,
  promptAndApplyUpdates,
} from '../../../services/appUpdate';
import * as Updates from 'expo-updates';
import { useAuth } from '../../../contexts/AuthContext';
import { useTheme, useColors } from '../../../contexts/ThemeContext';
import { ACCENT_PRESETS, ThemeMode, type TextScale } from '../../../hooks/useAppTheme';
import { useNotificationSetup } from '../../../hooks/useNotificationSetup';
import { Screen } from '../../../components/Screen';

const SHIFT_ALARM_OPTIONS = [30, 60, 120];
const TEXT_SCALE_OPTIONS: { scale: TextScale; label: string }[] = [
  { scale: 'S', label: 'Mała' },
  { scale: 'M', label: 'Średnia' },
  { scale: 'L', label: 'Duża' },
];

function versionDisplayLine(): string {
  const build = Application.nativeBuildVersion;
  const ota = getOtaBundleLabel();
  const channel = Updates.isEnabled && Updates.channel ? ` · ${Updates.channel}` : '';
  return build ? `${APP_VERSION} (${build}) · ${ota}${channel}` : `${APP_VERSION} · ${ota}${channel}`;
}

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: string }[] = [
  { mode: 'light', label: 'Jasny', icon: 'weather-sunny' },
  { mode: 'system', label: 'Systemowy', icon: 'theme-light-dark' },
  { mode: 'dark', label: 'Ciemny', icon: 'weather-night' },
];

export default function SettingsScreen() {
  const {
    isDark,
    mode: themeMode,
    setThemeMode,
    accentCustom,
    setAccent,
    textScale,
    setTextScale,
  } = useTheme();
  const {
    employeeNumber,
    biometricsEnabled,
    biometricsAvailable,
    setBiometrics,
    changePin,
    resetApp,
    logout,
  } = useAuth();
  const router = useRouter();
  const colors = useColors();

  const {
    prefs: notifPrefs,
    toggleShiftAlarm,
    toggleTimecardReminder,
    setShiftAlarmMinutes,
  } = useNotificationSetup();

  const handleNotifToggle = async (
    fn: (v: boolean) => Promise<boolean>,
    value: boolean,
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const ok = await fn(value);
    if (!ok && value) {
      Alert.alert(
        'Powiadomienia',
        'Aby włączyć przypomnienia, zezwól na powiadomienia w Ustawieniach systemu.',
      );
    }
  };

  const [portalStatus, setPortalStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'ok' | 'available' | 'error'>('idle');
  const [changePinModal, setChangePinModal] = useState(false);
  const [pinStep, setPinStep] = useState<'old' | 'new' | 'confirm'>('old');
  const [pinInput, setPinInput] = useState('');
  const [newPinStored, setNewPinStored] = useState('');
  const [pinError, setPinError] = useState('');
  const versionTapCount = useRef(0);
  const versionTapTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleCheckPortal = async () => {
    setPortalStatus('checking');
    try {
      const res = await fetch(`${BASE_URL}/portal/health`);
      const data = await res.json();
      setPortalStatus(data.ok ? 'ok' : 'error');
    } catch {
      setPortalStatus('error');
    }
  };

  const handleCheckUpdates = async () => {
    setUpdateStatus('checking');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await checkForUpdates();
      if (result.otaMisconfigured) {
        setUpdateStatus('error');
        await promptAndApplyUpdates(result);
      } else if (result.otaAvailable || result.nativeUpdate) {
        setUpdateStatus('available');
        await promptAndApplyUpdates(result);
      } else {
        setUpdateStatus('ok');
        await promptAndApplyUpdates(result);
      }
    } catch {
      setUpdateStatus('error');
      Alert.alert('Aktualizacje', 'Nie udało się sprawdzić aktualizacji.');
    }
  };

  const handleBiometricsToggle = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const ok = await setBiometrics(value);
    if (!ok) {
      if (value) {
        Alert.alert(
          'Face ID',
          'Nie udało się włączyć biometrii. Zatwierdź Face ID lub kod dostępu, gdy system wyświetli okno. W Expo Go musi być to na prawdziwym urządzeniu z ustawionym Face ID.',
        );
      } else {
        Alert.alert('Face ID', 'Nie udało się zapisać wyłączenia. Spróbuj ponownie.');
      }
    }
  };

  const resetPinModal = () => {
    setPinStep('old');
    setPinInput('');
    setNewPinStored('');
    setPinError('');
  };

  const openChangePinModal = () => {
    resetPinModal();
    setChangePinModal(true);
  };

  const handleResetApp = () => {
    Alert.alert(
      'Resetuj aplikację',
      'Wszystkie dane lokalne zostaną usunięte. Będziesz musiał zarejestrować się ponownie.',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Resetuj',
          style: 'destructive',
          onPress: async () => {
            await resetApp();
            logout();
            router.replace('/(auth)/register');
          },
        },
      ],
    );
  };

  const handleVersionTap = () => {
    versionTapCount.current += 1;
    if (versionTapTimer.current) clearTimeout(versionTapTimer.current);

    if (versionTapCount.current >= 7) {
      versionTapCount.current = 0;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push('/(app)/settings/diagnostics');
      return;
    }

    versionTapTimer.current = setTimeout(() => {
      versionTapCount.current = 0;
    }, 2000);
  };

  const portalBadgeColor =
    portalStatus === 'ok'
      ? colors.success
      : portalStatus === 'error'
        ? colors.error
        : colors.textSecondary;

  const portalBadgeText =
    portalStatus === 'checking'
      ? 'Sprawdzam...'
      : portalStatus === 'ok'
        ? 'Połączono'
        : portalStatus === 'error'
          ? 'Brak połączenia'
          : 'Nie sprawdzono';

  const updateBadgeText =
    updateStatus === 'checking'
      ? 'Sprawdzam...'
      : updateStatus === 'available'
        ? 'Dostępna'
        : updateStatus === 'ok'
          ? 'Aktualna'
          : updateStatus === 'error'
            ? 'Błąd'
            : 'Nie sprawdzono';

  const updateBadgeColor =
    updateStatus === 'available'
      ? colors.accent
      : updateStatus === 'ok'
        ? colors.success
        : updateStatus === 'error'
          ? colors.error
          : colors.textSecondary;

  // For the change PIN modal, we need to track oldPin separately
  const oldPinRef = useRef('');

  const handlePinModalSubmit = async () => {
    if (pinStep === 'old') {
      if (pinInput.length !== 4) { setPinError('PIN musi mieć 4 cyfry'); return; }
      oldPinRef.current = pinInput;
      setPinStep('new');
      setPinInput('');
      setPinError('');
    } else if (pinStep === 'new') {
      if (pinInput.length !== 4) { setPinError('PIN musi mieć 4 cyfry'); return; }
      setNewPinStored(pinInput);
      setPinStep('confirm');
      setPinInput('');
      setPinError('');
    } else if (pinStep === 'confirm') {
      if (pinInput !== newPinStored) {
        setPinError('PINy się nie zgadzają');
        setPinInput('');
        return;
      }
      const success = await changePin(oldPinRef.current, newPinStored);
      if (!success) {
        setPinError('Stary PIN jest nieprawidłowy');
        setPinStep('old');
        setPinInput('');
        setNewPinStored('');
        oldPinRef.current = '';
        return;
      }
      setChangePinModal(false);
      resetPinModal();
      oldPinRef.current = '';
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Gotowe', 'PIN został zmieniony.');
    }
  };

  const pinStepTitle =
    pinStep === 'old' ? 'Obecny PIN' : pinStep === 'new' ? 'Nowy PIN' : 'Potwierdź nowy PIN';

  return (
    <Screen edges={['bottom']} backgroundColor={colors.background}>
      <ScrollView >

        {/* Pracownik */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Pracownik</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.row}>
            <MaterialCommunityIcons name="account-outline" size={20} color={colors.textSecondary} />
            <Text style={[styles.rowLabel, { color: colors.text }]}>Login pracownika</Text>
            <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
              {employeeNumber ?? '—'}
            </Text>
          </View>
        </View>

        {/* Bezpieczenstwo */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Bezpieczeństwo</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {biometricsAvailable && (
            <View style={[styles.row, styles.rowBorder, { borderBottomColor: colors.border }]}>
              <MaterialCommunityIcons name="face-recognition" size={20} color={colors.textSecondary} />
              <Text style={[styles.rowLabel, { color: colors.text }]}>Face ID</Text>
              <Switch
                value={biometricsEnabled}
                onValueChange={handleBiometricsToggle}
                color={colors.accent}
              />
            </View>
          )}
          <TouchableOpacity style={styles.row} onPress={openChangePinModal} activeOpacity={0.6}>
            <MaterialCommunityIcons name="lock-reset" size={20} color={colors.textSecondary} />
            <Text style={[styles.rowLabel, { color: colors.text }]}>Zmień PIN</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Wyglad */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Wygląd</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.themeRow}>
            {THEME_OPTIONS.map((opt) => {
              const active = themeMode === opt.mode;
              return (
                <TouchableOpacity
                  key={opt.mode}
                  style={[
                    styles.themeOption,
                    { backgroundColor: active ? colors.accent : colors.surfaceSecondary },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setThemeMode(opt.mode);
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name={opt.icon as any}
                    size={18}
                    color={active ? '#fff' : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.themeLabel,
                      { color: active ? '#fff' : colors.textSecondary },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[styles.row, styles.rowBorder, { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <MaterialCommunityIcons name="palette-outline" size={20} color={colors.textSecondary} />
            <Text style={[styles.rowLabel, { color: colors.text }]}>Kolor akcentu</Text>
            <View style={styles.accentRow}>
              {ACCENT_PRESETS.map((c) => {
                const active = (accentCustom ?? ACCENT_PRESETS[0]) === c;
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => { Haptics.selectionAsync(); void setAccent(c === ACCENT_PRESETS[0] ? null : c); }}
                    style={[styles.accentSwatch, { backgroundColor: c }, active && { borderColor: colors.text, borderWidth: 2.5 }]}
                    activeOpacity={0.7}
                  >
                    {active && <MaterialCommunityIcons name="check" size={14} color="#fff" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.row}>
            <MaterialCommunityIcons name="format-size" size={20} color={colors.textSecondary} />
            <Text style={[styles.rowLabel, { color: colors.text }]}>Rozmiar tekstu</Text>
            <View style={styles.minutesRow}>
              {TEXT_SCALE_OPTIONS.map((opt) => {
                const active = textScale === opt.scale;
                return (
                  <TouchableOpacity
                    key={opt.scale}
                    style={[styles.minutesChip, { backgroundColor: active ? colors.accent : colors.surfaceSecondary }]}
                    onPress={() => { Haptics.selectionAsync(); void setTextScale(opt.scale); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.minutesChipText, { color: active ? '#fff' : colors.textSecondary }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Powiadomienia (Asystent) */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Powiadomienia (Asystent)</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={[styles.row, styles.rowBorder, { borderBottomColor: colors.border }]}>
            <MaterialCommunityIcons name="alarm" size={20} color={colors.textSecondary} />
            <Text style={[styles.rowLabel, { color: colors.text }]}>Alarm przed służbą</Text>
            <Switch
              value={notifPrefs.shiftAlarm}
              onValueChange={(v) => handleNotifToggle(toggleShiftAlarm, v)}
              color={colors.accent}
            />
          </View>
          {notifPrefs.shiftAlarm && (
            <View style={[styles.row, styles.rowBorder, { borderBottomColor: colors.border }]}>
              <MaterialCommunityIcons name="clock-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.rowLabel, { color: colors.text }]}>Wyprzedzenie</Text>
              <View style={styles.minutesRow}>
                {SHIFT_ALARM_OPTIONS.map((min) => {
                  const active = notifPrefs.shiftAlarmMinutes === min;
                  return (
                    <TouchableOpacity
                      key={min}
                      style={[styles.minutesChip, { backgroundColor: active ? colors.accent : colors.surfaceSecondary }]}
                      onPress={() => { Haptics.selectionAsync(); void setShiftAlarmMinutes(min); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.minutesChipText, { color: active ? '#fff' : colors.textSecondary }]}>
                        {min < 60 ? `${min} min` : `${min / 60} h`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
          <View style={styles.row}>
            <MaterialCommunityIcons name="clipboard-check-outline" size={20} color={colors.textSecondary} />
            <Text style={[styles.rowLabel, { color: colors.text }]}>Przypomnienie o karcie pracy</Text>
            <Switch
              value={notifPrefs.timecardReminder}
              onValueChange={(v) => handleNotifToggle(toggleTimecardReminder, v)}
              color={colors.accent}
            />
          </View>
        </View>

        {/* Portal */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Portal IVU.pad</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={[styles.row, styles.rowBorder, { borderBottomColor: colors.border }]}>
            <View style={[styles.statusDot, { backgroundColor: portalBadgeColor }]} />
            <Text style={[styles.rowLabel, { color: colors.text }]}>Status</Text>
            <Text style={[styles.rowValue, { color: portalBadgeColor }]}>{portalBadgeText}</Text>
          </View>
          <TouchableOpacity style={styles.row} onPress={handleCheckPortal} activeOpacity={0.6}>
            <MaterialCommunityIcons name="connection" size={20} color={colors.textSecondary} />
            <Text style={[styles.rowLabel, { color: colors.accent }]}>Sprawdź połączenie</Text>
          </TouchableOpacity>
        </View>

        {/* O aplikacji */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>O aplikacji</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <TouchableOpacity style={styles.row} onPress={handleVersionTap} activeOpacity={1}>
            <MaterialCommunityIcons name="information-outline" size={20} color={colors.textSecondary} />
            <Text style={[styles.rowLabel, { color: colors.text }]}>Wersja</Text>
            <Text style={[styles.rowValue, styles.rowValueMultiline, { color: colors.textSecondary }]}>
              {versionDisplayLine()}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.row, styles.rowBorder, { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}
            onPress={handleCheckUpdates}
            activeOpacity={0.6}
          >
            <MaterialCommunityIcons name="cloud-download-outline" size={20} color={colors.textSecondary} />
            <Text style={[styles.rowLabel, { color: colors.text }]}>Sprawdź aktualizacje</Text>
            <Text style={[styles.rowValue, { color: updateBadgeColor }]}>{updateBadgeText}</Text>
          </TouchableOpacity>
        </View>

        {/* Strefa niebezpieczna */}
        <Text style={[styles.sectionTitle, { color: colors.error }]}>Strefa niebezpieczna</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <TouchableOpacity style={styles.row} onPress={handleResetApp} activeOpacity={0.6}>
            <MaterialCommunityIcons name="delete-outline" size={20} color={colors.error} />
            <Text style={[styles.rowLabel, { color: colors.error }]}>Resetuj aplikację</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.error} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Change PIN Modal */}
      <Modal visible={changePinModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{pinStepTitle}</Text>

            <TextInput
              style={[styles.pinInput, { color: colors.text, borderColor: colors.border }]}
              value={pinInput}
              onChangeText={(t) => {
                setPinInput(t.replace(/[^0-9]/g, '').slice(0, 4));
                setPinError('');
              }}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              autoFocus
              placeholder="• • • •"
              placeholderTextColor={colors.textSecondary}
            />

            {pinError ? <Text style={[styles.pinError, { color: colors.error }]}>{pinError}</Text> : null}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.surfaceSecondary }]}
                onPress={() => {
                  setChangePinModal(false);
                  resetPinModal();
                  oldPinRef.current = '';
                }}
              >
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Anuluj</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.accent }]}
                onPress={handlePinModalSubmit}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>
                  {pinStep === 'confirm' ? 'Zmień' : 'Dalej'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingTop: 8 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
  },
  rowValue: {
    fontSize: 15,
  },
  rowValueMultiline: {
    flexShrink: 1,
    maxWidth: '58%',
    fontSize: 12,
    textAlign: 'right',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  minutesRow: {
    flexDirection: 'row',
    gap: 6,
  },
  accentRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  accentSwatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: 'transparent',
  },
  minutesChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  minutesChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  themeRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  themeLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalContent: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  pinInput: {
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: 12,
    textAlign: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
    marginBottom: 12,
  },
  pinError: {
    fontSize: 13,
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
