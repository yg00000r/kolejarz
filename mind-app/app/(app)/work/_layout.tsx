import { Stack } from 'expo-router';
import { useTheme } from '../../../contexts/ThemeContext';

export default function WorkLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="schedule" />
      <Stack.Screen name="duty-details" />
      <Stack.Screen name="portal-messages" />
      <Stack.Screen name="accounts" />
      <Stack.Screen name="timecard" />
      <Stack.Screen name="messages" />
      <Stack.Screen name="trains" />
      <Stack.Screen name="routes" />
      <Stack.Screen name="station" />
      <Stack.Screen name="abc" />
      <Stack.Screen name="dodatki" />
    </Stack>
  );
}
