import { useCallback, useState } from 'react';
import { Linking, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api';
import { useAuth } from '@/auth';
import { NotificationBell } from '@/notification-bell';
import type { Booking } from '@/types';
import { Screen, confirm, run } from '@/ui';
import { colors, useCompactAndroidLayout } from '@/theme';
import { loadWeddingTasks, weddingTaskStats } from '@/wedding-tasks';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/format';
import { getAppLanguage } from '@/i18n';

const activeStatuses = ['PENDING_APPROVAL', 'CONFIRMED'];

function parseDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function selectWedding(bookings: Booking[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return bookings
    .filter(item => (!item.eventType || item.eventType === 'WEDDING') && activeStatuses.includes(item.status) && parseDate(item.eventDate) >= today)
    .sort((a, b) => parseDate(a.eventDate).getTime() - parseDate(b.eventDate).getTime())[0];
}

function weddingDays(value: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((parseDate(value).getTime() - today.getTime()) / 86_400_000));
}

function weddingDate(value: string) {
  return formatDate(parseDate(value), getAppLanguage(), { day: 'numeric', month: 'long', year: 'numeric' });
}

function ProfileRow({ icon, label, detail, danger, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail?: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const compactLayout = useCompactAndroidLayout();
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.menuRow, compactLayout && styles.menuRowDense, pressed && { opacity: .55 }]}>
    <View style={[styles.menuIcon, compactLayout && styles.menuIconDense, danger && styles.menuIconDanger]}><Ionicons name={icon} size={compactLayout ? 16 : 18} color={danger ? colors.danger : colors.brandDark}/></View>
    <Text style={[styles.menuLabel, compactLayout && styles.menuLabelDense, danger && { color: colors.danger }]}>{label}</Text>
    {!!detail && <Text style={[styles.menuDetail, compactLayout && styles.menuDetailDense]}>{detail}</Text>}
    <Ionicons name="chevron-forward" size={compactLayout ? 15 : 17} color={colors.muted}/>
  </Pressable>;
}

function MenuGroup({ children }: { children: React.ReactNode }) {
  return <View style={styles.menuGroup}>{children}</View>;
}

export default function ProfileScreen() {
  const compactLayout = useCompactAndroidLayout();
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const [booking, setBooking] = useState<Booking>();
  const [taskProgress, setTaskProgress] = useState({ done: 0, total: 0 });

  const loadProfileData = useCallback(async () => {
    const result = await api.bookings();
    const selected = selectWedding(result.content || []);
    setBooking(selected);
    setTaskProgress(selected ? weddingTaskStats(await loadWeddingTasks(selected)) : { done: 0, total: 0 });
  }, []);

  useFocusEffect(useCallback(() => { void loadProfileData(); }, [loadProfileData]));

  if (!user) return null;

  const initials = (user.fullName || user.email)
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');

  const openMail = (subject: string) => run(() => Linking.openURL(`mailto:support@xosbextol.az?subject=${encodeURIComponent(subject)}`));
  const owner = user.role === 'VENUE_OWNER';

  return <Screen androidDensity="custom">
    <View style={[styles.identity, compactLayout && styles.identityDense]}>
      <View style={[styles.avatar, compactLayout && styles.avatarDense]}><Text style={[styles.avatarText, compactLayout && styles.avatarTextDense]}>{initials}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel={t('profile.editAccessibility')} onPress={() => router.push('/account/personal' as any)} style={({ pressed }) => [styles.avatarEdit, compactLayout && styles.avatarEditDense, pressed && { opacity: .6 }]}>
        <Ionicons name="pencil" size={13} color="#fff"/>
      </Pressable>
      <View style={styles.identityText}>
        <Text numberOfLines={1} style={[styles.name, compactLayout && styles.nameDense]}>{user.fullName || t('profile.noName')}</Text>
        <Text numberOfLines={1} style={[styles.email, compactLayout && styles.emailDense]}>{user.email}</Text>
        <Text style={[styles.role, compactLayout && styles.roleDense]}>{owner ? t('profile.owner') : t('profile.user')}</Text>
      </View>
      <NotificationBell/>
    </View>

    {!owner && <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/wedding' as any)} style={({ pressed }) => [styles.weddingCard, compactLayout && styles.weddingCardDense, pressed && { opacity: .88 }]}> 
      <Text style={[styles.weddingLabel, compactLayout && styles.weddingLabelDense]}>{t('profile.myWedding')}</Text>
      {booking ? <>
        <Text style={[styles.weddingCountdown, compactLayout && styles.weddingCountdownDense]}>{t('home.daysRemaining', { count: weddingDays(booking.eventDate) })} · {weddingDate(booking.eventDate)}</Text>
        <Text numberOfLines={1} style={[styles.weddingPlace, compactLayout && styles.weddingPlaceDense]}>{[booking.venueName, booking.hallName].filter(Boolean).join(' · ')}</Text>
        <View style={[styles.weddingProgress, compactLayout && styles.weddingProgressDense]}><View style={[styles.weddingProgressFill, { width: `${taskProgress.total ? taskProgress.done / taskProgress.total * 100 : 0}%` }]}/></View>
        <Text style={[styles.weddingProgressText, compactLayout && styles.weddingProgressTextDense]}>{t('profile.tasks', { done: taskProgress.done, total: taskProgress.total })}</Text>
      </> : <>
        <Text style={styles.noWeddingTitle}>{t('profile.createPlan')}</Text>
        <Text style={styles.weddingPlace}>{t('profile.createPlanDescription')}</Text>
      </>}
    </Pressable>}

    <Text style={[styles.groupTitle, compactLayout && styles.groupTitleDense]}>{t('profile.account')}</Text>
    <MenuGroup>
      <ProfileRow icon="person-outline" label={t('profile.personal')} onPress={() => router.push('/account/personal' as any)}/>
      {!owner && <ProfileRow icon="heart-outline" label={t('profile.favorites')} onPress={() => router.push('/favorites' as any)}/>} 
      {!owner && <ProfileRow icon="calendar-outline" label={t('profile.bookings')} onPress={() => router.push('/bookings' as any)}/>} 
      {!owner && <ProfileRow icon="card-outline" label={t('profile.payments')} onPress={() => router.push('/bookings' as any)}/>} 
    </MenuGroup>

    <Text style={[styles.groupTitle, compactLayout && styles.groupTitleDense]}>{t('profile.settings')}</Text>
    <MenuGroup>
      <ProfileRow icon="globe-outline" label={t('profile.language')} detail={user.language === 'az' ? 'Azərbaycan' : user.language === 'ru' ? 'Русский' : 'English'} onPress={() => router.push('/account/language' as any)}/>
      <ProfileRow icon="notifications-outline" label={t('profile.notifications')} onPress={() => router.push('/account/notification-settings' as any)}/>
      <ProfileRow icon="shield-outline" label={t('profile.security')} onPress={() => router.push('/account/security' as any)}/>
    </MenuGroup>

    <Text style={[styles.groupTitle, compactLayout && styles.groupTitleDense]}>{t('profile.support')}</Text>
    <MenuGroup>
      <ProfileRow icon="help-circle-outline" label={t('profile.help')} onPress={() => openMail(t('profile.help'))}/>
      <ProfileRow icon="people-outline" label={t('profile.invite')} onPress={() => Share.share({ message: t('profile.shareMessage') })}/>
    </MenuGroup>

    {owner && <MenuGroup>
      <ProfileRow icon="business-outline" label={t('profile.ownerPanel')} onPress={() => router.push('/partner' as any)}/>
    </MenuGroup>}

    <Pressable accessibilityRole="button" onPress={() => confirm(t('profile.signOut'), t('profile.signOutMessage'), signOut)} style={styles.logoutButton}>
      <Text style={styles.logoutText}>{t('profile.signOut')}</Text>
    </Pressable>
    <Text style={styles.version}>{t('profile.version', { version: '1.0.0' })}</Text>
    <Pressable accessibilityRole="button" onPress={() => confirm(t('profile.deleteAccount'), t('profile.deleteMessage'), () => openMail(t('profile.deleteAccount')))} style={styles.deleteButton}>
      <Text style={styles.deleteText}>{t('profile.deleteAccount')}</Text>
    </Pressable>

  </Screen>;
}

const styles = StyleSheet.create({
  identity: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 2, paddingVertical: 2 },
  identityDense: { minHeight: 56, gap: 8 },
  avatar: { width: 62, height: 62, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFE2BF', borderWidth: 1.5, borderColor: colors.gold },
  avatarDense: { width: 52, height: 52, borderRadius: 27 },
  avatarText: { color: colors.ink, fontSize: 21, fontWeight: '700', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  avatarTextDense: { fontSize: 18 },
  avatarEdit: { position: 'absolute', left: 45, bottom: 1, width: 23, height: 23, borderRadius: 12, backgroundColor: colors.brandDark, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  avatarEditDense: { left: 38, width: 20, height: 20, borderRadius: 10 },
  identityText: { flex: 1, minWidth: 0 },
  name: { color: colors.ink, fontSize: 18, fontWeight: '700', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  nameDense: { fontSize: 15 },
  email: { color: colors.muted, fontSize: 12, marginTop: 2 },
  emailDense: { fontSize: 10, marginTop: 1 },
  role: { alignSelf: 'flex-start', color: colors.brandDark, backgroundColor: colors.softGold, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4, fontSize: 10, marginTop: 5 },
  roleDense: { paddingHorizontal: 8, paddingVertical: 3, fontSize: 9, marginTop: 3 },
  weddingCard: { minHeight: 143, borderRadius: 18, backgroundColor: '#2E2C29', padding: 16 },
  weddingCardDense: { minHeight: 119, borderRadius: 16, padding: 13 },
  weddingLabel: { color: '#EED69A', fontSize: 11, fontWeight: '700', letterSpacing: .4 },
  weddingLabelDense: { fontSize: 9 },
  weddingCountdown: { color: colors.paper, fontSize: 13, marginTop: 8 },
  weddingCountdownDense: { fontSize: 11, marginTop: 6 },
  weddingNumber: { color: '#E7C778', fontSize: 34, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  weddingNumberDense: { fontSize: 28 },
  weddingPlace: { color: '#F0E8D8', fontSize: 11, marginTop: 2 },
  weddingPlaceDense: { fontSize: 9 },
  noWeddingTitle: { color: '#E7C778', fontSize: 23, marginTop: 14, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  weddingProgress: { height: 6, overflow: 'hidden', borderRadius: 4, backgroundColor: '#4D4A45', marginTop: 13 },
  weddingProgressDense: { height: 5, marginTop: 10 },
  weddingProgressFill: { height: '100%', borderRadius: 4, backgroundColor: '#D7B96E' },
  weddingProgressText: { color: '#F0E8D8', fontSize: 10, marginTop: 6 },
  weddingProgressTextDense: { fontSize: 9, marginTop: 4 },
  groupTitle: { color: colors.muted, fontSize: 9, fontWeight: '600', letterSpacing: .7, marginLeft: 4, marginBottom: -7 },
  groupTitleDense: { fontSize: 8, marginBottom: -5 },
  menuGroup: { overflow: 'hidden', borderRadius: 17, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  menuRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  menuRowDense: { minHeight: 42, gap: 8, paddingHorizontal: 10 },
  menuIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.softGold, alignItems: 'center', justifyContent: 'center' },
  menuIconDense: { width: 29, height: 29, borderRadius: 9 },
  menuIconDanger: { backgroundColor: '#F8ECEA' },
  menuLabel: { flex: 1, color: colors.ink, fontSize: 13 },
  menuLabelDense: { fontSize: 11 },
  menuDetail: { color: colors.muted, fontSize: 10 },
  menuDetailDense: { fontSize: 9 },
  logoutButton: { height: 44, borderRadius: 23, borderWidth: 1, borderColor: colors.goldLight, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  logoutText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  version: { color: colors.muted, fontSize: 9, textAlign: 'center', marginBottom: -6 },
  deleteButton: { alignItems: 'center', justifyContent: 'center', paddingBottom: 2 },
  deleteText: { color: colors.muted, fontSize: 11 }
});
