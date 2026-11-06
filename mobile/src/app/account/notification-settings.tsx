import { useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Device from 'expo-device';
import { useTranslation } from 'react-i18next';
import { api } from '@/api';
import { useAuth } from '@/auth';
import { useNotificationState } from '@/notification-state';
import { colors } from '@/theme';
import type { NotificationPreferenceKey, NotificationPreferences } from '@/types';
import { Button, Screen } from '@/ui';

type PreferenceRow = { key: NotificationPreferenceKey; title: string; detail: string };

export default function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { permissionStatus, refreshPushPermission } = useNotificationState();
  const [preferences, setPreferences] = useState<NotificationPreferences>();
  const [saving, setSaving] = useState<NotificationPreferenceKey>();
  const owner = user?.role === 'VENUE_OWNER';
  const active = permissionStatus === 'granted';

  useEffect(() => {
    void Promise.all([api.notificationPreferences(), refreshPushPermission()])
      .then(([value]) => setPreferences(value))
      .catch(error => Alert.alert(t('common.error'), error instanceof Error ? error.message : String(error)));
  }, [refreshPushPermission, t]);

  const mandatory = owner ? [
    { title: t('notificationSettings.ownerMandatoryBooking'), detail: t('notificationSettings.ownerMandatoryBookingDetail') },
    { title: t('notificationSettings.ownerMandatoryStatus'), detail: t('notificationSettings.ownerMandatoryStatusDetail') },
  ] : [
    { title: t('notificationSettings.customerMandatory'), detail: t('notificationSettings.customerMandatoryDetail') },
  ];
  const optional: PreferenceRow[] = owner ? [
    { key: 'RESPONSE_REMINDER', title: t('notificationSettings.responseReminder'), detail: t('notificationSettings.responseReminderDetail') },
    { key: 'REMINDER', title: t('notificationSettings.eventReminder'), detail: t('notificationSettings.eventReminderDetail') },
    { key: 'REVIEW', title: t('notificationSettings.newReviews'), detail: t('notificationSettings.newReviewsDetail') },
    { key: 'PROMO', title: t('notificationSettings.news'), detail: t('notificationSettings.platformNews') },
  ] : [
    { key: 'REMINDER', title: t('notificationSettings.weddingReminders'), detail: t('notificationSettings.weddingRemindersDetail') },
    { key: 'REVIEW', title: t('notificationSettings.reviewReminder'), detail: t('notificationSettings.reviewReminderDetail') },
    { key: 'PROMO', title: t('notificationSettings.newsAndOffers'), detail: t('notificationSettings.newsAndOffersDetail') },
  ];

  const toggle = async (key: NotificationPreferenceKey, enabled: boolean) => {
    if (!preferences || saving) return;
    const previous = preferences;
    setPreferences({ ...previous, [key]: enabled });
    setSaving(key);
    try {
      setPreferences(await api.updateNotificationPreference(key, enabled));
    } catch (error) {
      setPreferences(previous);
      Alert.alert(t('common.error'), error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(undefined);
    }
  };

  return <Screen title={t('notificationSettings.title')} subtitle={owner ? t('notificationSettings.ownerAccount') : t('notificationSettings.account')} loading={!preferences} back>
    {active ? <View style={styles.statusCard}>
      <View style={styles.statusIcon}><Ionicons name="notifications-outline" size={19} color={colors.brandDark}/></View>
      <View style={styles.rowCopy}><Text style={styles.rowTitle}>{t('notificationSettings.enabled')}</Text><Text style={styles.rowDetail}>{Device.modelName || t('notificationSettings.thisDevice')}</Text></View>
      <View style={styles.activeBadge}><Text style={styles.activeText}>{t('notificationSettings.active')}</Text></View>
    </View> : <View style={styles.warningCard}>
      <View style={styles.warningTop}>
        <View style={styles.warningIcon}><Ionicons name="warning-outline" size={18} color={colors.danger}/></View>
        <View style={styles.rowCopy}><Text style={styles.rowTitle}>{t('notificationSettings.disabled')}</Text><Text style={styles.rowDetail}>{t('notificationSettings.disabledDetail')}</Text></View>
      </View>
      <Button title={t('notificationSettings.openDeviceSettings')} onPress={() => void Linking.openSettings()}/>
    </View>}

    <SectionLabel text={t('notificationSettings.mandatory')}/>
    <View style={styles.group}>
      {mandatory.map((item, index) => <View key={item.title} style={[styles.settingRow, index < mandatory.length - 1 && styles.rowBorder]}>
        <View style={styles.rowCopy}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.rowDetail}>{item.detail}</Text></View>
        <View style={styles.alwaysBadge}><Text style={styles.alwaysText}>{t('notificationSettings.alwaysActive')}</Text></View>
      </View>)}
    </View>

    <SectionLabel text={t('notificationSettings.optional')}/>
    <View style={styles.group}>
      {optional.map((item, index) => <View key={item.key} style={[styles.settingRow, index < optional.length - 1 && styles.rowBorder]}>
        <View style={styles.rowCopy}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.rowDetail}>{item.detail}</Text></View>
        <Switch accessibilityLabel={item.title} value={preferences?.[item.key] ?? item.key !== 'PROMO'} disabled={saving === item.key} onValueChange={value => void toggle(item.key, value)} trackColor={{ false: '#D9CFB9', true: colors.brand }} thumbColor="#fff" ios_backgroundColor="#D9CFB9"/>
      </View>)}
    </View>

    <Text style={styles.autoSave}>{t('notificationSettings.autoSave')}</Text>
  </Screen>;
}

function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.sectionLabel}>{text}</Text>;
}

const styles = StyleSheet.create({
  statusCard: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 17, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  statusIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softGold },
  warningCard: { gap: 10, padding: 12, borderRadius: 17, backgroundColor: colors.paper, borderWidth: 1, borderColor: '#C9827D' },
  warningTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  warningIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8ECEA' },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { color: colors.ink, fontSize: 12, lineHeight: 17, fontWeight: '800' },
  rowDetail: { color: colors.muted, fontSize: 9, lineHeight: 13, marginTop: 2 },
  activeBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 13, backgroundColor: '#EEF1E6' },
  activeText: { color: colors.success, fontSize: 9, fontWeight: '800' },
  sectionLabel: { color: colors.muted, fontSize: 9, fontWeight: '700', letterSpacing: .6, marginLeft: 4, marginTop: 4, marginBottom: -7 },
  group: { overflow: 'hidden', borderRadius: 17, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  settingRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 9 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  alwaysBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 13, backgroundColor: '#EEF1E6' },
  alwaysText: { color: colors.success, fontSize: 8, fontWeight: '800' },
  autoSave: { color: colors.muted, fontSize: 9, textAlign: 'center', marginTop: 3 },
});
