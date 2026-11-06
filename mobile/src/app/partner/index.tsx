import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api';
import { useAuth } from '@/auth';
import type { Booking, Review, Venue, VenueDetail } from '@/types';
import { Badge, Button, Field, FormModal, Screen, confirm, run, s } from '@/ui';
import { colors } from '@/theme';
import { NotificationBell } from '@/notification-bell';
import { useNotificationState } from '@/notification-state';
import { claimNotificationPermissionExplanation } from '@/notification-prompt';
import { useTranslation } from 'react-i18next';
import { appLocale, formatCurrency, formatDate } from '@/format';
import { getAppLanguage } from '@/i18n';

type Report = { totalBookings?: number; confirmedBookings?: number; bookedValue?: number; collected?: number };
type ReviewResult = { venue: Venue; reviews: Review[] };

function monthValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function todayValue() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function PartnerHome() {
  const { t } = useTranslation();
  const language = getAppLanguage();
  const locale = appLocale(language);
  const promptChecked = useRef(false);
  const { pushEnabled, permissionStatus } = useNotificationState();
  const { user } = useAuth();
  const [items, setItems] = useState<Venue[]>([]);
  const [firstDetail, setFirstDetail] = useState<VenueDetail>();
  const [pendingItems, setPendingItems] = useState<Booking[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [upcoming, setUpcoming] = useState<Booking[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [unansweredReviews, setUnansweredReviews] = useState<ReviewResult[]>([]);
  const [rejecting, setRejecting] = useState<Booking>();
  const [rejectionReason, setRejectionReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const load = async () => {
    const [venues, pending] = await Promise.all([api.partnerVenues(0, 100), api.pendingPartnerBookings(0, 3)]);
    const list = venues.content || [];
    setItems(list);
    setPendingItems(pending.content || []);
    setPendingCount(pending.totalElements);
    const [detailResult, reportResults, bookingResults, reviewResults] = await Promise.all([
      list[0] ? api.partnerVenue(list[0].id).catch(() => undefined) : Promise.resolve(undefined),
      Promise.all(list.map(venue => api.partnerReport(venue.id, monthValue()).catch(() => ({})))),
      Promise.all(list.map(venue => api.partnerBookings(venue.id, { status: 'CONFIRMED', size: 100 }).catch(() => ({ content: [] })))),
      Promise.all(list.map(async venue => ({ venue, reviews: (await api.reviews(venue.id, 0, 100).catch(() => ({ content: [] }))).content || [] }))),
    ]);
    setFirstDetail(detailResult);
    setReports(reportResults);
    setUpcoming(bookingResults.flatMap(result => result.content || []).filter(booking => booking.eventDate >= todayValue()).sort((a, b) => a.eventDate.localeCompare(b.eventDate)).slice(0, 2));
    setUnansweredReviews(reviewResults.filter(result => result.reviews.some(review => !(review.ownerReply || review.owner_reply || review.reply))));
  };
  useEffect(() => { void load().finally(() => setLoading(false)); }, []);
  useEffect(() => {
    if (!user || promptChecked.current || permissionStatus === 'unknown') return;
    promptChecked.current = true;
    if (pushEnabled) return;
    void claimNotificationPermissionExplanation(user.id).then(show => {
      if (show) router.push({ pathname: '/account/notification-permission', params: { next: '/partner' } } as any);
    });
  }, [permissionStatus, pushEnabled, user]);
  const refresh = async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } };
  const approve = (booking: Booking) => confirm(t('pendingBookings.approveTitle'), t('partnerHome.approveMessage', { date: formatDate(`${booking.eventDate}T12:00:00`, language) }), () => { void run(async () => { await api.approveBooking(booking.id); await load(); }, t('pendingBookings.approved')); });
  const reject = () => run(async () => {
    if (!rejecting) return;
    await api.rejectBooking(rejecting.id, rejectionReason.trim());
    setRejecting(undefined);
    setRejectionReason('');
    await load();
  }, t('partnerHome.rejected'));
  const initials = (user?.fullName || user?.email || t('partnerProfile.venueOwner')).split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('');
  const totals = useMemo(() => reports.reduce((sum, item) => ({ reservations: sum.reservations + Number(item.totalBookings || 0), value: sum.value + Number(item.bookedValue || 0), paid: sum.paid + Number(item.collected || 0) }), { reservations: 0, value: 0, paid: 0 }), [reports]);
  const unansweredCount = unansweredReviews.reduce((count, result) => count + result.reviews.filter(review => !(review.ownerReply || review.owner_reply || review.reply)).length, 0);
  const firstPending = pendingItems[0];
  const first = items[0];
  const nav = { venueId: first?.id, hallId: firstDetail?.halls[0]?.id, venueName: first?.name };
  if (!items.length) return <Screen loading={loading} refreshing={refreshing} onRefresh={refresh} partnerNav={nav} back={false}>
    <View style={styles.welcome}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
      <View style={styles.welcomeText}><Text style={styles.kicker}>{t('partnerHome.panel')}</Text><Text style={styles.hello}>{t('partnerHome.greeting', { name: (user?.fullName || t('partnerProfile.venueOwner')).split(' ')[0] })}</Text></View>
      <NotificationBell/>
    </View>
    <View style={styles.firstVenueCard}>
      <View style={styles.firstVenueIcon}><Ionicons name="business-outline" size={27} color={colors.brandDark}/></View>
      <Text style={styles.firstVenueTitle}>{t('partnerHome.addFirstVenue')}</Text>
      <Text style={styles.firstVenueText}>{t('partnerHome.addFirstVenueInfo')}</Text>
      <Button title={t('partnerHome.addVenue')} onPress={() => router.push('/partner/onboarding' as any)}/>
    </View>
    <View style={styles.stepsCard}>
      <Text style={styles.stepsHeading}>{t('partnerHome.requirements')}</Text>
      {[
        [t('partnerHome.steps.basic'), t('partnerHome.steps.basicInfo')],
        [t('partnerHome.steps.halls'), t('partnerHome.steps.hallsInfo')],
        [t('partnerHome.steps.menu'), t('partnerHome.steps.menuInfo')],
        [t('partnerHome.steps.company'), t('partnerHome.steps.companyInfo')],
      ].map(([title, detail], index) => <View key={title} style={[styles.stepRow, index < 3 && styles.stepBorder]}>
        <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{index + 1}</Text></View>
        <View style={{ flex: 1 }}><Text style={styles.stepTitle}>{title}</Text><Text style={styles.stepDetail}>{detail}</Text></View>
      </View>)}
    </View>
    <View style={styles.draftNote}><Ionicons name="help-circle-outline" size={16} color={colors.brandDark}/><Text style={styles.draftNoteText}>{t('partnerHome.draftInfo')}</Text></View>
  </Screen>;
  return <Screen loading={loading} refreshing={refreshing} onRefresh={refresh} partnerNav={nav} back={false}>
    <View style={styles.welcome}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
      <View style={styles.welcomeText}><Text style={styles.kicker}>{t('partnerHome.panel')}</Text><Text style={styles.hello}>{t('partnerHome.greeting', { name: (user?.fullName || t('partnerProfile.venueOwner')).split(' ')[0] })}</Text></View>
      <NotificationBell/>
    </View>

    {pendingCount > 0 && <View style={styles.pendingCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.headingWithCount}><Text style={styles.cardHeading}>{t('partnerHome.awaitingApproval')}</Text>{pendingCount > 0 && <Count value={pendingCount}/>}</View>
        {pendingCount > 0 && <TextLink title={t('common.all')} onPress={() => router.push('/partner/pending-bookings' as any)}/>} 
      </View>
      {firstPending && <>
        <Pressable onPress={() => router.push({ pathname: '/partner/booking-detail', params: { bookingId: firstPending.id, name: firstPending.venueName } } as any)} style={({ pressed }) => [styles.pendingBooking, pressed && styles.pressed]}>
          <DateTile date={firstPending.eventDate}/>
          <View style={styles.bookingText}><Text numberOfLines={1} style={styles.customer}>{firstPending.customerName || t('partnerReviews.customer')}</Text><Text numberOfLines={1} style={styles.bookingMeta}>{t(`labels.${firstPending.eventType || 'PRIVATE_EVENT'}`)} · {firstPending.hallName || t('common.hall')} · {t('booking.guest', { count: firstPending.guestCount })}</Text></View>
          <Text style={styles.amount}>{formatCurrency(firstPending.totalPrice, language)}</Text>
        </Pressable>
        <View style={styles.pendingActions}><View style={styles.actionSlot}><Button title={t('common.confirm')} compact onPress={() => approve(firstPending)}/></View><View style={styles.actionSlot}><Button title={t('pendingBookings.decline')} compact variant="secondary" onPress={() => { setRejecting(firstPending); setRejectionReason(''); }}/></View></View>
      </>}
      {unansweredCount > 0 && <Pressable onPress={() => { const target = unansweredReviews[0]?.venue; if (target) router.push({ pathname: '/partner/reviews', params: { venueId: target.id, name: target.name } } as any); }} style={styles.reviewAlert}>
        <Ionicons name="star-outline" size={17} color={colors.brandDark}/><Text style={styles.reviewText}>{t('partnerHome.reviewsAwaiting', { count: unansweredCount })}</Text><Ionicons name="chevron-forward" size={15} color={colors.muted}/>
      </Pressable>}
    </View>}

    <View style={styles.summary}>
      <View style={styles.summaryHeader}><Text style={styles.month}>{new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date()).toLocaleUpperCase(locale)}</Text>{first && <Pressable onPress={() => router.push({ pathname: '/partner/report', params: { venueId: first.id, name: first.name } } as any)}><Text style={styles.reportLink}>{t('partnerReport.title')} ›</Text></Pressable>}</View>
      <View style={styles.metrics}><Metric value={totals.reservations} label={t('partnerHome.reservations')}/><Metric value={formatCurrency(totals.value, language)} label={t('partnerHome.orderValue')} bordered/><Metric value={formatCurrency(totals.paid, language)} label={t('partnerHome.reservationFee')} bordered/></View>
    </View>

    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{t('partnerHome.upcoming')}</Text>{first && <TextLink title={t('common.all')} onPress={() => router.push({ pathname: '/partner/bookings', params: { venueId: first.id, name: first.name } } as any)}/>}</View>
    <View style={styles.upcomingCard}>
      {upcoming.length ? upcoming.map((booking, index) => <Pressable key={booking.id} onPress={() => router.push({ pathname: '/partner/booking-detail', params: { bookingId: booking.id, name: booking.venueName } } as any)} style={({ pressed }) => [styles.upcomingRow, index < upcoming.length - 1 && styles.rowBorder, pressed && styles.pressed]}>
        <DateTile date={booking.eventDate}/><View style={styles.bookingText}><Text numberOfLines={1} style={styles.customer}>{booking.customerName || t('partnerReviews.customer')}</Text><Text numberOfLines={1} style={styles.bookingMeta}>{booking.hallName || booking.venueName || t('common.hall')} · {t('booking.guest', { count: booking.guestCount })}</Text></View><View style={styles.daysPill}><Text style={styles.daysText}>{t('partnerHome.days', { count: daysUntil(booking.eventDate) })}</Text></View>
      </Pressable>) : <Text style={styles.emptyUpcoming}>{t('partnerHome.noUpcoming')}</Text>}
    </View>
    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{t('partnerHome.myVenues')}</Text><Pressable onPress={() => router.push('/partner/onboarding' as any)} style={styles.newButton}><Text style={styles.newButtonText}>{t('partnerHome.new')}</Text></Pressable></View>
    {items.map(venue => {
      const managed = venue.status === 'ACTIVE' || venue.changeReviewStatus?.startsWith('REAPPROVAL_');
      const displayedStatus = venue.changeReviewStatus === 'REAPPROVAL_PENDING' ? 'REAPPROVAL_PENDING' : venue.status;
      return <View key={venue.id} style={styles.venueCard}>
        <View style={styles.venueMain}>
          {venue.coverImageUrl ? <Image source={{ uri: venue.coverImageUrl }} style={styles.venueImage}/> : <View style={styles.venuePlaceholder}><Ionicons name="business-outline" size={25} color={colors.brandDark}/></View>}
          <View style={styles.venueInfo}><View style={styles.venueNameRow}><Text numberOfLines={1} style={styles.venueName}>{venue.name}</Text><Badge value={displayedStatus}/></View><Text numberOfLines={1} style={styles.venueAddress}>{venue.city ? `${venue.city} · ` : ''}{venue.address}</Text>{managed && <Text style={styles.ratingText}>★ {Number(venue.ratingAvg ?? venue.rating ?? 0).toFixed(1)} · {t('manageVenue.reviews', { count: venue.reviewCount || 0 })}</Text>}</View>
        </View>
        {managed ? <Button title={t('partnerHome.manage')} compact onPress={() => router.push(`/partner/venue/${venue.id}` as any)}/> : <Button title={t('common.continue')} compact variant="secondary" onPress={() => router.push({ pathname: '/partner/onboarding', params: { venueId: venue.id } } as any)}/>} 
      </View>;
    })}

    <FormModal visible={!!rejecting} title={t('pendingBookings.declineTitle')} onClose={() => setRejecting(undefined)}>
      <Text style={s.muted}>{t('partnerHome.rejectInfo')}</Text>
      <Field label={t('partnerHome.rejectReason')} value={rejectionReason} onChangeText={setRejectionReason} multiline maxLength={500}/>
      <Button title={t('pendingBookings.declineAndRefund')} variant="danger" onPress={reject} disabled={!rejectionReason.trim()}/>
    </FormModal>
  </Screen>;
}

function Metric({ value, label, bordered }: { value: string | number; label: string; bordered?: boolean }) { return <View style={[styles.metric, bordered && styles.metricBorder]}><Text numberOfLines={1} adjustsFontSizeToFit style={styles.metricValue}>{value}</Text><Text numberOfLines={1} style={styles.metricLabel}>{label}</Text></View>; }
function Count({ value }: { value: number }) { return <View style={styles.count}><Text style={styles.countText}>{value}</Text></View>; }
function TextLink({ title, onPress }: { title: string; onPress: () => void }) { return <Pressable onPress={onPress} hitSlop={8}><Text style={styles.textLink}>{title} ›</Text></Pressable>; }
function DateTile({ date }: { date: string }) { const value = new Date(`${date}T12:00:00`); const locale = appLocale(getAppLanguage()); return <View style={styles.dateTile}><Text style={styles.dateDay}>{new Intl.DateTimeFormat(locale, { day: '2-digit' }).format(value)}</Text><Text style={styles.dateMonth}>{new Intl.DateTimeFormat(locale, { month: 'short' }).format(value).toLocaleUpperCase(locale)}</Text></View>; }
function daysUntil(value: string) { const [year, month, day] = value.split('-').map(Number); const target = new Date(year, month - 1, day).getTime(); const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(); return Math.max(0, Math.round((target - today) / 86_400_000)); }

const styles = StyleSheet.create({
  welcome: { minHeight: 51, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 3 }, avatar: { width: 45, height: 45, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFE2BF', borderWidth: 1.5, borderColor: colors.gold }, avatarText: { color: colors.ink, fontSize: 15, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }), fontWeight: '700' }, welcomeText: { flex: 1 }, kicker: { color: colors.muted, fontSize: 9 }, hello: { color: colors.ink, fontSize: 19, lineHeight: 24, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }), fontWeight: '700' },
  firstVenueCard: { alignItems: 'center', gap: 8, padding: 16, borderRadius: 17, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  firstVenueIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8D6A8' },
  firstVenueTitle: { color: colors.ink, fontSize: 21, fontWeight: '800', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  firstVenueText: { maxWidth: 280, color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: 'center', marginBottom: 4 },
  stepsCard: { paddingHorizontal: 13, paddingVertical: 10, borderRadius: 17, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  stepsHeading: { color: colors.ink, fontSize: 12, fontWeight: '800', paddingVertical: 3 },
  stepRow: { minHeight: 53, flexDirection: 'row', alignItems: 'center', gap: 11 },
  stepBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  stepNumber: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softGold },
  stepNumberText: { color: colors.brandDark, fontSize: 11, fontWeight: '800' },
  stepTitle: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  stepDetail: { color: colors.muted, fontSize: 9, marginTop: 2 },
  draftNote: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, borderRadius: 12, backgroundColor: colors.softGold },
  draftNoteText: { flex: 1, color: colors.ink, fontSize: 9, lineHeight: 14 },
  pendingCard: { gap: 10, padding: 12, borderRadius: 17, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.goldLight }, sectionHeader: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, headingWithCount: { flexDirection: 'row', alignItems: 'center', gap: 7 }, cardHeading: { color: colors.ink, fontSize: 13, fontWeight: '800' }, count: { minWidth: 19, height: 19, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.danger }, countText: { color: '#fff', fontSize: 9, fontWeight: '800' }, textLink: { color: colors.brandDark, fontSize: 10, fontWeight: '700' },
  pendingBooking: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 10 }, dateTile: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: colors.softGold }, dateDay: { color: colors.ink, fontSize: 15, lineHeight: 17, fontWeight: '800', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) }, dateMonth: { color: colors.brandDark, fontSize: 7, fontWeight: '800' }, bookingText: { flex: 1, minWidth: 0 }, customer: { color: colors.ink, fontSize: 11, lineHeight: 16, fontWeight: '800' }, bookingMeta: { color: colors.muted, fontSize: 9, lineHeight: 14 }, amount: { color: colors.ink, fontSize: 11, fontWeight: '900' }, pendingActions: { flexDirection: 'row', gap: 8 }, actionSlot: { flex: 1 },
  reviewAlert: { minHeight: 31, flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }, reviewText: { flex: 1, color: colors.muted, fontSize: 10 },
  summary: { backgroundColor: colors.ink, borderRadius: 16, padding: 13, gap: 12 }, summaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, month: { color: '#EED8A8', fontSize: 9, fontWeight: '800' }, reportLink: { color: '#F2C873', fontSize: 9, fontWeight: '700' }, metrics: { flexDirection: 'row' }, metric: { flex: 1, alignItems: 'center', gap: 3, paddingHorizontal: 4 }, metricBorder: { borderLeftWidth: 1, borderColor: '#514E48' }, metricValue: { color: '#F2C873', fontSize: 16, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }), fontWeight: '700' }, metricLabel: { color: '#EEE9DF', fontSize: 8 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }), fontWeight: '700' }, upcomingCard: { overflow: 'hidden', borderRadius: 16, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line }, upcomingRow: { minHeight: 61, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 11, paddingVertical: 8 }, rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, daysPill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, backgroundColor: '#EEF1E6' }, daysText: { color: colors.success, fontSize: 8, fontWeight: '700' }, emptyUpcoming: { color: colors.muted, fontSize: 11, textAlign: 'center', padding: 18 },
  newButton: { minHeight: 35, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.goldLight }, newButtonText: { color: colors.brandDark, fontSize: 10, fontWeight: '800' },
  venueCard: { gap: 10, padding: 10, borderRadius: 17, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line }, venueMain: { flexDirection: 'row', alignItems: 'center', gap: 10 }, venueImage: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.softGold }, venuePlaceholder: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#E8D6A8' }, venueInfo: { flex: 1, minWidth: 0 }, venueNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 }, venueName: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: '800', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) }, venueAddress: { color: colors.muted, fontSize: 9, marginTop: 2 }, active: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 11, backgroundColor: '#EEF1E6' }, activeText: { color: colors.success, fontSize: 8, fontWeight: '700' }, ratingText: { color: colors.brandDark, fontSize: 9, fontWeight: '700', marginTop: 4 }, pressed: { opacity: .62 },
});
