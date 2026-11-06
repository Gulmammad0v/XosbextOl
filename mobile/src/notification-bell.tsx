import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from './auth';
import { useNotificationState } from './notification-state';
import { colors, useCompactAndroidLayout } from './theme';
import { useTranslation } from 'react-i18next';

export function NotificationBell() {
  const { t } = useTranslation();
  const compactLayout = useCompactAndroidLayout();
  const { user } = useAuth();
  const { unreadCount, refreshUnread } = useNotificationState();
  useFocusEffect(useCallback(() => { refreshUnread(); }, [refreshUnread]));
  const notificationsRoute = user?.role === 'VENUE_OWNER' ? '/partner/notifications' : '/notifications';
  return <Pressable accessibilityRole="button" accessibilityLabel={t('notifications.title')} onPress={() => router.push(notificationsRoute as any)} style={({ pressed }) => [styles.button, compactLayout && styles.buttonDense, pressed && { opacity: .6 }]}> 
    <Ionicons name="notifications" size={compactLayout ? 19 : 22} color={colors.brandDark}/>
    {unreadCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>}
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { width: 42, height: 42, marginRight: 5, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softGold, borderWidth: 1, borderColor: colors.goldLight, overflow: 'visible' },
  buttonDense: { width: 36, height: 36, marginRight: 3, borderRadius: 18 },
  badge: { position: 'absolute', top: 1, right: 1, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.danger },
  badgeText: { color: 'white', fontSize: 10, fontWeight: '900' },
});
