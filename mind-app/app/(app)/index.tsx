import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { FadeSlideIn } from '../../components/FadeSlideIn';
import { PressScale } from '../../components/PressScale';
import { Screen } from '../../components/Screen';
import { ScreenHeaderIconButton } from '../../components/ScreenHeader';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { iosContinuousCurve, radius } from '../../constants/layout';
import { useAuth } from '../../contexts/AuthContext';
import { useColors } from '../../contexts/ThemeContext';
import { useAppLayout } from '../../hooks/useAppLayout';

const MODULES = [
  { id: 'work', label: 'Praca', icon: 'briefcase-outline' },
  { id: 'monitoring', label: 'Monitorowanie', icon: 'server-outline' },
] as const;

type ModuleId = (typeof MODULES)[number]['id'];

const DAYS = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
const MONTHS = [
  'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
  'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia',
];

function getDateString() {
  const now = new Date();
  return `${DAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}`;
}

function getTimeString() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export default function Dashboard() {
  const { logout } = useAuth();
  const router = useRouter();
  const colors = useColors();
  const { titleSize, sectionLabelSize, headerPaddingTop, headerIconSize, isLargePhone } =
    useAppLayout();

  const tileRadius = isLargePhone ? radius.lg : radius.md;

  const [isLoading, setIsLoading] = useState(true);
  const [time, setTime] = useState(getTimeString());
  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 600);
    const clock = setInterval(() => setTime(getTimeString()), 1000);
    return () => {
      clearTimeout(t);
      clearInterval(clock);
    };
  }, []);

  const handleModulePress = (id: ModuleId) => {
    if (id === 'monitoring') {
      router.push('/(app)/monitoring');
      return;
    }
    router.push('/(app)/work');
  };

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/login');
  };

  return (
    <Screen scroll centerContent backgroundColor={colors.background}>
      <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
        <View>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.text, fontSize: titleSize }]}>Kolejarz</Text>
            <View style={[styles.clockPill, { backgroundColor: colors.surface }]}>
              <MaterialCommunityIcons name="clock-outline" size={13} color={colors.accent} />
              <Text style={[styles.clockText, { color: colors.text }]}>{time}</Text>
            </View>
          </View>
          <Text style={[styles.date, { color: colors.textSecondary }]}>{getDateString()}</Text>
        </View>
        <View style={styles.headerRight}>
          <ScreenHeaderIconButton
            backgroundColor={colors.surface}
            onPress={() => router.push('/(app)/settings')}
          >
            <MaterialCommunityIcons name="cog-outline" size={headerIconSize} color={colors.textSecondary} />
          </ScreenHeaderIconButton>
          <ScreenHeaderIconButton backgroundColor={colors.surface} onPress={handleLogout}>
            <MaterialCommunityIcons name="lock-outline" size={headerIconSize} color={colors.textSecondary} />
          </ScreenHeaderIconButton>
        </View>
      </View>

      <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontSize: sectionLabelSize }]}>
        Moduły
      </Text>
      {isLoading ? (
        <View style={styles.moduleStack}>
          <SkeletonLoader width="100%" height={76} borderRadius={tileRadius} />
          <SkeletonLoader width={56} height={56} borderRadius={28} />
        </View>
      ) : (
        <View style={styles.moduleStack}>
          <FadeSlideIn style={{ width: '100%' }}>
            <PressScale
              style={[
                styles.pracaCard,
                Platform.OS === 'ios' && iosContinuousCurve,
                { backgroundColor: colors.surface, borderRadius: tileRadius },
              ]}
              onPress={() => handleModulePress('work')}
            >
              <View style={[styles.pracaIcon, { backgroundColor: colors.accent + '18' }]}>
                <MaterialCommunityIcons name="briefcase-outline" size={24} color={colors.accent} />
              </View>
              <View style={styles.pracaText}>
                <Text style={[styles.pracaLabel, { color: colors.text }]}>Praca</Text>
                <Text style={[styles.pracaDesc, { color: colors.textSecondary }]}>Grafik, pociągi, załoga</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textSecondary} />
            </PressScale>
          </FadeSlideIn>

          <FadeSlideIn delay={65}>
            <PressScale
              accessibilityLabel="Monitorowanie"
              style={[styles.monitorCircle, { backgroundColor: colors.surface }]}
              onPress={() => handleModulePress('monitoring')}
            >
              <MaterialCommunityIcons name="server-outline" size={22} color={colors.textSecondary} />
            </PressScale>
          </FadeSlideIn>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 28,
    width: '100%',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontWeight: '700', letterSpacing: 2 },
  clockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  clockText: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  date: { fontSize: 14, marginTop: 3 },
  sectionLabel: {
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
    width: '100%',
  },
  moduleStack: {
    width: '100%',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  pracaCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  pracaIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pracaText: { flex: 1, gap: 2 },
  pracaLabel: { fontSize: 17, fontWeight: '600' },
  pracaDesc: { fontSize: 13 },
  monitorCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
