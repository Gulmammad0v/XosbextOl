import { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { api } from './api';
import { BiometricSettings } from './biometric-settings';
import { Button, Empty, Screen, confirm, run } from './ui';
import { colors } from './theme';
import type { UserDevice, UserDeviceList } from './types';
import { appLocale } from './format';
import { getAppLanguage } from './i18n';

const emptyList: UserDeviceList = { devices: [], activeCount: 0, limit: 2 };

function localActivity(value: string, today: (time: string) => string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  const locale = appLocale(getAppLanguage());
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date);
  if (sameDay) return today(time);
  const day = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(date);
  return `${day.charAt(0).toUpperCase()}${day.slice(1)}, ${time}`;
}

function deviceTitle(device: UserDevice) {
  const system = device.platform === 'IOS' ? 'iOS' : 'Android';
  return [device.deviceName, device.osVersion ? `${system} ${device.osVersion}` : system].filter(Boolean).join(' · ');
}

export function DeviceManagementScreen() {
  const { t } = useTranslation();
  const [data, setData] = useState<UserDeviceList>(emptyList);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => setData(await api.devices()), []);
  useFocusEffect(useCallback(() => {
    let active = true;
    api.devices().then(value => { if (active) setData(value); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));

  const remove = (device: UserDevice) => confirm(t('devices.remove'), t('devices.removeMessage', { device: device.deviceName }), () => {
    void run(async () => { await api.removeDevice(device.id); await load(); }, t('devices.removed'));
  });
  const removeOthers = () => confirm(t('devices.removeOthers'), t('devices.removeOthersMessage'), () => {
    void run(async () => { await api.removeOtherDevices(); await load(); }, t('devices.othersRemoved'));
  });
  const hasOther = data.devices.some(device => !device.current);

  return <Screen title={t('devices.title')} subtitle={t('profile.security')} loading={loading} back footer={hasOther ? <Button title={t('devices.removeOthers')} variant="secondary" onPress={removeOthers}/> : undefined}>
    <BiometricSettings/>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{t('devices.myDevices')}</Text>
      <View style={styles.capacity}>{Array.from({ length: data.limit }, (_, index) => <View key={index} style={[styles.capacityBar, index < data.activeCount && styles.capacityBarActive]}/>)}<Text style={styles.capacityText}>{data.activeCount} / {data.limit}</Text></View>
    </View>
    {!data.devices.length ? <Empty text={t('devices.empty')}/> : data.devices.map(device => <View key={device.id} style={[styles.deviceCard, device.current && styles.currentCard]}>
      <View style={styles.deviceTop}>
        <View style={styles.deviceIcon}><Ionicons name="phone-portrait-outline" size={18} color={colors.brandDark}/></View>
        <View style={styles.deviceCopy}>
          <View style={styles.deviceTitleRow}><Text numberOfLines={1} style={styles.deviceName}>{deviceTitle(device)}</Text>{device.current && <View style={styles.currentBadge}><Text style={styles.currentBadgeText}>{t('devices.thisDevice')}</Text></View>}</View>
          <Text style={styles.activity}>{device.current ? t('devices.currentlyActive') : t('devices.lastActive', { time: localActivity(device.lastActiveAt, time => t('devices.todayTime', { time })) })}{device.lastCity ? ` · ${device.lastCity}` : ''}</Text>
          <View style={styles.notificationRow}><Ionicons name="notifications-outline" size={12} color={colors.brandDark}/><Text style={styles.notificationText}>{t(device.notificationsEnabled ? 'devices.notificationsEnabled' : 'devices.notificationsDisabled')}</Text></View>
        </View>
      </View>
      {!device.current && <Pressable accessibilityRole="button" onPress={() => remove(device)} style={({ pressed }) => [styles.exitButton, pressed && { opacity: .6 }]}><Text style={styles.exitText}>{t('devices.remove')}</Text></Pressable>}
    </View>)}
    <View style={styles.note}><Ionicons name="information-circle-outline" size={15} color={colors.brandDark}/><Text style={styles.noteText}>{t('devices.limit', { count: data.limit })}</Text></View>
    <View style={styles.passwordRow}><Text style={styles.passwordHint}>{t('devices.unknownHint')}</Text><Pressable accessibilityRole="link" onPress={() => router.push('/account/change-password' as never)}><Text style={styles.passwordLink}>{t('account.password.change')} ›</Text></Pressable></View>
  </Screen>;
}

const serif = Platform.select({ ios: 'Georgia', android: 'serif' });
const styles = StyleSheet.create({
  sectionHeader: { marginTop: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '700', fontFamily: serif },
  capacity: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  capacityBar: { width: 16, height: 5, borderRadius: 3, backgroundColor: colors.line },
  capacityBarActive: { backgroundColor: colors.gold },
  capacityText: { color: colors.brandDark, fontSize: 10, fontWeight: '700', marginLeft: 3 },
  deviceCard: { padding: 12, borderRadius: 17, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, gap: 10 },
  currentCard: { borderColor: colors.goldLight, backgroundColor: '#FFFCF5' },
  deviceTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  deviceIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: colors.softGold, alignItems: 'center', justifyContent: 'center' },
  deviceCopy: { flex: 1, minWidth: 0 },
  deviceTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  deviceName: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: '700' },
  currentBadge: { backgroundColor: '#EEF2E4', borderRadius: 13, paddingHorizontal: 8, paddingVertical: 4 },
  currentBadgeText: { color: '#60713E', fontSize: 9, fontWeight: '700' },
  activity: { color: colors.muted, fontSize: 10, marginTop: 3 },
  notificationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  notificationText: { color: colors.muted, fontSize: 10 },
  exitButton: { height: 38, borderRadius: 20, borderWidth: 1, borderColor: colors.goldLight, alignItems: 'center', justifyContent: 'center' },
  exitText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 13, backgroundColor: colors.softGold },
  noteText: { flex: 1, color: colors.ink, fontSize: 10, lineHeight: 15 },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  passwordHint: { flex: 1, color: colors.muted, fontSize: 10 },
  passwordLink: { color: colors.brandDark, fontSize: 10, fontWeight: '700' },
});
