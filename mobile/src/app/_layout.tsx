import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from '@/auth';
import { colors } from '@/theme';
import { NotificationProvider } from '@/notification-state';
import { BiometricEnrollmentPrompt } from '@/biometric-settings';
import { initializeI18n } from '@/i18n';

export default function RootLayout() {
  const [localizationReady, setLocalizationReady] = useState(false);
  useEffect(() => { void initializeI18n().then(() => setLocalizationReady(true)); }, []);
  if (!localizationReady) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream }}><ActivityIndicator size="large" color={colors.brand}/></View>;
  return <AuthProvider><NotificationProvider><AppNavigation/></NotificationProvider><BiometricEnrollmentPrompt/></AuthProvider>;
}

function AppNavigation() {
  const { loading, user } = useAuth();
  const { t } = useTranslation();
  if (loading) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream }}>
      <StatusBar style="dark"/>
      <ActivityIndicator size="large" color={colors.brand}/>
    </View>;
  }

  return <><StatusBar style="dark"/><Stack screenOptions={{ gestureEnabled: true, headerStyle: { backgroundColor: colors.cream }, headerTintColor: colors.brandDark, headerTitleStyle: { color: colors.ink, fontWeight: '700' }, headerShadowVisible: false, contentStyle: { backgroundColor: colors.cream }, headerBackTitle: t('common.back') }}>
    <Stack.Screen name="index" options={{ headerShown: false }}/>
    <Stack.Screen name="language-select" options={{ headerShown: false, gestureEnabled: false }}/>
    <Stack.Protected guard={!user}>
      <Stack.Screen name="login" options={{ headerShown: false }}/>
      <Stack.Screen name="oauthredirect" options={{ headerShown: false }}/>
    </Stack.Protected>
    <Stack.Protected guard={!!user}>
      <Stack.Screen name="account/personal" options={{ headerShown: false }}/>
      <Stack.Screen name="account/change-password" options={{ headerShown: false }}/>
      <Stack.Screen name="account/security" options={{ headerShown: false }}/>
      <Stack.Screen name="account/notification-settings" options={{ headerShown: false }}/>
      <Stack.Screen name="account/notification-permission" options={{ headerShown: false, gestureEnabled: false }}/>
      <Stack.Screen name="account/language" options={{ headerShown: false }}/>
    </Stack.Protected>
    <Stack.Protected guard={user?.role === 'CUSTOMER'}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }}/>
      <Stack.Screen name="favorites" options={{ headerShown: false }}/>
      <Stack.Screen name="notifications" options={{ headerShown: false }}/>
      <Stack.Screen name="bookings" options={{ headerShown: false, gestureEnabled: true, fullScreenGestureEnabled: true, gestureDirection: 'horizontal', animation: 'slide_from_right', animationMatchesGesture: true }}/>
      <Stack.Screen name="venue/[id]" options={{ title: t('venues.venueDetails') }}/>
      <Stack.Screen name="hall/[id]" options={{ title: t('venues.hallDetails') }}/>
      <Stack.Screen name="booking/new" options={{ headerShown: false, gestureEnabled: true, fullScreenGestureEnabled: true }}/>
      <Stack.Screen name="review/[bookingId]" options={{ headerShown: false, gestureEnabled: true, fullScreenGestureEnabled: true }}/>
    </Stack.Protected>
    <Stack.Protected guard={user?.role === 'VENUE_OWNER'}>
      <Stack.Screen name="partner" options={{ headerShown: false }}/>
    </Stack.Protected>
  </Stack></>;
}
