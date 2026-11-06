import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/auth';
import { Screen, confirm } from '@/ui';
import { colors } from '@/theme';
import { usePartnerVenue } from '@/partner-context';
import { NotificationBell } from '@/notification-bell';
import { useTranslation } from 'react-i18next';

export default function PartnerProfile() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const partner = usePartnerVenue();
  if (!user) return null;
  const initials = (user.fullName || user.email).split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('');
  const openCompany = async () => { const selection = await partner.resolve(); router.push({ pathname: '/partner/onboarding', params: { venueId: selection.venueId, section: 3 } } as any); };
  const openReport = async () => { const selection = await partner.resolve(); if (selection.venueId) router.push({ pathname: '/partner/report', params: { venueId: selection.venueId, name: selection.venueName } } as any); };
  const openReviews = async () => { const selection = await partner.resolve(); if (selection.venueId) router.push({ pathname: '/partner/reviews', params: { venueId: selection.venueId, name: selection.venueName } } as any); };
  const openPersonalDetails = () => router.push('/account/personal' as any);
  return <Screen partnerNav>
    <View style={styles.identity}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel={t('partnerProfile.editPersonal')} onPress={openPersonalDetails} style={styles.avatarEdit}>
        <Ionicons name="pencil" size={13} color="#fff"/>
      </Pressable>
      <View style={styles.identityText}>
        <Text style={styles.name}>{user.fullName || t('partnerProfile.venueOwner')}</Text>
        <Text style={styles.email}>{user.email}</Text>
        <Text style={styles.role}>{t('partnerProfile.venueOwner')}</Text>
      </View>
      <NotificationBell/>
    </View>
    <Group title={t('partnerProfile.accountSection')}><Row icon="person-outline" label={t('partnerProfile.personalDetails')} onPress={openPersonalDetails}/><Row icon="bar-chart-outline" label={t('partnerProfile.report')} onPress={() => void openReport()}/><Row icon="star-outline" label={t('partnerProfile.reviews')} onPress={() => void openReviews()}/><Row icon="briefcase-outline" label={t('partnerProfile.companyDetails')} detail={t('partnerProfile.verified')} onPress={() => void openCompany()}/><Row icon="globe-outline" label={t('language.title')} detail={user.language === 'az' ? 'Azərbaycan' : user.language === 'ru' ? 'Русский' : 'English'} onPress={() => router.push('/account/language' as any)}/></Group>
    <Group title={t('partnerProfile.settingsSection')}><Row icon="notifications-outline" label={t('partnerProfile.notificationSettings')} onPress={() => router.push('/account/notification-settings' as any)}/><Row icon="phone-portrait-outline" label={t('partnerProfile.loginAndDevices')} detail={t('partnerProfile.view')} onPress={() => router.push('/partner/devices' as any)}/></Group>
    <Group title={t('partnerProfile.supportSection')}><Row icon="help-circle-outline" label={t('partnerProfile.help')}/><Row icon="share-social-outline" label={t('partnerProfile.share')} onPress={() => Share.share({ message: t('partnerProfile.shareMessage') })}/></Group>
    <Pressable onPress={() => confirm(t('partnerProfile.signOut'), t('partnerProfile.signOutMessage'), () => void signOut())} style={styles.logout}><Text style={styles.logoutText}>{t('partnerProfile.signOut')}</Text></Pressable><Text style={styles.version}>{t('partnerProfile.version', { version: '1.0.0' })}</Text>
  </Screen>;
}
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.groupBlock}>
    <Text style={styles.groupTitle}>{title}</Text>
    <View style={styles.menuGroup}>{children}</View>
  </View>;
}

function Row({ icon, label, detail, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; detail?: string; onPress?: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.menuRow, pressed && onPress ? styles.menuRowPressed : null]}>
    <View style={styles.menuIcon}><Ionicons name={icon} size={18} color={colors.brandDark}/></View>
    <Text style={styles.menuLabel}>{label}</Text>
    {detail && <Text style={styles.menuDetail}>{detail}</Text>}
    <Ionicons name="chevron-forward" size={17} color={colors.muted}/>
  </Pressable>;
}

const styles = StyleSheet.create({
  identity: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 2, paddingVertical: 6 },
  avatar: { width: 62, height: 62, borderRadius: 32, backgroundColor: '#EFE2BF', borderWidth: 1.5, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.ink, fontSize: 21, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }), fontWeight: '700' },
  avatarEdit: { position: 'absolute', left: 45, bottom: 1, width: 23, height: 23, borderRadius: 12, backgroundColor: colors.brandDark, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  identityText: { flex: 1, minWidth: 0, alignSelf: 'stretch', justifyContent: 'center', paddingTop: 4 },
  name: { color: colors.ink, fontSize: 18, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }), fontWeight: '700' },
  email: { color: colors.muted, fontSize: 12, marginTop: 2 },
  role: { alignSelf: 'flex-start', color: colors.brandDark, backgroundColor: colors.softGold, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4, fontSize: 10, marginTop: 5 },
  groupBlock: { gap: 5 },
  groupTitle: { color: colors.muted, fontSize: 9, fontWeight: '600', letterSpacing: .7, marginLeft: 4 },
  menuGroup: { overflow: 'hidden', borderRadius: 17, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  menuRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  menuRowPressed: { opacity: .72 },
  menuIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.softGold, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, color: colors.ink, fontSize: 13 },
  menuDetail: { color: colors.muted, fontSize: 10 },
  logout: { height: 44, borderRadius: 23, borderWidth: 1, borderColor: colors.goldLight, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  logoutText: { color: colors.ink, fontWeight: '700', fontSize: 12 },
  version: { color: colors.muted, fontSize: 9, textAlign: 'center' },
});
