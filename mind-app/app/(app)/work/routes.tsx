import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { Screen } from '../../../components/Screen';
import { Colors } from '../../../constants/theme';
import { useTheme, useColors } from '../../../contexts/ThemeContext';
import {
  createRouteControl,
  createRouteDefinition,
  fetchRouteControls,
  RouteControlRoute,
  RouteControlStatus,
  updateRouteControl,
} from '../../../services/work';

const STATUS_META: Record<RouteControlStatus, { label: string; color: string; icon: string }> = {
  ok: { label: 'Aktualny', color: '#10B981', icon: 'check-circle-outline' },
  missing_last_driven: { label: 'Uzupełnij ostatnią jazdę', color: '#F59E0B', icon: 'calendar-alert' },
  paper_due: { label: 'Po terminie oddania', color: '#EF4444', icon: 'file-alert-outline' },
  expires_soon: { label: 'Zgłoś do naczelnika', color: '#F97316', icon: 'alert-outline' },
  expired: { label: 'Wygasł', color: '#DC2626', icon: 'close-circle-outline' },
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function prettyDate(date: string | null | undefined): string {
  return date ?? 'brak';
}

function alertApiError(title: string, err: unknown, fallback: string) {
  const message = err instanceof Error && err.message ? err.message : fallback;
  Alert.alert(title, message);
}

export default function RouteControlsScreen() {
  const { isDark } = useTheme();
  const colors = useColors();

  const [routes, setRoutes] = useState<RouteControlRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [acquiredAt, setAcquiredAt] = useState(todayIso());
  const [lastDrivenAt, setLastDrivenAt] = useState('');
  const [digitalCopyUri, setDigitalCopyUri] = useState('');

  const load = () => {
    setLoading(true);
    fetchRouteControls()
      .then(setRoutes)
      .catch(err => alertApiError('Błąd', err, 'Nie udało się pobrać kontrolek szlaków'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setName('');
    setDescription('');
    setAcquiredAt(todayIso());
    setLastDrivenAt('');
    setDigitalCopyUri('');
    setShowForm(false);
  };

  const handleCreate = async () => {
    if (!name.trim()) return Alert.alert('Brak nazwy', 'Wpisz nazwę szlaku');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(acquiredAt)) return Alert.alert('Zła data', 'Data musi mieć format YYYY-MM-DD');
    if (lastDrivenAt && !/^\d{4}-\d{2}-\d{2}$/.test(lastDrivenAt)) return Alert.alert('Zła data', 'Ostatnia jazda musi mieć format YYYY-MM-DD');

    setSaving(true);
    try {
      const route = await createRouteDefinition(name.trim(), description.trim() || undefined);
      await createRouteControl({
        routeDefinitionId: route.id,
        acquiredAt,
        lastDrivenAt: lastDrivenAt || null,
        digitalCopyUri: digitalCopyUri.trim() || null,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      resetForm();
      load();
    } catch (err) {
      alertApiError('Błąd', err, 'Nie udało się dodać kontrolki');
    } finally {
      setSaving(false);
    }
  };

  const attachControl = async (route: RouteControlRoute) => {
    setSaving(true);
    try {
      await createRouteControl({
        routeDefinitionId: route.id,
        acquiredAt: todayIso(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      load();
    } catch (err) {
      alertApiError('Błąd', err, 'Nie udało się utworzyć kontrolki dla szlaku');
    } finally {
      setSaving(false);
    }
  };

  const updateControl = async (route: RouteControlRoute, patch: Parameters<typeof updateRouteControl>[1]) => {
    if (!route.control) return;
    setSaving(true);
    try {
      await updateRouteControl(route.control.id, patch);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      load();
    } catch (err) {
      alertApiError('Błąd', err, 'Nie udało się zaktualizować kontrolki');
    } finally {
      setSaving(false);
    }
  };

  const headerRight = (
    <TouchableOpacity onPress={() => setShowForm(v => !v)} hitSlop={8}>
      <MaterialCommunityIcons name={showForm ? 'close' : 'plus'} size={24} color={colors.accent} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <Screen backgroundColor={colors.background} centerContent>
        <ScreenHeader title="Kontrolki szlaków" right={headerRight} textColor={colors.text} />
        <ActivityIndicator color={colors.accent} size="large" />
      </Screen>
    );
  }

  return (
    <Screen scroll keyboardAvoid backgroundColor={colors.background} contentContainerStyle={styles.list}>
      <ScreenHeader title="Kontrolki szlaków" right={headerRight} textColor={colors.text} />

      {showForm && (
        <View style={[styles.form, { backgroundColor: colors.surface }]}>
          <Text style={[styles.formTitle, { color: colors.text }]}>Nowy szlak</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="np. Warszawa - Wrocław przez Częstochowę"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Opis / wariant szlaku (opcjonalnie)"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          <TextInput
            value={acquiredAt}
            onChangeText={setAcquiredAt}
            placeholder="Data nabycia YYYY-MM-DD"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          <TextInput
            value={lastDrivenAt}
            onChangeText={setLastDrivenAt}
            placeholder="Ostatnia jazda YYYY-MM-DD (opcjonalnie)"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          <TextInput
            value={digitalCopyUri}
            onChangeText={setDigitalCopyUri}
            placeholder="Link/notatka do cyfrowej kopii (opcjonalnie)"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          <TouchableOpacity onPress={handleCreate} disabled={saving} style={[styles.primaryBtn, { backgroundColor: colors.accent }]}>
            <Text style={styles.primaryBtnText}>{saving ? 'Zapisywanie...' : 'Dodaj kontrolkę'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {routes.length === 0 ? (
        <View style={styles.centerCard}>
          <MaterialCommunityIcons name="map-marker-path" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Brak szlaków. Dodaj swój pierwszy szlak</Text>
        </View>
      ) : routes.map(route => {
        const control = route.control;
        const computed = control?.computed;
        const meta = STATUS_META[computed?.status ?? 'missing_last_driven'];
        return (
          <View key={route.id} style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: meta.color + '18' }]}>
                <MaterialCommunityIcons name={meta.icon as 'check-circle-outline'} size={22} color={meta.color} />
              </View>
              <View style={styles.titleWrap}>
                <Text style={[styles.routeName, { color: colors.text }]}>{route.name}</Text>
                {!!route.description && <Text style={[styles.routeDesc, { color: colors.textSecondary }]}>{route.description}</Text>}
              </View>
            </View>

            <View style={[styles.statusPill, { backgroundColor: meta.color + '18' }]}>
              <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
            </View>

            {control ? (
              <>
                <View style={styles.metaGrid}>
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}>Nabycie: {prettyDate(control.acquiredAt)}</Text>
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}>Ostatnia jazda: {prettyDate(control.lastDrivenAt)}</Text>
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}>Oddać do: {prettyDate(computed?.paperDeadline)}</Text>
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}>Wygasa: {prettyDate(computed?.expiresAt)}</Text>
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}>Zgłosić od: {prettyDate(computed?.reportToChiefAt)}</Text>
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}>Oddano: {prettyDate(control.paperSubmittedAt)}</Text>
                </View>
                {!!control.digitalCopyUri && (
                  <Text style={[styles.copyText, { color: colors.accent }]}>Kopia: {control.digitalCopyUri}</Text>
                )}
                <View style={styles.actions}>
                  <TouchableOpacity
                    onPress={() => updateControl(route, { lastDrivenAt: todayIso(), paperSubmittedAt: null })}
                    disabled={saving}
                    style={[styles.actionBtn, { borderColor: colors.border }]}
                  >
                    <Text style={[styles.actionText, { color: colors.text }]}>Jechane dziś</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => updateControl(route, { paperSubmittedAt: todayIso() })}
                    disabled={saving}
                    style={[styles.actionBtn, { borderColor: colors.border }]}
                  >
                    <Text style={[styles.actionText, { color: colors.text }]}>Oddane dziś</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  Szlak bez aktywnej kontrolki — utwórz ją, żeby oznaczać jazdy i oddania.
                </Text>
                <TouchableOpacity
                  onPress={() => attachControl(route)}
                  disabled={saving}
                  style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
                >
                  <Text style={styles.primaryBtnText}>{saving ? 'Zapisywanie...' : 'Utwórz kontrolkę'}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  centerCard: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: 12 },
  emptyText: { fontSize: 15, textAlign: 'center' },
  form: { borderRadius: 16, padding: 14, gap: 10 },
  formTitle: { fontSize: 16, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  primaryBtn: { borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  card: { borderRadius: 16, padding: 14, gap: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { flex: 1 },
  routeName: { fontSize: 15, fontWeight: '700' },
  routeDesc: { fontSize: 12, marginTop: 2 },
  statusPill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: 12, fontWeight: '700' },
  metaGrid: { gap: 4 },
  metaText: { fontSize: 12 },
  copyText: { fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  actionBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  actionText: { fontSize: 13, fontWeight: '600' },
});
