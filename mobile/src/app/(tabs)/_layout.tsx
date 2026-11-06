import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, useCompactAndroidLayout } from '@/theme';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const icon = (name: keyof typeof Ionicons.glyphMap, activeName?: keyof typeof Ionicons.glyphMap) => {
  function TabBarIcon({ color, size, focused }: { color: any; size: number; focused: boolean }) {
    return <Ionicons name={focused && activeName ? activeName : name} color={color} size={size}/>;
  }
  return TabBarIcon;
};

export default function TabsLayout() {
  const compactLayout = useCompactAndroidLayout();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const { t } = useTranslation();
  const tabBarHeight = compactLayout ? 60 : 72;
  const tabBarBottomPadding = compactLayout ? 6 : 9;
  return <Tabs screenOptions={{
    headerShown: false,
    tabBarActiveTintColor: colors.brandDark,
    tabBarInactiveTintColor: colors.muted,
    tabBarStyle: {
      height: tabBarHeight + bottomInset,
      paddingTop: compactLayout ? 5 : 8,
      paddingBottom: tabBarBottomPadding + bottomInset,
      borderTopWidth: 1,
      borderTopColor: colors.line,
      backgroundColor: colors.paper,
      shadowColor: colors.shadow,
      shadowOpacity: .08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: -4 },
      elevation: 8
    },
    tabBarItemStyle: { borderRadius: 14, marginHorizontal: 2 },
    tabBarLabelStyle: { fontSize: compactLayout ? 9 : 11, fontWeight: '700' }
  }}>
    <Tabs.Screen name="index" options={{ title: t('tabs.explore'), tabBarIcon: icon('compass-outline', 'compass') }}/>
    <Tabs.Screen name="venues" options={{ title: t('tabs.venues'), tabBarIcon: icon('location-outline', 'location') }}/>
    <Tabs.Screen name="wedding" options={{ title: t('tabs.wedding'), tabBarIcon: icon('heart-outline', 'heart') }}/>
    <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarIcon: icon('person-outline', 'person') }}/>
  </Tabs>;
}
