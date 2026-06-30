import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../../../constants/theme';
import { BASE_URL } from '../../../constants/api';
import { useTheme, useColors } from '../../../contexts/ThemeContext';
import { Screen } from '../../../components/Screen';

type HealthData = {
  ok: boolean;
  loggedIn: boolean;
  lastSyncAt: string | null;
  error?: string;
};

type DiagResult = {
  health: HealthData | null;
  serverHealth: { status: string; timestamp: string } | null;
  syncResult: string | null;
};

export default function DiagnosticsScreen() {
  const { isDark } = useTheme();
  const colors = useColors();

  const [loading, setLoading] = useState<string | null>(null);
  const [diag, setDiag] = useState<DiagResult>({
    health: null,
    serverHealth: null,
    syncResult: null,
  });

  const runCheck = useCallback(async (key: string, fn: () => Promise<any>) => {
    setLoading(key);
    try {
      const result = await fn();
      setDiag((prev) => ({ ...prev, [key]: result }));
    } catch (e) {
      setDiag((prev) => ({ ...prev, [key]: { error: String(e) } }));
    } finally {
      setLoading(null);
    }
  }, []);

  const checkServerHealth = () =>
    runCheck('serverHealth', async () => {
      const res = await fetch(`${BASE_URL}/health`);
      return res.json();
    });

  const checkPortalHealth = () =>
    runCheck('health', async () => {
      const res = await fetch(`${BASE_URL}/portal/health`);
      return res.json();
    });

  const forceSync = () =>
    runCheck('syncResult', async () => {
      const now = new Date();
      const res = await fetch(`${BASE_URL}/shifts/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: now.getMonth() + 1, year: now.getFullYear() }),
      });
      const data = await res.json();
      return `Zsynchronizowano ${data.count ?? 0} służb (${data.month}/${data.year})`;
    });

  const renderValue = (val: any) => {
    if (val === null) return <Text style={[styles.valueText, { color: colors.textSecondary }]}>—</Text>;
    if (typeof val === 'string') return <Text style={[styles.valueText, { color: colors.text }]}>{val}</Text>;
    if (typeof val === 'object') {
      return (
        <Text style={[styles.valueText, { color: colors.text, fontFamily: 'monospace' }]}>
          {JSON.stringify(val, null, 2)}
        </Text>
      );
    }
    return <Text style={[styles.valueText, { color: colors.text }]}>{String(val)}</Text>;
  };

  return (
    <Screen edges={['bottom']} backgroundColor={colors.background}>
      <ScrollView >

        <View style={[styles.banner, { backgroundColor: colors.surfaceSecondary }]}>
          <MaterialCommunityIcons name="bug-outline" size={20} color={colors.warning} />
          <Text style={[styles.bannerText, { color: colors.textSecondary }]}>
            Panel diagnostyczny. Tylko do debugowania.
          </Text>
        </View>

        {/* Server Health */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Serwer</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <TouchableOpacity style={styles.actionRow} onPress={checkServerHealth} activeOpacity={0.6}>
            <MaterialCommunityIcons name="server-outline" size={18} color={colors.accent} />
            <Text style={[styles.actionLabel, { color: colors.accent }]}>Sprawdź serwer</Text>
            {loading === 'serverHealth' && <ActivityIndicator size="small" color={colors.accent} />}
          </TouchableOpacity>
          {diag.serverHealth && (
            <View style={[styles.resultBox, { backgroundColor: colors.surfaceSecondary }]}>
              {renderValue(diag.serverHealth)}
            </View>
          )}
        </View>

        {/* Portal Health */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Portal IVU.pad</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <TouchableOpacity style={styles.actionRow} onPress={checkPortalHealth} activeOpacity={0.6}>
            <MaterialCommunityIcons name="web" size={18} color={colors.accent} />
            <Text style={[styles.actionLabel, { color: colors.accent }]}>Sprawdź portal</Text>
            {loading === 'health' && <ActivityIndicator size="small" color={colors.accent} />}
          </TouchableOpacity>
          {diag.health && (
            <View style={[styles.resultBox, { backgroundColor: colors.surfaceSecondary }]}>
              {renderValue(diag.health)}
            </View>
          )}
        </View>

        {/* Force Sync */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Synchronizacja</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <TouchableOpacity style={styles.actionRow} onPress={forceSync} activeOpacity={0.6}>
            <MaterialCommunityIcons name="sync" size={18} color={colors.accent} />
            <Text style={[styles.actionLabel, { color: colors.accent }]}>Wymuś sync</Text>
            {loading === 'syncResult' && <ActivityIndicator size="small" color={colors.accent} />}
          </TouchableOpacity>
          {diag.syncResult && (
            <View style={[styles.resultBox, { backgroundColor: colors.surfaceSecondary }]}>
              {renderValue(diag.syncResult)}
            </View>
          )}
        </View>

        {/* Info */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Środowisko</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={[styles.resultBox, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={[styles.valueText, { color: colors.text, fontFamily: 'monospace' }]}>
              {`Backend: ${BASE_URL}\nPlatform: React Native (Expo)\nSDK: 54`}
            </Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingTop: 8 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  bannerText: {
    fontSize: 13,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  resultBox: {
    margin: 8,
    marginTop: 0,
    padding: 12,
    borderRadius: 8,
  },
  valueText: {
    fontSize: 13,
    lineHeight: 20,
  },
});
