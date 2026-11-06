import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { type Booking, type ReviewEligibility } from '@/types';
import { api } from '@/api';
import { Badge, Button, Card, Empty, ErrorText, Field, FormModal, Money, Row, Screen, s, run } from '@/ui';
import { useAuth } from '@/auth';
import { useNotificationState } from '@/notification-state';
import { claimNotificationPermissionExplanation, consumeNotificationExplanationAfterBooking } from '@/notification-prompt';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/format';
import { getAppLanguage } from '@/i18n';

function canCancel(eventDate: string) {
  const [year, month, day] = eventDate.split('-').map(Number);
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const eventUtc = Date.UTC(year, month - 1, day);
  return Math.floor((eventUtc - todayUtc) / 86_400_000) >= 7;
}

export default function Bookings() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { pushEnabled } = useNotificationState();
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [selected, setSelected] = useState<Booking>();
  const [text, setText] = useState('');
  const [reviewInfo, setReviewInfo] = useState<Record<number, ReviewEligibility>>({});

  const load = useCallback(async () => {
    try {
      setLoadError(undefined);
      const bookings = (await api.bookings()).content;
      setItems(bookings);
      if (user && !pushEnabled && bookings.length && await consumeNotificationExplanationAfterBooking(user.id)) {
        const showExplanation = await claimNotificationPermissionExplanation(user.id);
        if (showExplanation) router.replace({ pathname: '/account/notification-permission', params: { next: '/bookings', source: 'booking' } } as any);
      }
      const completed = bookings.filter(item => item.status === 'COMPLETED');
      const results = await Promise.all(completed.map(async item => {
        try { return await api.reviewEligibility(item.id); } catch { return undefined; }
      }));
      setReviewInfo(Object.fromEntries(results.filter(Boolean).map(item => [item!.bookingId, item!])));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    }
  }, [pushEnabled, user]);
  useFocusEffect(useCallback(() => { load().finally(() => setLoading(false)); }, [load]));
  const refresh = async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } };
  const submit = () => run(async () => {
    if (!selected) return;
    await api.cancelBooking(selected.id, text);
    setSelected(undefined);
    setText('');
    await load();
  }, t('bookings.cancelled'));

  return <Screen title={t('bookings.title')} subtitle={t('bookings.subtitle')} loading={loading} refreshing={refreshing} onRefresh={refresh} back>
    {loadError ? <Card><ErrorText error={loadError}/><Button title={t('common.retry')} compact variant="secondary" onPress={load}/></Card> : null}
    {!items.length ? <Empty text={t('bookings.empty')}/> : items.map(booking => <Card key={booking.id}>
      <View style={s.titleRow}>
        <Text numberOfLines={1} ellipsizeMode="tail" style={[s.overline, { flex: 1 }]}>{booking.bookingNumber}</Text>
        <Badge value={booking.status}/>
      </View>
      <Row label={t('common.date')} value={formatDate(`${booking.eventDate}T12:00:00`, getAppLanguage(), { day: 'numeric', month: 'long', year: 'numeric' })}/>
      <Row label={t('bookings.eventType')} value={t(`labels.${booking.eventType || 'WEDDING'}`)}/>
      {booking.venueName ? <Row label={t('common.restaurant')} value={booking.venueName}/> : null}
      {booking.hallName ? <Row label={t('common.hall')} value={booking.hallName}/> : null}
      <Row label={t('common.guests')} value={t('booking.guest', { count: booking.guestCount })}/>
      {booking.menuName ? <Row label={t('common.menu')} value={booking.menuName}/> : null}
      {booking.removedMenuItems?.length ? <Text style={s.muted}>{t('bookings.removedItems', { items: booking.removedMenuItems.join(', ') })}</Text> : null}
      {booking.addedMenuItems?.length ? <Text style={s.muted}>{t('bookings.addedItems', { items: booking.addedMenuItems.join(', ') })}</Text> : null}
      <Row label={t('common.total')} value={<Money value={booking.totalPrice}/>}/>
      <Row label={t('common.paid')} value={<Money value={booking.paidAmount}/>}/>
      <Row label={t('bookings.remainingPayment')} value={<Money value={Math.max(0, booking.totalPrice - booking.paidAmount)}/>}/>
      {booking.status === 'PENDING_APPROVAL' ? <Text style={s.muted}>{t('bookings.pendingInfo')}</Text> : null}
      {booking.cancelReason ? <Text style={s.error}>{t('common.reason')}: {booking.cancelReason}</Text> : null}
      <View style={s.actions}>
        {['PENDING_APPROVAL', 'CONFIRMED'].includes(booking.status) && canCancel(booking.eventDate)
          ? <Button title={t('bookings.cancel')} compact variant="danger" onPress={() => setSelected(booking)}/>
          : null}
        {booking.status === 'COMPLETED' && reviewInfo[booking.id]?.eligible
          ? <Button title={t('bookings.review')} compact variant="secondary" onPress={() => router.push({ pathname: '/review/[bookingId]', params: { bookingId: booking.id } } as any)}/>
          : null}
        {booking.status === 'COMPLETED' && reviewInfo[booking.id]?.review && reviewInfo[booking.id]?.editable
          ? <Button title={t('bookings.reviewEdit')} compact variant="secondary" onPress={() => router.push({ pathname: '/review/[bookingId]', params: { bookingId: booking.id } } as any)}/>
          : null}
      </View>
      {['PENDING_APPROVAL', 'CONFIRMED'].includes(booking.status) && !canCancel(booking.eventDate)
        ? <Text style={s.error}>{t('bookings.cannotCancel')}</Text>
        : null}
    </Card>)}
    <FormModal visible={!!selected} title={t('bookings.cancelTitle')} onClose={() => setSelected(undefined)}>
      <Field label={t('bookings.cancelReason')} value={text} onChangeText={setText} multiline/>
      <Button title={t('bookings.cancelConfirm')} onPress={submit} disabled={!text.trim()}/>
    </FormModal>
  </Screen>;
}
