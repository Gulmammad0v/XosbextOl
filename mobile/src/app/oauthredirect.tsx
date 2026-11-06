import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/auth';
import { colors } from '@/theme';
import { useTranslation } from 'react-i18next';

export default function OAuthRedirect() {
  const { t } = useTranslation();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      router.replace('/(tabs)');
      return;
    }

    const fallback = setTimeout(() => router.replace('/login'), 10_000);
    return () => clearTimeout(fallback);
  }, [user]);

  return <View style={styles.container}>
    <ActivityIndicator color={colors.brandDark} size="large"/>
    <Text style={styles.title}>{t('socialAuth.completing')}</Text>
    <Text style={styles.description}>{t('socialAuth.wait')}</Text>
  </View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: colors.cream,
  },
  title: { color: colors.ink, fontSize: 18, fontWeight: '700' },
  description: { color: colors.muted, fontSize: 14 },
});
