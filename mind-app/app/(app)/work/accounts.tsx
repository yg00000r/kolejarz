import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../../constants/theme';
import { useTheme } from '../../../contexts/ThemeContext';
import { type AccountBalance, fetchAccounts } from '../../../services/work';
import { Screen } from '../../../components/Screen';

const ACCOUNT_ICONS: Record<string, string> = {
  'Nadgodziny':    'clock-plus-outline',
  'Urlop':         'palm-tree',
  'UDZ':           'calendar-check-outline',
  'WŻ':            'train-car-passenger',
  'Praca nocna':   'weather-night',
};

function guessIcon(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(ACCOUNT_ICONS)) {
    if (lower.includes(key.toLowerCase())) return icon;
  }
  if (lower.includes('urlop') || lower.includes('urlaub')) return 'palm-tree';
  if (lower.includes('nad') || lower.includes('über')) return 'clock-plus-outline';
  if (lower.includes('noc') || lower.includes('nacht')) return 'weather-night';
  return 'chart-line';
}

function valueColor(value: string): string {
  const num = parseFloat(value.replace(',', '.').replace(/[^\d.\-]/g, ''));
  if (isNaN(num)) return '#6B7280';
  if (num > 0) return '#10B981';
  if (num < 0) return '#EF4444';
  return '#6B7280';
}

export default function AccountsScreen() {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const router = useRouter();

  const [accounts, setAccounts] = useState<AccountBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setLoading(true);
    setError(false);
    fetchAccounts()
      .then((data) => setAccounts(data.accounts))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <Screen scroll backgroundColor={colors.background}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }} style={styles.backBtn} hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Konta</Text>
        <TouchableOpacity onPress={load} hitSlop={8}>
          <MaterialCommunityIcons name="refresh" size={22} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Nie udało się pobrać sald</Text>
          <TouchableOpacity onPress={load} style={[styles.retryBtn, { backgroundColor: colors.accent }]}>
            <Text style={styles.retryText}>Spróbuj ponownie</Text>
          </TouchableOpacity>
        </View>
      ) : accounts.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="chart-bar" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Brak danych kont</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {accounts.map((acc, i) => {
            const icon = guessIcon(acc.name);
            const vColor = valueColor(acc.value);
            return (
              <View key={`${acc.name}-${i}`} style={[styles.accountCard, { backgroundColor: colors.surface }]}>
                <View style={[styles.iconCircle, { backgroundColor: vColor + '18' }]}>
                  <MaterialCommunityIcons name={icon as any} size={20} color={vColor} />
                </View>
                <View style={styles.accountInfo}>
                  <Text style={[styles.accountName, { color: colors.text }]} numberOfLines={2}>{acc.name}</Text>
                  {acc.referenceDate ? (
                    <Text style={[styles.accountRef, { color: colors.textSecondary }]}>{acc.referenceDate}</Text>
                  ) : null}
                </View>
                <Text style={[styles.accountValue, { color: vColor }]}>{acc.value}</Text>
              </View>
            );
          })}
        </ScrollView>
      )}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  emptyText: { fontSize: 15, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 4 },
  retryText: { color: '#fff', fontWeight: '600' },
  list: { paddingHorizontal: 16, gap: 8 },

  accountCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, padding: 14, gap: 12,
  },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  accountInfo: { flex: 1, gap: 2 },
  accountName: { fontSize: 14, fontWeight: '500' },
  accountRef: { fontSize: 11 },
  accountValue: { fontSize: 18, fontWeight: '700' },
});
