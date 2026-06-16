import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { FadeSlideIn } from '../../components/FadeSlideIn';
import { PressScale } from '../../components/PressScale';
import { Screen } from '../../components/Screen';
import { ScreenHeaderIconButton } from '../../components/ScreenHeader';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { iosContinuousCurve, radius, touchTargetMin } from '../../constants/layout';
import { Colors } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
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

export default function Dashboard() {
  const { isDark } = useTheme();
  const { logout } = useAuth();
  const router = useRouter();
  const colors = isDark ? Colors.dark : Colors.light;
  const { tileWidth, tileGap, titleSize, sectionLabelSize, headerPaddingTop, headerIconSize, isLargePhone } =
    useAppLayout();

  const tileRadius = isLargePhone ? radius.lg : radius.md;
  const tileHeight = tileWidth * 0.8;

  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(t);
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
          <Text style={[styles.title, { color: colors.text, fontSize: titleSize }]}>Kolejarz</Text>
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
      <View style={[styles.grid, { gap: tileGap }]}>
        {isLoading
          ? Array.from({ length: 2 }).map((_, i) => (
              <SkeletonLoader key={i} width={tileWidth} height={tileHeight} borderRadius={tileRadius} />
            ))
          : MODULES.map((mod, i) => (
              <FadeSlideIn key={mod.id} delay={i * 65} style={{ width: tileWidth }}>
                <PressScale
                  style={[
                    styles.tile,
                    Platform.OS === 'ios' && iosContinuousCurve,
                    {
                      backgroundColor: colors.surface,
                      borderRadius: tileRadius,
                      height: tileHeight,
                    },
                  ]}
                  onPress={() => handleModulePress(mod.id)}
                >
                  <MaterialCommunityIcons name={mod.icon as 'briefcase-outline'} size={isLargePhone ? 30 : 28} color={colors.accent} />
                  <Text style={[styles.tileLabel, { color: colors.text }]}>{mod.label}</Text>
                </PressScale>
              </FadeSlideIn>
            ))}
      </View>
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
  title: { fontWeight: '700', letterSpacing: 2 },
  date: { fontSize: 14, marginTop: 3 },
  sectionLabel: {
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
    width: '100%',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 32,
    width: '100%',
  },
  tile: {
    padding: 16,
    justifyContent: 'space-between',
    minHeight: touchTargetMin * 1.5,
  },
  tileLabel: { fontSize: 15, fontWeight: '500' },
});
