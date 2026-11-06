import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import type { Booking } from '@/types';
import { api } from '@/api';
import { Button, Card, Chips, Empty, ErrorText, Field, FormModal, Screen, confirm, run, s } from '@/ui';
import { colors } from '@/theme';
import { useTranslation } from 'react-i18next';
import { formatCurrency, formatDate } from '@/format';
import { getAppLanguage } from '@/i18n';

export default function PendingPartnerBookings() {
  const { t } = useTranslation();
  const language = getAppLanguage();
  const otherReason = t('pendingBookings.reasons.other');
  const reasons = ['dateFull', 'hallClosed', 'technical', 'other'].map(key => ({ value: t(`pendingBookings.reasons.${key}`), label: t(`pendingBookings.reasons.${key}`) }));
  const [items, setItems] = useState<Booking[]>([]); const [rejecting, setRejecting] = useState<Booking>(); const [reasonType, setReasonType] = useState(''); const [rejectionReason, setRejectionReason] = useState(''); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [loadError, setLoadError] = useState<string>();
  const load = useCallback(async () => { try { setLoadError(undefined); const first = await api.pendingPartnerBookings(); const remaining = first.totalPages > 1 ? await Promise.all(Array.from({ length: first.totalPages - 1 }, (_, index) => api.pendingPartnerBookings(index + 1))) : []; setItems([...(first.content || []), ...remaining.flatMap(page => page.content || [])]); } catch (error) { setLoadError(error instanceof Error ? error.message : String(error)); } }, []);
  useFocusEffect(useCallback(() => { setLoading(true); void load().finally(() => setLoading(false)); }, [load]));
  const refresh = async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } };
  const approve = (booking: Booking) => confirm(t('pendingBookings.approveTitle'), t('pendingBookings.approveMessage', { venue: booking.venueName, date: formatDate(`${booking.eventDate}T12:00:00`, language) }), () => { void run(async () => { await api.approveBooking(booking.id); await load(); }, t('pendingBookings.approved')); });
  const openReject = (booking: Booking) => { setRejecting(booking); setReasonType(''); setRejectionReason(''); };
  const chooseReason = (value: string) => { setReasonType(value); if (value !== otherReason) setRejectionReason(value); else setRejectionReason(''); };
  const reject = () => run(async () => { if (!rejecting) return; await api.rejectBooking(rejecting.id, rejectionReason.trim()); setRejecting(undefined); await load(); }, t('pendingBookings.rejected'));
  return <Screen title={t('pendingBookings.title')} subtitle={t('pendingBookings.subtitle', { count: items.length })} loading={loading} refreshing={refreshing} onRefresh={refresh} partnerNav>
    {loadError ? <Card><ErrorText error={loadError}/><Button title={t('common.retry')} compact variant="secondary" onPress={load}/></Card> : null}
    {!loadError && !items.length ? <Empty text={t('pendingBookings.empty')}/> : items.map(item => <Card key={item.id} onPress={() => router.push({ pathname: '/partner/booking-detail', params: { bookingId: item.id, name: item.venueName } } as any)}>
      <View style={s.titleRow}><Text style={styles.venue}>{item.venueName || t('common.venue')}</Text><Text style={[s.overline, { marginLeft: 'auto' }]}>{item.bookingNumber}</Text></View>
      <Text style={s.h2}>{t(`labels.${item.eventType || 'WEDDING'}`)} · {formatDate(`${item.eventDate}T12:00:00`, language)} · {item.hallName || t('common.hall')} · {t('booking.guest', { count: item.guestCount })}</Text>
      <Text style={s.muted}>{item.customerName || t('pendingBookings.nameMissing')} · {item.customerPhone || item.customerEmail || t('pendingBookings.contactMissing')}</Text>
      <View style={s.divider}/><View style={s.titleRow}><Text style={[s.muted, { flex: 1 }]}>{t('pendingBookings.total', { amount: formatCurrency(item.totalPrice, language) })}</Text><Text style={s.muted}>{t('pendingBookings.depositPaid', { amount: formatCurrency(item.paidAmount, language) })}</Text></View>
      <View style={styles.actions}><Button title={t('common.confirm')} compact onPress={() => approve(item)}/><Button title={t('pendingBookings.decline')} compact variant="secondary" onPress={() => openReject(item)}/></View>
    </Card>)}
    <FormModal visible={!!rejecting} title={t('pendingBookings.declineTitle')} onClose={() => setRejecting(undefined)}>
      <Text style={s.muted}>{rejecting?.bookingNumber} · {rejecting?.eventDate ? formatDate(`${rejecting.eventDate}T12:00:00`, language) : ''}</Text><Chips options={reasons} value={reasonType} onChange={chooseReason}/>
      <Field label={t('pendingBookings.explanation')} value={rejectionReason} onChangeText={setRejectionReason} multiline maxLength={500} placeholder={t('pendingBookings.reasonPlaceholder')}/>
      <View style={styles.warning}><Text style={s.body}>{t('pendingBookings.refundNotice', { amount: formatCurrency(rejecting?.paidAmount || 0, language) })}</Text></View>
      <Button title={t('pendingBookings.declineAndRefund')} variant="danger" onPress={reject} disabled={!rejectionReason.trim()}/>
    </FormModal>
  </Screen>;
}
const styles = StyleSheet.create({ venue: { color: colors.brandDark, backgroundColor: colors.softGold, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, fontSize: 10, fontWeight: '700' }, actions: { flexDirection: 'row', gap: 8 }, warning: { backgroundColor: colors.softGold, borderRadius: 11, padding: 10 } });
