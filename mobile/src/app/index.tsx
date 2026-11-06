import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/auth';
import { colors } from '@/theme';
import { hasLanguageChoice } from '@/i18n';

export default function Index() {
  const { loading, user } = useAuth();
  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream }}><ActivityIndicator size="large" color={colors.brand}/></View>;
  if (!hasLanguageChoice()) return <Redirect href={'/language-select' as any}/>;
  if (!user) return <Redirect href="/login"/>;
  if (user.role === 'VENUE_OWNER') return <Redirect href="/partner"/>;
  return <Redirect href="/(tabs)"/>;
}
