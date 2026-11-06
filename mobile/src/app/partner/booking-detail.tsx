import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '@/api';
import { colors } from '@/theme';
import type { Booking, BookingMenuChange } from '@/types';
import { Chips, Field, FormModal, confirm, run } from '@/ui';
import { useTranslation } from 'react-i18next';
import { appLocale, formatCurrency, formatDate } from '@/format';
import { getAppLanguage } from '@/i18n';
const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export default function BookingDetail() {
  const { t } = useTranslation();
  const language = getAppLanguage();
  const locale = appLocale(language);
  const otherReason = t('pendingBookings.reasons.other');
  const rejectionOptions = ['dateFull', 'hallClosed', 'technical', 'other'].map(key => ({ value: t(`pendingBookings.reasons.${key}`), label: t(`pendingBookings.reasons.${key}`) }));
  const money = (value: number | string | undefined) => formatCurrency(Number(value || 0), language);
  const params = useLocalSearchParams<{ venueId?: string; bookingId: string; name?: string }>();
  const bookingId = Number(params.bookingId);
  const [booking, setBooking] = useState<Booking>();
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState(false);
  const [reasonType, setReasonType] = useState('');
  const [reason, setReason] = useState('');
  const [productsOpen, setProductsOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const load = useCallback(async () => {
    setBooking(await api.partnerBooking(bookingId));
  }, [bookingId]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const approve = () => booking && confirm(
    t('pendingBookings.approveTitle'),
    t('partnerHome.approveMessage', { date: formatDate(`${booking.eventDate}T12:00:00`, language) }),
    () => run(async () => { await api.approveBooking(booking.id); await load(); }, t('pendingBookings.approved')),
  );
  const reject = () => booking && run(async () => {
    await api.rejectBooking(booking.id, reason.trim());
    setRejecting(false);
    await load();
  }, t('bookingDetail.rejected'));
  const complete = () => booking && confirm(
    t('bookingDetail.completeTitle'),
    t('bookingDetail.completeMessage'),
    () => run(async () => { await api.completeBooking(booking.id); await load(); }, t('bookingDetail.completed')),
  );

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator size="large" color={colors.brand}/></View></SafeAreaView>;
  if (!booking) return <SafeAreaView style={styles.safe}><Header title={t('bookingDetail.title')}/><View style={styles.center}><Ionicons name="calendar-outline" size={38} color={colors.gold}/><Text style={styles.empty}>{t('bookingDetail.notFound')}</Text></View></SafeAreaView>;

  const [year, month, day] = booking.eventDate.split('-').map(Number);
  const legacyMenuChanges: BookingMenuChange[] = [
    ...(booking.removedMenuItems || []).map((name, index) => ({ itemId: -(index + 1), name, action: 'REMOVED' as const, pricePerPerson: 0 })),
    ...(booking.addedMenuItems || []).map((name, index) => ({ itemId: -(1000 + index), name, action: 'ADDED' as const, pricePerPerson: 0 })),
  ];
  const menuChanges = booking.menuChanges?.length ? booking.menuChanges : legacyMenuChanges;
  const categoryKey = (name?: string) => name?.trim().toLocaleLowerCase('az-AZ') || '__changes__';
  const productGroups = (booking.menuCategories || []).map(category => ({
    key: `category-${category.id}`,
    name: category.name,
    items: category.items.map(item => item.name),
    changes: menuChanges.filter(change => categoryKey(change.categoryName) === categoryKey(category.name)),
  }));
  const knownCategories = new Set(productGroups.map(group => categoryKey(group.name)));
  menuChanges.forEach(change => {
    const key = categoryKey(change.categoryName);
    if (knownCategories.has(key)) return;
    knownCategories.add(key);
    productGroups.push({
      key: `change-${key}`,
      name: change.categoryName?.trim() || t('bookingDetail.menuChanges'),
      items: [],
      changes: menuChanges.filter(item => categoryKey(item.categoryName) === key),
    });
  });
  const serviceText = booking.extraServices?.length
    ? booking.extraServices.map(item => `${item.name}${item.quantity > 1 ? ` × ${item.quantity}` : ''}`).join(', ')
    : t('bookingDetail.none');
  const productCount = booking.menuCategories?.reduce((sum, category) => sum + category.items.length, 0) || 0;
  const footerVisible = booking.status === 'PENDING_APPROVAL' || (booking.status === 'CONFIRMED' && booking.eventDate <= localDate());

  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
    <Header title={t('bookingDetail.title')} subtitle={booking.venueName || params.name || booking.hallName} status={booking.status}/>
    <ScrollView contentContainerStyle={[styles.content, footerVisible && styles.contentWithFooter]} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <View style={styles.heroRow}>
          <View style={styles.dateTile}><Text style={styles.dateDay}>{day}</Text><Text style={styles.dateMonth}>{new Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit' }).format(new Date(year, month - 1, day)).toLocaleUpperCase(locale)}</Text></View>
          <View style={styles.flex}>
            <Text style={styles.customer}>{booking.customerName || t('partnerReviews.customer')}</Text>
            <Text style={styles.description}>{t(`labels.${booking.eventType || 'WEDDING'}`)} · {booking.hallName} · {t('booking.guest', { count: booking.guestCount })}</Text>
            <View style={styles.bookingNumberRow}>
              <Text style={styles.bookingNumber}>{booking.bookingNumber}</Text>
              <Pressable hitSlop={8} onPress={async () => { await Clipboard.setStringAsync(booking.bookingNumber); Alert.alert(t('bookingDetail.copied'), t('bookingDetail.numberCopied')); }}>
                <Text style={styles.link}>{t('bookingDetail.copy')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <ContactRow icon="call-outline" value={booking.customerPhone || t('bookingDetail.phoneMissing')} action={booking.customerPhone ? t('bookingDetail.call') : undefined} onPress={booking.customerPhone ? () => Linking.openURL(`tel:${booking.customerPhone}`) : undefined}/>
        <View style={styles.divider}/>
        <ContactRow icon="mail-outline" value={booking.customerEmail || t('bookingDetail.emailMissing')} action={booking.customerEmail ? t('bookingDetail.write') : undefined} onPress={booking.customerEmail ? () => Linking.openURL(`mailto:${booking.customerEmail}`) : undefined}/>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('bookingDetail.preparation')}</Text>
        <InfoRow label={t('common.menu')} value={booking.menuName || t('bookingDetail.menuMissing')}/>
        <InfoRow label={t('bookingDetail.menuChange')} value={menuChanges.length ? t('bookingDetail.changes', { count: menuChanges.length }) : t('bookingDetail.none')}/>
        <InfoRow label={t('bookingDetail.extraService')} value={serviceText}/>
        <InfoRow label={t('bookingDetail.customerNote')} value={booking.customerNote || t('bookingDetail.noNote')}/>
        <View style={styles.divider}/>
        <ExpandButton title={t('bookingDetail.products', { count: productCount })} open={productsOpen} onPress={() => setProductsOpen(value => !value)}/>
        {productsOpen && <View style={styles.expanded}>
          {productGroups.length ? productGroups.map(category => <View key={category.key} style={styles.productGroup}>
            <Text style={styles.productCategory}>{category.name}</Text>
            {!!category.items.length && <Text style={styles.productNames}>{category.items.join(', ')}</Text>}
            {category.changes.map(change => <View key={`${change.action}-${change.itemId}`} style={styles.menuChangeRow}>
              <Ionicons name={change.action === 'REMOVED' ? 'remove-circle-outline' : 'add-circle-outline'} size={13} color={change.action === 'REMOVED' ? colors.danger : colors.success}/>
              <Text style={[styles.menuChangeText, change.action === 'REMOVED' ? styles.menuChangeRemoved : styles.menuChangeAdded]}>
                {change.action === 'REMOVED' ? t('bookingDetail.removed') : t('bookingDetail.added')} ({change.name})
              </Text>
            </View>)}
          </View>) : <Text style={styles.muted}>{t('bookingDetail.noProducts')}</Text>}
        </View>}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('bookingDetail.payment')}</Text>
        <InfoRow label={t('bookingDetail.estimatedTotal')} value={money(booking.totalPrice)} strong/>
        <View style={styles.paymentRow}>
          <Text style={styles.infoLabel}>{t('bookingDetail.onlineFee')}</Text>
          <View style={styles.paymentValue}><View style={styles.paidPill}><Ionicons name="checkmark" size={12} color={colors.success}/><Text style={styles.paidText}>{t('common.paid')}</Text></View><Text style={styles.infoStrong}>{money(booking.depositAmount)}</Text></View>
        </View>
        <View style={styles.venuePayment}><Text style={styles.venuePaymentLabel}>{t('bookingDetail.collectAtVenue')}</Text><Text style={styles.venuePaymentValue}>{money(Math.max(0, Number(booking.totalPrice) - Number(booking.paidAmount)))}</Text></View>
        <View style={styles.divider}/>
        <ExpandButton title={t('bookingDetail.paymentDetails')} open={paymentOpen} onPress={() => setPaymentOpen(value => !value)}/>
        {paymentOpen && <View style={styles.expanded}>
          <InfoRow label={t('bookingDetail.hallAndMenu')} value={money(booking.hallPrice)}/>
          <InfoRow label={t('bookingDetail.menuChange')} value={money(booking.menuCustomizationPrice)}/>
          <InfoRow label={t('bookingDetail.extraServices')} value={money(booking.servicesPrice)}/>
          {!!Number(booking.discountAmount) && <InfoRow label={t('bookingDetail.discount')} value={`− ${money(booking.discountAmount)}`}/>} 
        </View>}
      </View>
    </ScrollView>

    {footerVisible && <SafeAreaView edges={['bottom']} style={styles.footerSafe}>
      {booking.status === 'PENDING_APPROVAL'
        ? <View style={styles.footer}>
          <ActionButton title={t('common.confirm')} onPress={approve}/>
          <ActionButton title={t('pendingBookings.decline')} outline onPress={() => { setReasonType(''); setReason(''); setRejecting(true); }}/>
        </View>
        : <View style={styles.footer}><ActionButton title={t('bookingDetail.eventCompleted')} onPress={complete}/></View>}
    </SafeAreaView>}

    <FormModal visible={rejecting} title={t('pendingBookings.declineTitle')} onClose={() => setRejecting(false)}>
      <Text style={styles.muted}>{booking.bookingNumber} · {formatDate(`${booking.eventDate}T12:00:00`, language)}</Text>
      <Chips options={rejectionOptions} value={reasonType} onChange={value => { setReasonType(value); setReason(value === otherReason ? '' : value); }}/>
      <Field label={t('pendingBookings.explanation')} value={reason} onChangeText={setReason} multiline/>
      <View style={styles.refundNotice}><Text style={styles.refundText}>{t('bookingDetail.refundNotice', { amount: money(booking.paidAmount) })}</Text></View>
      <ActionButton title={t('pendingBookings.declineAndRefund')} onPress={reject} disabled={!reason.trim()} danger/>
    </FormModal>
  </SafeAreaView>;
}

function Header({ title, subtitle, status }: { title: string; subtitle?: string; status?: string }) {
  const { t } = useTranslation();
  return <View style={styles.header}>
    <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={21} color={colors.ink}/></Pressable>
    <View style={styles.flex}><Text style={styles.headerTitle}>{title}</Text>{subtitle && <Text numberOfLines={1} style={styles.headerSubtitle}>{subtitle}</Text>}</View>
    {status && <StatusPill status={status}/>} 
  </View>;
}

function StatusPill({ status }: { status: string }) {
  const { t } = useTranslation();
  const color = status === 'CONFIRMED' || status === 'COMPLETED' ? colors.success : status === 'REJECTED' || status === 'CANCELLED' ? colors.danger : colors.brand;
  const background = status === 'CONFIRMED' || status === 'COMPLETED' ? '#EEF1E6' : status === 'REJECTED' || status === 'CANCELLED' ? '#F7E9E7' : colors.softGold;
  return <View style={[styles.status, { backgroundColor: background }]}><View style={[styles.statusDot, { backgroundColor: color }]}/><Text style={[styles.statusText, { color }]}>{t(`labels.${status}`, { defaultValue: status })}</Text></View>;
}

function ContactRow({ icon, value, action, onPress }: { icon: keyof typeof Ionicons.glyphMap; value: string; action?: string; onPress?: () => void }) {
  return <View style={styles.contactRow}><View style={styles.iconCircle}><Ionicons name={icon} size={17} color={colors.brand}/></View><Text style={styles.contactValue} numberOfLines={1}>{value}</Text>{action && <Pressable hitSlop={8} onPress={onPress}><Text style={styles.link}>{action}</Text></Pressable>}</View>;
}

function InfoRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={[styles.infoValue, strong && styles.infoStrong]}>{value}</Text></View>;
}

function ExpandButton({ title, open, onPress }: { title: string; open: boolean; onPress: () => void }) {
  return <Pressable style={styles.expandButton} onPress={onPress}><Text style={styles.expandText}>{title}</Text><Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={17} color={colors.brand}/></Pressable>;
}

function ActionButton({ title, onPress, outline, danger, disabled }: { title: string; onPress: () => void; outline?: boolean; danger?: boolean; disabled?: boolean }) {
  const color = danger ? colors.danger : colors.brand;
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.actionButton, { backgroundColor: outline ? colors.paper : color, borderColor: color }, (pressed || disabled) && styles.buttonPressed]}>
    <Text style={[styles.actionText, { color: outline ? color : colors.paper }]}>{title}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream }, flex: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }, empty: { color: colors.muted, fontSize: 13 },
  header: { minHeight: 67, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 15, paddingVertical: 9, backgroundColor: colors.cream },
  back: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  headerTitle: { color: colors.ink, fontSize: 18, lineHeight: 22, fontWeight: '800', fontFamily: 'serif' }, headerSubtitle: { color: colors.muted, fontSize: 10, marginTop: 1 },
  status: { maxWidth: 118, minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, borderRadius: 14 }, statusDot: { width: 6, height: 6, borderRadius: 3 }, statusText: { flexShrink: 1, fontSize: 9, fontWeight: '800' },
  content: { gap: 10, paddingHorizontal: 14, paddingTop: 3, paddingBottom: 24 }, contentWithFooter: { paddingBottom: 104 },
  card: { padding: 14, borderRadius: 18, backgroundColor: colors.paper, borderWidth: 1, borderColor: '#EEE7DC' }, heroRow: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  dateTile: { width: 54, height: 59, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.softGold }, dateDay: { color: colors.brand, fontSize: 21, lineHeight: 24, fontWeight: '800', fontFamily: 'serif' }, dateMonth: { color: colors.brand, fontSize: 8, fontWeight: '800' },
  customer: { color: colors.ink, fontSize: 15, lineHeight: 20, fontWeight: '800', fontFamily: 'serif' }, description: { color: colors.muted, fontSize: 10, lineHeight: 16 }, bookingNumberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 }, bookingNumber: { color: colors.muted, fontSize: 9 }, link: { color: colors.brand, fontSize: 10, fontWeight: '800' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginVertical: 10 }, contactRow: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 9 }, iconCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softGold }, contactValue: { flex: 1, color: colors.ink, fontSize: 10 },
  sectionTitle: { color: colors.ink, fontSize: 16, lineHeight: 20, fontWeight: '800', fontFamily: 'serif', marginBottom: 7 }, infoRow: { minHeight: 27, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingVertical: 4 }, infoLabel: { flex: 1, color: colors.muted, fontSize: 10, lineHeight: 15 }, infoValue: { flex: 1.3, color: colors.ink, fontSize: 10, lineHeight: 15, textAlign: 'right' }, infoStrong: { color: colors.ink, fontWeight: '800' },
  expandButton: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, expandText: { color: colors.brand, fontSize: 11, fontWeight: '800' }, expanded: { gap: 6, paddingTop: 9 }, productGroup: { gap: 3, padding: 9, borderRadius: 10, backgroundColor: colors.cream }, productCategory: { color: colors.ink, fontSize: 10, fontWeight: '800' }, productNames: { color: colors.muted, fontSize: 9, lineHeight: 14 }, menuChangeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 2 }, menuChangeText: { flex: 1, fontSize: 9, lineHeight: 14, fontWeight: '700' }, menuChangeRemoved: { color: colors.danger }, menuChangeAdded: { color: colors.success }, muted: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  paymentRow: { minHeight: 31, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 4 }, paymentValue: { flexDirection: 'row', alignItems: 'center', gap: 8 }, paidPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 10, backgroundColor: '#EEF1E6' }, paidText: { color: colors.success, fontSize: 8, fontWeight: '800' },
  venuePayment: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 12, marginTop: 7, borderRadius: 13, backgroundColor: colors.softGold }, venuePaymentLabel: { color: colors.brand, fontSize: 10, fontWeight: '700' }, venuePaymentValue: { color: colors.brand, fontSize: 15, fontWeight: '900', fontFamily: 'serif' },
  footerSafe: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.paper, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }, footer: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 }, actionButton: { flex: 1, minHeight: 45, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', borderRadius: 23, borderWidth: 1.5 }, actionText: { fontSize: 12, fontWeight: '800' }, buttonPressed: { opacity: .55 },
  refundNotice: { padding: 12, borderRadius: 12, backgroundColor: colors.softGold }, refundText: { color: colors.muted, fontSize: 11, lineHeight: 17 },
});
