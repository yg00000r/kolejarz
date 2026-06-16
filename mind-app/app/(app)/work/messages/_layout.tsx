import { Stack } from 'expo-router';

export default function MessagesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="watch" />
      <Stack.Screen name="classic" />
      <Stack.Screen name="setup-run" />
      <Stack.Screen name="session" />
      <Stack.Screen name="compose" />
      <Stack.Screen name="preview" />
      <Stack.Screen name="queue" />
    </Stack>
  );
}
