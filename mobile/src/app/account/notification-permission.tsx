import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth';
import { useNotificationState } from '@/notification-state';
import { colors } from '@/theme';
import { AndroidScaledContent } from '@/ui';

type Benefit = { icon: keyof typeof Ionicons.glyphMap; text: string };

export default function NotificationPermissionScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { next, source } = useLocalSearchParams<{ next?: string; source?: string }>();
  const { canAskPermission, enablePushNotifications } = useNotificationState();
  const [busy, setBusy] = useState(false);
  const owner = user?.role === 'VENUE_OWNER';
  const benefits: Benefit[] = owner ? [
    { icon: 'receipt-outline', text: t('notificationPermission.ownerBenefitBooking') },
    { icon: 'time-outline', text: t('notificationPermission.ownerBenefitDeadline') },
    { icon: 'star-outline', text: t('notificationPermission.ownerBenefitReviews') },
  ] : [
    { icon: 'checkmark-circle-outline', text: t('notificationPermission.customerBenefitReply') },
    { icon: 'card-outline', text: t('notificationPermission.customerBenefitPayment') },
    { icon: 'time-outline', text: t('notificationPermission.customerBenefitReminder') },
  ];

  const destination = typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')
    ? next
    : owner ? '/partner' : '/bookings';
  const finish = () => router.replace(destination as never);
  const enable = async () => {
    if (busy) return;
    if (!canAskPermission) {
      await Linking.openSettings();
      return;
    }
    setBusy(true);
    try {
      await enablePushNotifications();
      finish();
    } finally {
      setBusy(false);
    }
  };

  return <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
    <AndroidScaledContent fill style={styles.content}>
      <View style={styles.hero}>
        <View style={styles.bellCircle}><Ionicons name="notifications-outline" size={48} color={colors.brandDark}/></View>
        <View style={styles.preview}>
          <View style={styles.appIcon}><Ionicons name="home-outline" size={18} color="#E7C778"/></View>
          <View style={styles.previewText}>
            <Text numberOfLines={1} style={styles.previewTitle}>{t(owner ? 'notificationPermission.ownerPreviewTitle' : 'notificationPermission.customerPreviewTitle')}</Text>
            <Text numberOfLines={1} style={styles.previewBody}>{t(owner ? 'notificationPermission.ownerPreviewBody' : 'notificationPermission.customerPreviewBody')}</Text>
          </View>
          <Text style={styles.now}>{t('notificationPermission.now')}</Text>
        </View>
      </View>

      <View style={styles.copy}>
        <Text style={styles.title}>{t(owner ? 'notificationPermission.ownerTitle' : 'notificationPermission.customerTitle')}</Text>
        <Text style={styles.subtitle}>{t(owner ? 'notificationPermission.ownerSubtitle' : source === 'booking' ? 'notificationPermission.bookingSubtitle' : 'notificationPermission.customerSubtitle')}</Text>
      </View>

      <View style={styles.benefits}>
        {benefits.map(item => <View key={item.text} style={styles.benefitRow}>
          <View style={styles.benefitIcon}><Ionicons name={item.icon} size={18} color={colors.brandDark}/></View>
          <Text style={styles.benefitText}>{item.text}</Text>
        </View>)}
      </View>

      <View style={styles.spacer}/>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void enable()} style={({ pressed }) => [styles.primary, (pressed || busy) && styles.pressed]}>
        <Text style={styles.primaryText}>{busy ? t('notificationPermission.enabling') : canAskPermission ? t('notificationPermission.enable') : t('notificationSettings.openDeviceSettings')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={finish} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
        <Text style={styles.secondaryText}>{t('notificationPermission.notNow')}</Text>
      </Pressable>
      <Text style={styles.note}>{t(owner ? 'notificationPermission.ownerNote' : 'notificationPermission.customerNote')}</Text>
    </AndroidScaledContent>
  </SafeAreaView>;
}

const serif = Platform.select({ ios: 'Georgia', android: 'serif' });
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  content: { flex: 1, paddingHorizontal: 14, paddingTop: 30, paddingBottom: 8 },
  hero: { height: 178, alignItems: 'center', justifyContent: 'flex-start' },
  bellCircle: { width: 136, height: 136, borderRadius: 68, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8D6A8' },
  preview: { position: 'absolute', left: 10, right: 10, bottom: 2, minHeight: 54, paddingHorizontal: 11, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 16, backgroundColor: colors.paper, shadowColor: colors.shadow, shadowOpacity: .12, shadowRadius: 15, shadowOffset: { width: 0, height: 7 }, elevation: 6 },
  appIcon: { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  previewText: { flex: 1, minWidth: 0 },
  previewTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  previewBody: { color: colors.muted, fontSize: 10, marginTop: 2 },
  now: { alignSelf: 'flex-start', color: colors.muted, fontSize: 9, marginTop: 3 },
  copy: { alignItems: 'center', gap: 7, marginTop: 17, paddingHorizontal: 7 },
  title: { color: colors.ink, fontSize: 25, lineHeight: 31, fontFamily: serif, fontWeight: '700', textAlign: 'center' },
  subtitle: { maxWidth: 310, color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  benefits: { gap: 9, marginTop: 17, paddingHorizontal: 3 },
  benefitRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 11 },
  benefitIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softGold },
  benefitText: { flex: 1, color: colors.ink, fontSize: 12, lineHeight: 17 },
  spacer: { flex: 1, minHeight: 12 },
  primary: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: colors.ink },
  primaryText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  secondary: { minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.ink, fontSize: 12 },
  note: { minHeight: 28, color: colors.muted, fontSize: 9, lineHeight: 13, textAlign: 'center', paddingHorizontal: 6 },
  pressed: { opacity: .6 },
});
