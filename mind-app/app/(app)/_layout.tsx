import * as Notifications from 'expo-notifications';
import { Redirect, Stack, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

function TimecardNotificationDeepLink() {
  const router = useRouter();
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      if (data?.type === 'timecard') {
        router.push('/(app)/work/timecard' as never);
      }
    });
    return () => sub.remove();
  }, [router]);
  return null;
}

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const { colors } = useTheme();

  // Czekamy na załadowanie stanu auth żeby uniknąć flash redirect
  if (isLoading) return null;

  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  return (
    <>
      <TimecardNotificationDeepLink />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 260,
          gestureEnabled: true,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </>
  );
}
