import { useCallback, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { api } from '@/api';
import { useAuth } from '@/auth';
import { NotificationBell } from '@/notification-bell';
import { DatePickerField, todayIso } from '@/date-picker';
import type { Booking, Venue } from '@/types';
import { Button, Field, Screen, run } from '@/ui';
import { colors, useCompactAndroidLayout } from '@/theme';
import { CompactVenueCard } from '@/venue-card';
import { useTranslation } from 'react-i18next';
import { formatCurrency, formatDate } from '@/format';
import { getAppLanguage } from '@/i18n';

const activeBookingStatuses = ['PENDING_APPROVAL', 'CONFIRMED'];

function initialEventDate() {
  const date = new Date();
  date.setDate(date.getDate() + 90);
  return date.toISOString().slice(0, 10);
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function daysUntil(value: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((parseLocalDate(value).getTime() - today.getTime()) / 86_400_000));
}

function prettyDate(value: string) {
  return formatDate(parseLocalDate(value), getAppLanguage(), { day: 'numeric', month: 'long', year: 'numeric' });
}

function nextBooking(bookings: Booking[]) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return bookings
    .filter(item => activeBookingStatuses.includes(item.status) && parseLocalDate(item.eventDate) >= now)
    .sort((a, b) => parseLocalDate(a.eventDate).getTime() - parseLocalDate(b.eventDate).getTime())[0];
}

function SectionHeader({ title, onAll }: { title: string; onAll?: () => void }) {
  const compactLayout = useCompactAndroidLayout();
  const { t } = useTranslation();
  return <View style={styles.sectionHeader}>
    <Text style={[styles.sectionTitle, compactLayout && styles.sectionTitleDense]}>{title}</Text>
    {onAll && <Pressable accessibilityRole="button" onPress={onAll} hitSlop={8}><Text style={[styles.allLink, compactLayout && styles.allLinkDense]}>{t('common.all')} ›</Text></Pressable>}
  </View>;
}

export default function Explore() {
  const compactLayout = useCompactAndroidLayout();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [booking, setBooking] = useState<Booking>();
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [favoriteBusy, setFavoriteBusy] = useState<Set<number>>(new Set());
  const favoriteRevision = useRef(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [date, setDate] = useState(initialEventDate);
  const [guests, setGuests] = useState('200');

  const load = useCallback(async () => {
    const [venueResult, bookingResult, favoriteResult] = await Promise.allSettled([
      api.venues({ size: 100 }),
      api.bookings(),
      api.favorites()
    ]);
    if (venueResult.status === 'fulfilled') setVenues(venueResult.value.content || []);
    if (bookingResult.status === 'fulfilled') setBooking(nextBooking(bookingResult.value.content || []));
    if (favoriteResult.status === 'fulfilled') setFavoriteIds(new Set((favoriteResult.value.content || []).map(item => item.id)));
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    load().finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load]));

  const refresh = async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } };
  const openVenues = (params: Record<string, string | number | undefined> = {}) => router.push({ pathname: '/(tabs)/venues', params } as any);
  const toggleFavorite = async (venueId: number) => {
    if (favoriteBusy.has(venueId)) return;
    const favorite = favoriteIds.has(venueId);
    favoriteRevision.current += 1;
    setFavoriteIds(current => { const next = new Set(current); if (favorite) next.delete(venueId); else next.add(venueId); return next; });
    setFavoriteBusy(current => new Set(current).add(venueId));
    const success = await run(async () => { if (favorite) await api.unfavorite(venueId); else await api.favorite(venueId); });
    if (!success) setFavoriteIds(current => { const next = new Set(current); if (favorite) next.add(venueId); else next.delete(venueId); return next; });
    setFavoriteBusy(current => { const next = new Set(current); next.delete(venueId); return next; });
  };

  const selectedVenues = venues.slice(0, 5);
  const likedVenues = [...venues].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0)).slice(0, 5);
  const firstName = user?.firstName || user?.fullName?.trim().split(/\s+/)[0] || t('home.guest');
  const remaining = booking ? Math.max(0, Number(booking.totalPrice || 0) - Number(booking.paidAmount || 0)) : 0;
  const venuePhone = booking?.venuePhone?.replace(/[^\d+]/g, '');
  const callVenue = () => {
    if (venuePhone) void run(() => Linking.openURL(`tel:${venuePhone}`));
  };

  return <Screen loading={loading} refreshing={refreshing} onRefresh={refresh} androidDensity="custom">
    <View style={styles.topRow}>
      <View style={styles.greetingBlock}><Text style={[styles.greeting, compactLayout && styles.greetingDense]}>{t('home.greeting', { name: firstName })}</Text><Text style={[styles.kicker, compactLayout && styles.kickerDense]}>{t('home.kicker')}</Text></View>
      <NotificationBell/>
    </View>

    <Pressable accessibilityRole="search" accessibilityLabel={t('home.search')} onPress={() => openVenues()} style={({ pressed }) => [styles.search, compactLayout && styles.searchDense, pressed && styles.pressed]}>
      <Ionicons name="search-outline" size={compactLayout ? 17 : 19} color={colors.muted}/><Text style={[styles.searchText, compactLayout && styles.searchTextDense]}>{t('home.search')}</Text>
    </Pressable>

    {booking && <View style={[styles.bookingCard, compactLayout && styles.bookingCardDense]}>
      <Text style={[styles.bookingOverline, compactLayout && styles.bookingOverlineDense]}>{t('home.activeBooking')}</Text>
      <View style={styles.bookingMain}>
        <View style={styles.bookingCopy}>
          <Text style={[styles.bookingStep, compactLayout && styles.bookingStepDense]}>{booking.status === 'PENDING_APPROVAL' ? t('home.bookingPending') : t('home.bookingReady')}</Text>
          <Text style={[styles.bookingMeta, compactLayout && styles.bookingMetaDense]}>{booking.venueName || t('home.venueFallback')} · {prettyDate(booking.eventDate)} · {t('home.daysRemaining', { count: daysUntil(booking.eventDate) })}</Text>
        </View>
        {!!remaining && <Text style={[styles.bookingAmount, compactLayout && styles.bookingAmountDense]}>{formatCurrency(remaining, getAppLanguage())}</Text>}
      </View>
      <View style={styles.bookingActions}>
        <Pressable onPress={() => router.push('/bookings' as any)} style={[styles.goldButton, compactLayout && styles.actionButtonDense]}><Text style={[styles.goldButtonText, compactLayout && styles.actionTextDense]}>{t('home.openBooking')}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('home.callVenue')} disabled={!venuePhone} onPress={callVenue} style={({ pressed }) => [styles.darkOutlineButton, compactLayout && styles.actionButtonDense, !venuePhone && styles.disabledButton, pressed && styles.pressed]}><Text style={[styles.darkOutlineText, compactLayout && styles.actionTextDense]}>{t('home.callVenue')}</Text></Pressable>
      </View>
    </View>}

    <View style={[styles.findCard, compactLayout && styles.findCardDense]}>
      <Text style={[styles.findTitle, compactLayout && styles.findTitleDense]}>{t('home.findTitle')}</Text>
      <View style={styles.findFields}>
        <View style={styles.dateField}><DatePickerField label={t('common.date')} value={date} onChange={setDate} minDate={todayIso()} placeholder={t('common.date')}/></View>
        <View style={styles.guestField}><Field label={t('common.guests')} value={guests} onChangeText={value => setGuests(value.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="200"/></View>
      </View>
      <Button title={t('home.showAvailable')} disabled={!date || !Number(guests)} onPress={() => openVenues({ date, guests })}/>
    </View>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.quickChoices, compactLayout && styles.horizontalPaddingDense]} style={[styles.fullBleed, compactLayout && styles.fullBleedDense]}>
      {[
        [t('home.guestBand100'), '100', 'UP_TO_100'],
        [t('home.guestBand100_200'), '150', '100_200'],
        [t('home.guestBand200_300'), '250', '200_300'],
        [t('home.guestBand300'), '300', '300_PLUS']
      ].map(([label, value, band]) => <Pressable key={label} onPress={() => openVenues({ guests: value, guestBand: band })} style={({ pressed }) => [styles.quickChip, compactLayout && styles.quickChipDense, pressed && styles.pressed]}><Text style={[styles.quickChipText, compactLayout && styles.quickChipTextDense]}>{label}</Text></Pressable>)}
    </ScrollView>

    {!!selectedVenues.length && <View style={styles.section}>
      <SectionHeader title={t('home.selectedVenues')} onAll={() => openVenues()}/>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.horizontalCards, compactLayout && styles.horizontalPaddingDense]} style={[styles.fullBleed, compactLayout && styles.fullBleedDense]}>
        {selectedVenues.map(venue => <CompactVenueCard key={venue.id} venue={venue} selected favorite={favoriteIds.has(venue.id)} onPress={() => router.push(`/venue/${venue.id}` as any)} onFavorite={() => toggleFavorite(venue.id)}/>) }
      </ScrollView>
    </View>}

    {!!likedVenues.length && <View style={styles.section}>
      <SectionHeader title={t('home.mostLiked')} onAll={() => openVenues({ minRating: '4' })}/>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.horizontalCards, compactLayout && styles.horizontalPaddingDense]} style={[styles.fullBleed, compactLayout && styles.fullBleedDense]}>
        {likedVenues.map(venue => <CompactVenueCard key={venue.id} venue={venue} favorite={favoriteIds.has(venue.id)} onPress={() => router.push(`/venue/${venue.id}` as any)} onFavorite={() => toggleFavorite(venue.id)}/>) }
      </ScrollView>
    </View>}

  </Screen>;
}

const styles = StyleSheet.create({
  pressed: { opacity: .66 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 },
  greetingBlock: { flex: 1 },
  greeting: { color: colors.ink, fontSize: 23, lineHeight: 29, fontWeight: '700', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  greetingDense: { fontSize: 19, lineHeight: 24 },
  kicker: { color: colors.muted, fontSize: 10, marginTop: 2 },
  kickerDense: { fontSize: 9, marginTop: 0 },
  search: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  searchDense: { minHeight: 40, gap: 8, paddingHorizontal: 12, borderRadius: 12 },
  searchText: { color: colors.muted, fontSize: 13 },
  searchTextDense: { fontSize: 11 },
  bookingCard: { borderRadius: 17, padding: 13, gap: 10, backgroundColor: colors.ink },
  bookingCardDense: { borderRadius: 15, padding: 11, gap: 8 },
  bookingOverline: { color: '#F0D08B', fontSize: 9, fontWeight: '800' },
  bookingOverlineDense: { fontSize: 8 },
  bookingMain: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bookingCopy: { flex: 1, gap: 3 },
  bookingStep: { color: '#FFFCF6', fontSize: 14, fontWeight: '800' },
  bookingStepDense: { fontSize: 12 },
  bookingMeta: { color: '#D7D1C6', fontSize: 9, lineHeight: 13 },
  bookingMetaDense: { fontSize: 8, lineHeight: 11 },
  bookingAmount: { color: '#F0C66D', fontSize: 19, fontWeight: '800', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  bookingAmountDense: { fontSize: 16 },
  bookingActions: { flexDirection: 'row', gap: 8 },
  goldButton: { flex: 1, height: 39, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D8B45F' },
  goldButtonText: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  darkOutlineButton: { flex: 1, height: 39, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D8D2C7' },
  actionButtonDense: { height: 34, borderRadius: 18 },
  actionTextDense: { fontSize: 10 },
  disabledButton: { opacity: .45 },
  darkOutlineText: { color: '#FFFCF6', fontSize: 11, fontWeight: '800' },
  findCard: { padding: 11, gap: 9, borderRadius: 17, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  findCardDense: { padding: 9, gap: 7, borderRadius: 15 },
  findTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  findTitleDense: { fontSize: 14 },
  findFields: { flexDirection: 'row', gap: 8 },
  dateField: { flex: 1.15 },
  guestField: { flex: 1 },
  fullBleed: { marginHorizontal: -14 },
  fullBleedDense: { marginHorizontal: -11 },
  quickChoices: { gap: 8, paddingHorizontal: 14 },
  quickChip: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 13, borderRadius: 10, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  quickChipDense: { minHeight: 31, paddingHorizontal: 11, borderRadius: 9 },
  quickChipText: { color: colors.ink, fontSize: 10, fontWeight: '700' },
  quickChipTextDense: { fontSize: 9 },
  section: { gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 1 },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: '700', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  sectionTitleDense: { fontSize: 16 },
  allLink: { color: colors.brandDark, fontSize: 10, fontWeight: '700' },
  allLinkDense: { fontSize: 9 },
  horizontalCards: { gap: 10, paddingHorizontal: 14 },
  horizontalPaddingDense: { paddingHorizontal: 11 }
});
