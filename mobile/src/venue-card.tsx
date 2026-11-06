import { Image, Platform, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Venue } from '@/types';
import { colors, useCompactAndroidLayout } from '@/theme';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '@/format';
import { getAppLanguage } from '@/i18n';

function ratingOf(venue: Venue) {
  return Number(venue.rating ?? venue.ratingAvg ?? venue.rating_avg ?? 0).toFixed(1);
}

function capacityOf(venue: Venue, t: (key: string, options?: Record<string, unknown>) => string) {
  if (venue.capacityMin && venue.capacityMax) return t('venueCard.capacityRange', { min: venue.capacityMin, max: venue.capacityMax });
  if (venue.capacityMax) return t('venueCard.capacityMax', { max: venue.capacityMax });
  return t('venueCard.capacityPending');
}

function priceOf(venue: Venue, t: (key: string, options?: Record<string, unknown>) => string) {
  return venue.minPricePerPerson ? t('venueCard.priceFrom', { price: formatCurrency(venue.minPricePerPerson, getAppLanguage()) }) : t('venueCard.viewPrice');
}

function VenueArtwork({ venue, style }: { venue: Venue; style?: StyleProp<ViewStyle> }) {
  return venue.coverImageUrl
    ? <Image source={{ uri: venue.coverImageUrl }} style={[styles.image, style as any]}/>
    : <View style={[styles.image, styles.placeholder, style]}><Ionicons name="business-outline" size={30} color={colors.brandDark}/></View>;
}

export function CompactVenueCard({ venue, selected, favorite, onPress, onFavorite }: {
  venue: Venue;
  selected?: boolean;
  favorite: boolean;
  onPress: () => void;
  onFavorite: () => void;
}) {
  const { t } = useTranslation();
  const compactLayout = useCompactAndroidLayout();
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.compactCard, compactLayout && styles.compactCardDense, pressed && styles.pressed]}>
    <View>
      <VenueArtwork venue={venue} style={[styles.compactImage, compactLayout && styles.compactImageDense]}/>
      {selected && <View style={styles.selectedBadge}><Text style={styles.selectedText}>{t('venueCard.selected')}</Text></View>}
      <Pressable accessibilityRole="button" accessibilityLabel={t(favorite ? 'favorites.remove' : 'favorites.add')} accessibilityState={{ selected: favorite }} hitSlop={8} onPress={event => { event.stopPropagation(); onFavorite(); }} style={styles.compactHeart}>
        <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={17} color={favorite ? colors.danger : colors.brandDark}/>
      </Pressable>
    </View>
    <View style={[styles.compactBody, compactLayout && styles.compactBodyDense]}>
      <Text numberOfLines={1} style={[styles.compactTitle, compactLayout && styles.compactTitleDense]}>{venue.name}</Text>
      <Text numberOfLines={1} style={[styles.compactAddress, compactLayout && styles.compactAddressDense]}>{venue.address}</Text>
      <View style={styles.compactMeta}><Text style={[styles.rating, compactLayout && styles.ratingDense]}>★ {ratingOf(venue)}</Text><Text numberOfLines={1} style={[styles.price, compactLayout && styles.priceDense]}>{priceOf(venue, t)}</Text></View>
    </View>
  </Pressable>;
}

export function VenueListCard({ venue, favorite, onPress, onFavorite, available }: {
  venue: Venue;
  favorite: boolean;
  onPress: () => void;
  onFavorite: () => void;
  available?: boolean;
}) {
  const { t } = useTranslation();
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.listCard, pressed && styles.pressed]}>
    <VenueArtwork venue={venue} style={styles.listImage}/>
    <View style={styles.listBody}>
      <View style={styles.listTitleRow}>
        <Text numberOfLines={1} style={styles.listTitle}>{venue.name}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t(favorite ? 'favorites.remove' : 'favorites.add')} accessibilityState={{ selected: favorite }} hitSlop={10} onPress={event => { event.stopPropagation(); onFavorite(); }}>
          <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={20} color={favorite ? colors.danger : colors.brandDark}/>
        </Pressable>
      </View>
      <Text numberOfLines={1} style={styles.address}>{venue.address}</Text>
      <Text style={styles.info}><Text style={styles.rating}>★ {ratingOf(venue)}</Text> ({t('favorites.reviews', { count: venue.reviewCount || 0 })})</Text>
      <View style={styles.listMeta}><Text numberOfLines={1} style={styles.capacity}>{capacityOf(venue, t)}</Text><Text numberOfLines={1} style={styles.listPrice}>{priceOf(venue, t)}</Text></View>
      {available && <View style={styles.available}><Text style={styles.availableText}>{t('venueCard.available')}</Text></View>}
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  pressed: { opacity: .72 },
  image: { backgroundColor: '#E9D9AD' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  compactCard: { width: 166, overflow: 'hidden', borderRadius: 16, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  compactCardDense: { width: 145, borderRadius: 14 },
  compactImage: { width: '100%', height: 104 },
  compactImageDense: { height: 85 },
  selectedBadge: { position: 'absolute', left: 8, top: 8, borderRadius: 9, backgroundColor: colors.brand, paddingHorizontal: 8, paddingVertical: 4 },
  selectedText: { color: '#FFFDF8', fontSize: 9, fontWeight: '800' },
  compactHeart: { position: 'absolute', right: 7, top: 7, width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,253,248,.88)' },
  compactBody: { padding: 9, gap: 3 },
  compactBodyDense: { padding: 7, gap: 2 },
  compactTitle: { color: colors.ink, fontSize: 14, fontWeight: '700', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  compactTitleDense: { fontSize: 12 },
  compactAddress: { color: colors.muted, fontSize: 10 },
  compactAddressDense: { fontSize: 9 },
  compactMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginTop: 2 },
  rating: { color: colors.brandDark, fontSize: 11, fontWeight: '800' },
  ratingDense: { fontSize: 9 },
  price: { flex: 1, color: colors.ink, fontSize: 9, fontWeight: '700', textAlign: 'right' },
  priceDense: { fontSize: 8 },
  listCard: { minHeight: 128, flexDirection: 'row', gap: 11, padding: 10, borderRadius: 17, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  listImage: { width: 92, height: 108, borderRadius: 14 },
  listBody: { flex: 1, paddingVertical: 3, gap: 5 },
  listTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  listTitle: { flex: 1, color: colors.ink, fontSize: 17, fontWeight: '700', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  address: { color: colors.muted, fontSize: 11 },
  info: { color: colors.muted, fontSize: 11 },
  listMeta: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  capacity: { flex: 1, color: colors.ink, fontSize: 11 },
  listPrice: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  available: { alignSelf: 'flex-start', borderRadius: 10, backgroundColor: '#E8EFDC', paddingHorizontal: 9, paddingVertical: 4 },
  availableText: { color: '#65753E', fontSize: 10, fontWeight: '700' }
});
