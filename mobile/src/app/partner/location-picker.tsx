import { lazy, Suspense } from 'react';
import { ActivityIndicator, StyleSheet, Text, TurboModuleRegistry, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/ui';
import { colors } from '@/theme';
import { saveSelectedLocation } from '@/location-selection';
import { useTranslation } from 'react-i18next';

const NativeLocationPicker = lazy(() => import('@/native-location-picker'));

export default function LocationPicker() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ latitude?: string; longitude?: string }>();
  const initialCoordinate = {
    latitude: Number(params.latitude) || 40.4093,
    longitude: Number(params.longitude) || 49.8671
  };
  const hasNativeMap = TurboModuleRegistry.get('MLRNMapViewModule') != null;

  if (!hasNativeMap) return <SafeAreaView style={styles.safe}>
    <View style={styles.fallback}>
      <Text style={styles.title}>{t('locationPicker.buildRequired')}</Text>
      <Text style={styles.text}>{t('locationPicker.buildRequiredInfo')}</Text>
      <Text style={styles.coordinate}>{initialCoordinate.latitude.toFixed(6)}, {initialCoordinate.longitude.toFixed(6)}</Text>
      <Button title={t('common.back')} variant="secondary" onPress={() => router.back()}/>
    </View>
  </SafeAreaView>;

  return <Suspense fallback={<SafeAreaView style={styles.safe}><View style={styles.loading}><ActivityIndicator size="large" color={colors.brand}/><Text style={styles.text}>{t('locationPicker.preparing')}</Text></View></SafeAreaView>}>
    <NativeLocationPicker initialCoordinate={initialCoordinate} onCancel={() => router.back()} onConfirm={location => { saveSelectedLocation(location); router.back(); }}/>
  </Suspense>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  fallback: { flex: 1, margin: 22, padding: 24, borderRadius: 24, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, justifyContent: 'center', gap: 18 },
  title: { color: colors.ink, fontSize: 25, fontWeight: '800', textAlign: 'center' },
  text: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  coordinate: { color: colors.brandDark, fontSize: 18, fontWeight: '800', textAlign: 'center' }
});
