import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { EMPTY_SESSION, GastroType, TrainSession } from '../../../../constants/komunikaty';
import { Colors } from '../../../../constants/theme';
import { useTheme } from '../../../../contexts/ThemeContext';
import { clearTrainSession, loadTrainSession, saveTrainSession } from '../../../../services/trainSession';
import { Screen } from '../../../../components/Screen';

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

export default function SessionScreen() {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const router = useRouter();

  const [form, setForm] = useState<TrainSession>(EMPTY_SESSION);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTrainSession().then(s => { if (s) setForm(s); });
  }, []);

  const set = (key: keyof TrainSession, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!form.trainNumber || !form.stationStart || !form.stationEnd || !form.serviceWagon) {
      Alert.alert('Brakujące dane', 'Uzupełnij numer pociągu, stacje i wagon służbowy.');
      return;
    }
    setSaving(true);
    await saveTrainSession(form);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaving(false);
    router.back();
  };

  const handleClear = () => {
    Alert.alert('Wyczyść dane pociągu', 'Usunąć zapisane dane składu?', [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Wyczyść', style: 'destructive', onPress: async () => {
          await clearTrainSession();
          setForm(EMPTY_SESSION);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      },
    ]);
  };

  const showWarsWagon = form.gastroType === 'wars' || form.gastroType === 'wars_automat';
  const showAutomatWagon = form.gastroType === 'wars_automat' || form.gastroType === 'automat' || form.gastroType === 'brak_zastepstwo';
  const showMinibarEnd = form.gastroType === 'minibar';
  const showWarsEnd = form.gastroType === 'wars' || form.gastroType === 'wars_automat';

  return (
    <Screen scroll backgroundColor={colors.background}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }} hitSlop={8} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Dane pociągu</Text>
          <TouchableOpacity onPress={handleClear} hitSlop={8}>
            <MaterialCommunityIcons name="trash-can-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Pociąg */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>POCIĄG</Text>

          {/* Kategoria */}
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

          <Field label="Nazwa pociągu" value={form.trainName} onChange={v => set('trainName', v)} placeholder="np. Wawel" colors={colors} />
          <Field label="Numer pociągu" value={form.trainNumber} onChange={v => set('trainNumber', v)} placeholder="np. 1234" keyboardType="numeric" colors={colors} />

          {/* Trasa */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 20 }]}>TRASA</Text>
          <Field label="Stacja początkowa" value={form.stationStart} onChange={v => set('stationStart', v)} placeholder="np. Kraków Główny" colors={colors} />
          <Field label="Stacja końcowa" value={form.stationEnd} onChange={v => set('stationEnd', v)} placeholder="np. Warszawa Centralna" colors={colors} />
          <Field label="Stacje pośrednie (najważniejsze)" value={form.stationsVia} onChange={v => set('stationsVia', v)} placeholder="np. Kielce, Radom" colors={colors} />

          {/* Skład */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 20 }]}>SKŁAD</Text>
          <Field label="Wagon służbowy (numer)" value={form.serviceWagon} onChange={v => set('serviceWagon', v)} placeholder="np. 5" keyboardType="numeric" colors={colors} />

          {/* Gastronomia */}
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

          {/* Pola wagonu gastronomicznego */}
          {showWarsWagon && (
            <Field label="Wagon WARS (numer)" value={form.gastroWarsWagon} onChange={v => set('gastroWarsWagon', v)} placeholder="np. 3" keyboardType="numeric" colors={colors} />
          )}
          {showWarsEnd && (
            <Field label="WARS do stacji (opcjonalnie)" value={form.gastroWarsEndStation} onChange={v => set('gastroWarsEndStation', v)} placeholder="zostaw puste jeśli pełna trasa" colors={colors} />
          )}
          {showAutomatWagon && (
            <Field label="Wagon automat (numer)" value={form.gastroAutomatWagon} onChange={v => set('gastroAutomatWagon', v)} placeholder="np. 2" keyboardType="numeric" colors={colors} />
          )}
          {showMinibarEnd && (
            <Field label="Mini-bar do stacji (opcjonalnie)" value={form.gastroMinibarEndStation} onChange={v => set('gastroMinibarEndStation', v)} placeholder="zostaw puste jeśli pełna trasa" colors={colors} />
          )}

          {/* Zapisz */}
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.accent, opacity: saving ? 0.6 : 1 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Zapisywanie…' : 'Zapisz dane pociągu'}</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Field({ label, value, onChange, placeholder, keyboardType, colors }: {
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
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  title: { flex: 1, fontSize: 22, fontWeight: '700', marginLeft: 8 },
  scroll: { paddingHorizontal: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },
  chips: { gap: 8, flexDirection: 'row', marginBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  chipText: { fontSize: 13, fontWeight: '600' },
  fieldWrap: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '500', marginBottom: 5 },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  gastroRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, padding: 12, marginBottom: 6,
  },
  gastroText: { flex: 1 },
  gastroLabel: { fontSize: 15, fontWeight: '600' },
  gastroDesc: { fontSize: 12, marginTop: 1 },
  saveBtn: {
    borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 24,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
