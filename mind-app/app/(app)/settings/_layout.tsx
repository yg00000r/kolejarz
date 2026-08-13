import { Stack } from 'expo-router';
import { useTheme, useColors } from '../../../contexts/ThemeContext';

export default function SettingsLayout() {
  const { isDark } = useTheme();
  const colors = useColors();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Ustawienia' }} />
      <Stack.Screen name="diagnostics" options={{ title: 'Diagnostyka' }} />
    </Stack>
  );
}
