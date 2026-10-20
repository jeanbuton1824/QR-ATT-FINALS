import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';

function useProtectedRoute() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const path = segments?.[0];
    const inAuthGroup = path === 'login' || path === 'register';
    const inTabsGroup = path === '(tabs)';
    const inWelcome = path === undefined || path === 'index';

    if (!session && inTabsGroup) {
      router.replace('/');
    } else if (session && (inAuthGroup || inWelcome)) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments, router]);
}

export default function RootLayout() {
  const { loading } = useAuth();
  useProtectedRoute();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade_from_bottom',
        navigationBarTranslucent: true,
        navigationBarColor: 'transparent',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
});