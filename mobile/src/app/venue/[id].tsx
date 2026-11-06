import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { api } from '@/api';
import { useAuth } from '@/auth';
import type { Review, ReviewEligibility, ReviewSummary, VenueDetail } from '@/types';
import { Badge, Button, Card, Empty, Money, MoneyRange, Screen, SectionTitle, s, run } from '@/ui';
import { GalleryImage, ImageGallery } from '@/image-gallery';
import { colors } from '@/theme';
import { appLocale } from '@/format';
import { getAppLanguage } from '@/i18n';

const demoHallImages: GalleryImage[] = [require('../../../assets/demo-halls/small-hall.png'), require('../../../assets/demo-halls/grand-hall.png')];

export default function VenueDetails() {
  const { t } = useTranslation();
  const language = getAppLanguage();
  const { id } = useLocalSearchParams<{ id: string }>(); const venueId = Number(id);
  const { user } = useAuth();
  const [detail, setDetail] = useState<VenueDetail>(); const [reviews, setReviews] = useState<Review[]>([]); const [loading, setLoading] = useState(true);
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary>(); const [reviewSort, setReviewSort] = useState<'recent' | 'high' | 'low'>('recent');
  const [reviewEntry, setReviewEntry] = useState<ReviewEligibility>();
  const [favorite, setFavorite] = useState(false); const [favoriteBusy, setFavoriteBusy] = useState(false);
  const favoriteRevision = useRef(0);
  const load = useCallback(() => Promise.all([api.venue(venueId).then(setDetail), api.reviews(venueId, 0, 100).then(r => { setReviews(r.content || []); setReviewSummary(r.summary); })]), [venueId]);
  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);
  useFocusEffect(useCallback(() => {
    let active = true;
    const revision = favoriteRevision.current;
    api.favorites().then(result => { if (active && revision === favoriteRevision.current) setFavorite((result.content || []).some(venue => venue.id === venueId)); }).catch(() => {});
    return () => { active = false; };
  }, [venueId]));
  useFocusEffect(useCallback(() => {
    let active = true;
    if (user?.role === 'CUSTOMER') {
      api.venueReviewEligibility(venueId).then(result => { if (active) setReviewEntry(result); }).catch(() => { if (active) setReviewEntry(undefined); });
    }
    return () => { active = false; };
  }, [user?.role, venueId]));
  const toggleFavorite = async () => {
    if (favoriteBusy) return;
    const previous = favorite;
    favoriteRevision.current += 1;
    setFavorite(!previous);
    setFavoriteBusy(true);
    const success = await run(async () => { if (previous) await api.unfavorite(venueId); else await api.favorite(venueId); });
    if (!success) setFavorite(previous);
    setFavoriteBusy(false);
  };
  if (!detail) return <Screen loading={loading}><Empty text={t('venueDetails.notFound')}/></Screen>;
  const media: GalleryImage[] = detail.media?.filter(item => item.url && (item.hallId ?? item.hall_id) == null).map(item => ({ fullUri: item.url, previewUri: item.thumbUrl || item.thumb_url })) || [];
  if (detail.venue.slug?.startsWith('demo-')) media.push(...demoHallImages);
  const menuPrices = detail.menus?.map(menu => Number(menu.pricePerPerson)) || [];
  const menuPriceRange = menuPrices.length ? { min: Math.min(...menuPrices), max: Math.max(...menuPrices) } : undefined;
  const sortedReviews = [...reviews].sort((a, b) => reviewSort === 'high' ? b.rating - a.rating : reviewSort === 'low' ? a.rating - b.rating : new Date(b.createdAt || b.created_at || 0).getTime() - new Date(a.createdAt || a.created_at || 0).getTime());
  const openLocation = () => {
    const coordinate = `${detail.venue.latitude},${detail.venue.longitude}`;
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordinate)}`;
    const appleMapsUrl = `https://maps.apple.com/?ll=${encodeURIComponent(coordinate)}&q=${encodeURIComponent(detail.venue.name)}`;
    const openMap = (url: string) => { void run(() => Linking.openURL(url)); };

    if (Platform.OS !== 'ios') {
      openMap(googleMapsUrl);
      return;
    }

    ActionSheetIOS.showActionSheetWithOptions({
      title: t('venueDetails.openMap'),
      message: detail.venue.address,
      options: ['Apple Maps', 'Google Maps', t('common.cancel')],
      cancelButtonIndex: 2
    }, selectedIndex => {
      if (selectedIndex === 0) openMap(appleMapsUrl);
      if (selectedIndex === 1) openMap(googleMapsUrl);
    });
  };
  return <Screen loading={loading}>
    <ImageGallery images={media} label={detail.venue.name}/>
    <View style={s.titleRow}><View style={{ flex: 1 }}><Text style={s.title}>{detail.venue.name}</Text><Text style={s.subtitle}>{detail.venue.address}</Text></View><Text style={{ color: '#A06A17', fontWeight: '900', fontSize: 18 }}>★ {Number(detail.venue.rating || 0).toFixed(1)}</Text></View>
    <View style={s.actions}><Button title={t('bookingFlow.reserve')} onPress={() => router.push({ pathname: '/booking/new', params: { venueId } } as any)}/><Pressable accessibilityRole="button" accessibilityState={{ selected: favorite, busy: favoriteBusy }} disabled={favoriteBusy} onPress={() => void toggleFavorite()} style={({ pressed }) => [styles.favoriteButton, favorite && styles.favoriteButtonActive, (pressed || favoriteBusy) && { opacity: .6 }]}><Ionicons name={favorite ? 'heart' : 'heart-outline'} size={20} color={favorite ? colors.danger : colors.brandDark}/><Text style={[styles.favoriteText, favorite && styles.favoriteTextActive]}>{t('venueDetails.favorite')}</Text></Pressable></View>
    <SectionTitle>{t('venueDetails.address')}</SectionTitle>
    <Pressable accessibilityRole="link" accessibilityLabel={t('venueDetails.openVenueMap', { venue: detail.venue.name })} onPress={openLocation} style={({ pressed }) => [styles.locationCard, pressed && { opacity: .7 }]}>
      <View style={styles.locationIcon}><Ionicons name="location" size={22} color={colors.brandDark}/></View>
      <View style={styles.locationText}><Text style={styles.locationAddress}>{detail.venue.address}</Text>{detail.venue.city && <Text style={s.muted}>{detail.venue.city}</Text>}<Text style={styles.locationAction}>{t('venueDetails.openMap')}</Text></View>
      <Ionicons name="open-outline" size={20} color={colors.brandDark}/>
    </Pressable>
    {!!detail.description && <><SectionTitle>{t('venueDetails.about')}</SectionTitle><Text style={s.body}>{detail.description}</Text></>}
    {!!detail.amenities.length && <><SectionTitle>{t('venueDetails.amenities')}</SectionTitle><View style={s.chips}>{detail.amenities.map(a => <Badge key={a.id} value={(language === 'en' ? a.nameEn || a.name_en : language === 'ru' ? a.nameRu || a.name_ru : a.nameAz || a.name_az) || a.nameAz || a.name_az || a.name || a.code || String(a.id)}/>)}</View></>}
    {!!detail.menus?.length && <><SectionTitle>{t('venueDetails.menuPackages')}</SectionTitle><Text style={s.muted}>{t('venueDetails.menuHelp')}</Text>{detail.menus.map(menu => <Card key={menu.id} onPress={() => router.push({ pathname: '/booking/new', params: { venueId, menuPackageId: menu.id } } as any)}><View style={s.titleRow}><View style={{ flex: 1 }}><View style={s.actions}><Text style={s.h2}>{menu.name}</Text>{menu.popular && <Badge value={t('venueDetails.popular')}/>}</View><Text style={s.muted}>{menu.description}</Text></View><View><Money value={menu.pricePerPerson}/><Text style={[s.muted, { fontSize: 11, textAlign: 'right' }]}>{t('bookingFlow.perPerson')}</Text></View></View><View style={s.chips}>{menu.categories.map(category => <Badge key={category.id} value={t('venueDetails.categoryItems', { count: category.items.length, category: category.name.toLocaleLowerCase(appLocale(language)) })}/>)}</View><Text style={[s.label, { color: '#725526' }]}>{t('venueDetails.customizeMenu')} →</Text></Card>)}</>}
    <SectionTitle>{t('venueDetails.halls')}</SectionTitle>{detail.halls.length ? detail.halls.map(hall => <Card key={hall.id} onPress={() => router.push({ pathname: '/hall/[id]', params: { id: hall.id, venueId } } as any)}><View style={s.titleRow}><View style={{ flex: 1 }}><Text style={s.h2}>{hall.name}</Text><Text style={s.muted}>{t('venueDetails.guestRange', { min: hall.capacityMin, max: hall.capacityMax })}</Text></View>{menuPriceRange && <MoneyRange {...menuPriceRange}/>}</View><Text style={s.muted}>{menuPriceRange ? t('venueDetails.menuAndDeposit') : t('venueDetails.depositOnly')}</Text><Text style={[s.label, { color: '#725526' }]}>{t('venueDetails.viewHall')} →</Text></Card>) : <Empty text={t('venueDetails.noHalls')}/>} 
    {!!detail.services.length && <><SectionTitle>{t('venueDetails.services')}</SectionTitle>{detail.services.map(service => <Card key={service.id}><View style={s.titleRow}><View style={{ flex: 1 }}><Text style={s.h2}>{service.name}</Text><Text style={s.muted}>{service.description}</Text></View><Money value={service.price}/></View></Card>)}</>}
    <View style={styles.reviewHeader}><View style={{ flex: 1 }}><SectionTitle>{t('venueDetails.reviews')}</SectionTitle><Text style={styles.verifiedOnly}>{t('venueDetails.verifiedOnly')}</Text></View>{reviewEntry && <Button title={t(reviewEntry.editable ? 'venueDetails.editReview' : 'venueDetails.writeReview')} compact onPress={() => router.push({ pathname: '/review/[bookingId]', params: { bookingId: reviewEntry.bookingId } } as any)}/>}</View>
    {reviewSummary && reviewSummary.count > 0 ? <Card><View style={styles.reviewSummaryRow}><View style={styles.scoreBlock}><Text style={styles.reviewScore}>{Number(reviewSummary.ratingAvg).toFixed(1)}</Text><Text style={styles.reviewStars}>★★★★★</Text><Text style={styles.reviewCount}>{t('venueDetails.verifiedReviews', { count: reviewSummary.count })}</Text></View><View style={styles.distribution}>{[5, 4, 3, 2, 1].map(value => { const count = reviewSummary.distribution?.[String(value)] || 0; const width = reviewSummary.count ? `${Math.max(3, count / reviewSummary.count * 100)}%` as `${number}%` : '3%'; return <View key={value} style={styles.distributionRow}><Text style={styles.distributionLabel}>{value}</Text><View style={styles.barTrack}><View style={[styles.barFill, { width }]}/></View><Text style={styles.distributionCount}>{count}</Text></View>; })}</View></View><View style={styles.detailAverages}>{[[t('review.food'), reviewSummary.ratingFood], [t('review.service'), reviewSummary.ratingService], [t('review.hallCleanliness'), reviewSummary.ratingHall], [t('review.value'), reviewSummary.ratingValue]].map(([label, score]) => <View key={String(label)} style={styles.averageRow}><Text style={styles.averageLabel}>{label}</Text><View style={styles.averageTrack}><View style={[styles.averageFill, { width: `${score == null ? 0 : Number(score) / 5 * 100}%` as `${number}%` }]}/></View><Text style={styles.averageScore}>{score == null ? '—' : Number(score).toFixed(1)}</Text></View>)}</View></Card> : null}
    {!!reviews.length && <View style={styles.sortRow}>{([['recent', t('venueDetails.sortRecent')], ['high', t('venueDetails.sortHigh')], ['low', t('venueDetails.sortLow')]] as const).map(([value, label]) => <Pressable key={value} onPress={() => setReviewSort(value)} style={[styles.sortButton, reviewSort === value && styles.sortButtonActive]}><Text style={[styles.sortText, reviewSort === value && styles.sortTextActive]}>{label}</Text></Pressable>)}</View>}
    {sortedReviews.length ? sortedReviews.map(review => { const reply = review.ownerReply || review.reply || review.owner_reply; const created = review.createdAt || review.created_at; return <Card key={review.id}><View style={s.titleRow}><Text style={[s.h2, { flex: 1 }]}>{review.userName || review.user_name || t('venueDetails.customer')}</Text><Text style={s.muted}>{created ? new Date(created).toLocaleDateString(appLocale(language), { month: 'long', year: 'numeric' }) : ''}</Text></View><View style={styles.reviewMeta}><Text style={styles.reviewStarsSmall}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</Text><View style={styles.verifiedBadge}><Ionicons name="checkmark" size={12} color={colors.success}/><Text style={styles.verifiedText}>{t('venueDetails.verifiedWedding')}</Text></View></View><Text style={s.body}>{review.comment || t('venueDetails.noComment')}</Text>{reply && <View style={styles.ownerReply}><Text style={s.label}>{t('venueDetails.ownerReply')}</Text><Text style={s.body}>{reply}</Text></View>}</Card>; }) : <Empty text={t('venueDetails.noReviews')}/>} 
  </Screen>;
}

const styles = StyleSheet.create({
  favoriteButton: { minHeight: 52, paddingHorizontal: 20, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.softGold, borderWidth: 1, borderColor: colors.goldLight },
  favoriteButtonActive: { backgroundColor: '#F8EAE8', borderColor: '#E9C8C4' },
  favoriteText: { color: colors.brandDark, fontWeight: '800', fontSize: 15 },
  favoriteTextActive: { color: colors.danger },
  locationCard: { minHeight: 76, padding: 14, borderRadius: 17, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  locationIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softGold },
  locationText: { flex: 1, gap: 2 },
  locationAddress: { color: colors.ink, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  locationAction: { color: colors.brandDark, fontSize: 12, lineHeight: 17, fontWeight: '800' },
  reviewHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  verifiedOnly: { color: colors.muted, fontSize: 9, marginTop: 2 },
  reviewSummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  scoreBlock: { width: 100, alignItems: 'center', borderRightWidth: 1, borderRightColor: colors.line, paddingRight: 12 },
  reviewScore: { color: colors.ink, fontFamily: 'serif', fontWeight: '800', fontSize: 38 },
  reviewStars: { color: colors.brandDark, fontSize: 10, letterSpacing: 1 },
  reviewCount: { color: colors.muted, fontSize: 8, marginTop: 3 },
  distribution: { flex: 1, gap: 3 },
  distributionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  distributionLabel: { width: 8, color: colors.brandDark, fontSize: 9, fontWeight: '700' },
  distributionCount: { width: 18, color: colors.muted, fontSize: 9, textAlign: 'right' },
  barTrack: { flex: 1, height: 4, borderRadius: 3, backgroundColor: colors.line, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 3, backgroundColor: colors.brand },
  detailAverages: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 9, gap: 5 },
  averageRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  averageLabel: { width: 96, color: colors.muted, fontSize: 9 },
  averageTrack: { flex: 1, height: 4, borderRadius: 3, backgroundColor: colors.line, overflow: 'hidden' },
  averageFill: { height: 4, borderRadius: 3, backgroundColor: colors.gold },
  averageScore: { width: 24, color: colors.ink, fontSize: 9, fontWeight: '700', textAlign: 'right' },
  sortRow: { flexDirection: 'row', borderRadius: 9, padding: 2, backgroundColor: colors.softGold },
  sortButton: { flex: 1, minHeight: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 7 },
  sortButtonActive: { backgroundColor: colors.brand },
  sortText: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  sortTextActive: { color: '#FFFDF8' },
  reviewMeta: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  reviewStarsSmall: { color: colors.brandDark, fontWeight: '800', letterSpacing: 1 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: colors.softGold, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  verifiedText: { color: colors.success, fontSize: 8, fontWeight: '700' },
  ownerReply: { backgroundColor: colors.softGold, padding: 11, borderLeftWidth: 2, borderLeftColor: colors.gold, borderRadius: 7 }
});
