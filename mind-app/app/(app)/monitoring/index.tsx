import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../../../constants/theme';
import { useTheme } from '../../../contexts/ThemeContext';
import { Screen } from '../../../components/Screen';
import {
  Device,
  DockerContainer,
  VpsInfo,
  monitoringService,
} from '../../../services/monitoring';

function StatusBadge({ online, colors }: { online: boolean; colors: typeof Colors.dark }) {
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: online ? colors.success + '22' : colors.error + '22' },
      ]}
    >
      <View
        style={[
          styles.badgeDot,
          { backgroundColor: online ? colors.success : colors.error },
        ]}
      />
      <Text style={[styles.badgeText, { color: online ? colors.success : colors.error }]}>
        {online ? 'Online' : 'Offline'}
      </Text>
    </View>
  );
}

export default function MonitoringScreen() {
  const { isDark } = useTheme();
  const colors = (isDark ? Colors.dark : Colors.light) as typeof Colors.dark;
  const router = useRouter();

  const [devices, setDevices] = useState<Device[]>([]);
  const [vps, setVps] = useState<VpsInfo | null>(null);
  const [docker, setDocker] = useState<{ available: boolean; containers: DockerContainer[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add device form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newHost, setNewHost] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);
    try {
      const [devRes, vpsRes, dockerRes] = await Promise.all([
        monitoringService.getDevices(),
        monitoringService.getVps(),
        monitoringService.getDocker(),
      ]);
      setDevices(devRes.data);
      setVps(vpsRes.data);
      setDocker(dockerRes.data);
    } catch {
      setError('Nie udało się pobrać danych');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddDevice = async () => {
    if (!newName.trim() || !newHost.trim()) return;
    setIsAdding(true);
    try {
      const res = await monitoringService.addDevice(newName.trim(), newHost.trim());
      setDevices((prev) => [...prev, { ...res.data, online: false }]);
      setNewName('');
      setNewHost('');
      setShowAddForm(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Reload to get ping status
      load(true);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteDevice = (device: Device) => {
    Alert.alert('Usuń urządzenie', `Usunąć "${device.name}"?`, [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń',
        style: 'destructive',
        onPress: async () => {
          try {
            await monitoringService.deleteDevice(device.id);
            setDevices((prev) => prev.filter((d) => d.id !== device.id));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }
        },
      },
    ]);
  };

  return (
    <Screen scroll backgroundColor={colors.background}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }} style={styles.backBtn} hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Monitorowanie</Text>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            load(true);
          }}
          hitSlop={8}
        >
          {isRefreshing ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <MaterialCommunityIcons name="refresh" size={24} color={colors.accent} />
          )}
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Pingowanie urządzeń...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          <TouchableOpacity onPress={() => load()} style={styles.retryBtn}>
            <Text style={[styles.retryText, { color: colors.accent }]}>Spróbuj ponownie</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* ── VPS ── */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>VPS</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.cardRow}>
              <View style={styles.cardLeft}>
                <MaterialCommunityIcons name="server" size={22} color={colors.accent} />
                <Text style={[styles.cardName, { color: colors.text }]}>Mind VPS</Text>
              </View>
              <StatusBadge online colors={colors} />
            </View>
            {vps && (
              <View style={styles.vpsStats}>
                <View style={[styles.statChip, { backgroundColor: colors.background }]}>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Uptime</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>{vps.uptime}</Text>
                </View>
                <View style={[styles.statChip, { backgroundColor: colors.background }]}>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>RAM</Text>
                  <Text
                    style={[
                      styles.statValue,
                      { color: vps.memPercent > 80 ? colors.warning : colors.text },
                    ]}
                  >
                    {vps.memPercent}% ({vps.usedMem}/{vps.totalMem} MB)
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* ── Docker ── */}
          {docker && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Docker</Text>
              {docker.available ? (
                docker.containers.length === 0 ? (
                  <View style={[styles.card, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                      Brak uruchomionych kontenerów
                    </Text>
                  </View>
                ) : (
                  docker.containers.map((c) => (
                    <View
                      key={c.name}
                      style={[styles.card, styles.cardSmall, { backgroundColor: colors.surface }]}
                    >
                      <View style={styles.cardRow}>
                        <View style={styles.cardLeft}>
                          <MaterialCommunityIcons
                            name="docker"
                            size={18}
                            color={colors.accent}
                          />
                          <View>
                            <Text style={[styles.cardName, { color: colors.text }]}>{c.name}</Text>
                            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                              {c.image}
                            </Text>
                          </View>
                        </View>
                        <StatusBadge online={c.running} colors={colors} />
                      </View>
                    </View>
                  ))
                )
              ) : (
                <View style={[styles.card, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    Docker niedostępny
                  </Text>
                </View>
              )}
            </>
          )}

          {/* ── Urządzenia ── */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Urządzenia</Text>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowAddForm((v) => !v);
              }}
              hitSlop={8}
            >
              <MaterialCommunityIcons
                name={showAddForm ? 'minus' : 'plus'}
                size={20}
                color={colors.accent}
              />
            </TouchableOpacity>
          </View>

          {showAddForm && (
            <View style={[styles.addForm, { backgroundColor: colors.surface }]}>
              <TextInput
                style={[styles.addInput, { color: colors.text, borderColor: colors.border }]}
                placeholder="Nazwa (np. Router)"
                placeholderTextColor={colors.textSecondary}
                value={newName}
                onChangeText={setNewName}
              />
              <TextInput
                style={[styles.addInput, { color: colors.text, borderColor: colors.border }]}
                placeholder="Host / IP (np. 192.168.1.1)"
                placeholderTextColor={colors.textSecondary}
                value={newHost}
                onChangeText={setNewHost}
                keyboardType="url"
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[
                  styles.addBtn,
                  { backgroundColor: colors.accent },
                  (!newName.trim() || !newHost.trim() || isAdding) && { opacity: 0.4 },
                ]}
                onPress={handleAddDevice}
                disabled={!newName.trim() || !newHost.trim() || isAdding}
              >
                {isAdding ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.addBtnText}>Dodaj urządzenie</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {devices.length === 0 ? (
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Brak urządzeń — dodaj pierwsze klikając +
              </Text>
            </View>
          ) : (
            devices.map((d) => (
              <View key={d.id} style={[styles.card, styles.cardSmall, { backgroundColor: colors.surface }]}>
                <View style={styles.cardRow}>
                  <View style={styles.cardLeft}>
                    <MaterialCommunityIcons name="lan-connect" size={20} color={colors.accent} />
                    <View>
                      <Text style={[styles.cardName, { color: colors.text }]}>{d.name}</Text>
                      <Text style={[styles.cardSub, { color: colors.textSecondary }]}>{d.host}</Text>
                    </View>
                  </View>
                  <View style={styles.cardRight}>
                    <StatusBadge online={d.online} colors={colors} />
                    <TouchableOpacity
                      onPress={() => handleDeleteDevice(d)}
                      hitSlop={8}
                    >
                      <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}

        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: '700', marginLeft: 8 },
  content: { paddingHorizontal: 16, gap: 10 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 2,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  card: { borderRadius: 14, padding: 16 },
  cardSmall: { padding: 12 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardName: { fontSize: 15, fontWeight: '600' },
  cardSub: { fontSize: 12, marginTop: 1 },
  vpsStats: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  statChip: { borderRadius: 10, padding: 10, flex: 1, minWidth: 120 },
  statLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  statValue: { fontSize: 13, fontWeight: '500' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 5,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  addForm: { borderRadius: 14, padding: 14, gap: 10 },
  addInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  addBtn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14 },
  errorText: { fontSize: 14, textAlign: 'center' },
  retryBtn: { padding: 8 },
  retryText: { fontSize: 14, fontWeight: '600' },
  emptyText: { fontSize: 14, textAlign: 'center' },
});
