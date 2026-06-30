import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AnimatedSplash } from '../components/AnimatedSplash';
import { AuthProvider } from '../contexts/AuthContext';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { checkForUpdatesOnLaunch } from '../services/appUpdate';
import { configureNotifications } from '../services/notifications';

SplashScreen.preventAutoHideAsync();

function ThemedApp() {
  const { theme, isDark } = useTheme();
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    SplashScreen.hideAsync();
    void configureNotifications();
  }, []);

  const handleSplashFinish = useCallback(() => {
    setSplashDone(true);
    void checkForUpdatesOnLaunch();
  }, []);

  return (
    <PaperProvider theme={theme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AuthProvider>
        {!splashDone && <AnimatedSplash onFinish={handleSplashFinish} />}
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </PaperProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedApp />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
