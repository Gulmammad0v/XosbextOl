import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api';
import type { Venue } from '@/types';
import { Button, Chips, Empty, Field, FormModal, Screen, run, s } from '@/ui';
import { DatePickerField, todayIso } from '@/date-picker';
import { colors } from '@/theme';
import { VenueListCard } from '@/venue-card';
import { useTranslation } from 'react-i18next';
import { appLocale, formatCurrency, formatDate } from '@/format';
import { getAppLanguage } from '@/i18n';

type SearchValues = {
  q?: string;
  city?: string;
  guests?: string;
  date?: string;
  minPrice?: string;
  maxPrice?: string;
  minRating?: string;
};

const guestBandKeys: Record<string, string> = {
  UP_TO_100: 'home.guestBand100',
  '100_200': 'home.guestBand100_200',
  '200_300': 'home.guestBand200_300',
  '300_PLUS': 'home.guestBand300'
};

function scalar(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

type SortField = 'rating' | 'price';
type SortDirection = 'asc' | 'desc';

export default function VenuesScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ q?: string; city?: string; guests?: string; date?: string; minRating?: string; guestBand?: string }>();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [favoriteBusy, setFavoriteBusy] = useState<Set<number>>(new Set());
  const favoriteRevision = useRef(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [guests, setGuests] = useState('');
  const [date, setDate] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState('');
  const [guestBand, setGuestBand] = useState('');
  const [sortField, setSortField] = useState<SortField>('rating');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const fetchVenues = useCallback(async (values: SearchValues) => {
    const result = await api.venues({
      q: values.q?.trim() || undefined,
      city: values.city || undefined,
      guests: values.guests ? Number(values.guests) : undefined,
      date: values.date || undefined,
      minPrice: values.minPrice ? Number(values.minPrice) : undefined,
      maxPrice: values.maxPrice ? Number(values.maxPrice) : undefined,
      minRating: values.minRating ? Number(values.minRating) : undefined,
      size: 100
    });
    setVenues(result.content || []);
  }, []);

  useEffect(() => {
    const nextQ = scalar(params.q) || '';
    const nextCity = scalar(params.city) || '';
    const nextGuests = scalar(params.guests) || '';
    const nextDate = scalar(params.date) || '';
    const nextRating = scalar(params.minRating) || '';
    const nextBand = scalar(params.guestBand) || '';
    setQ(nextQ);
    setCity(nextCity);
    setGuests(nextGuests);
    setDate(nextDate);
    setMinRating(nextRating);
    setGuestBand(nextBand);
    Promise.allSettled([
      fetchVenues({ q: nextQ, city: nextCity, guests: nextGuests, date: nextDate, minRating: nextRating }),
      api.catalog<string[]>('cities').then(setCities)
    ]).finally(() => setLoading(false));
  }, [fetchVenues, params.q, params.city, params.guests, params.date, params.minRating, params.guestBand]);

  useFocusEffect(useCallback(() => {
    let active = true;
    const revision = favoriteRevision.current;
    api.favorites().then(result => {
      if (active && revision === favoriteRevision.current) setFavoriteIds(new Set((result.content || []).map(venue => venue.id)));
    }).catch(() => {});
    return () => { active = false; };
  }, []));

  const values = (): SearchValues => ({ q, city, guests, date, minPrice, maxPrice, minRating });
  const search = () => run(async () => { setRefreshing(true); try { await fetchVenues(values()); } finally { setRefreshing(false); } });
  const applyFilters = () => run(async () => {
    setRefreshing(true);
    try { await fetchVenues(values()); setFilterOpen(false); }
    finally { setRefreshing(false); }
  });
  const clearFilters = () => {
    setCity(''); setGuests(''); setDate(''); setMinPrice(''); setMaxPrice(''); setMinRating(''); setGuestBand('');
  };
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
  const removeChip = (type: 'city' | 'guests' | 'date' | 'price' | 'rating') => {
    const next = values();
    if (type === 'city') { setCity(''); next.city = ''; }
    if (type === 'guests') { setGuests(''); setGuestBand(''); next.guests = ''; }
    if (type === 'date') { setDate(''); next.date = ''; }
    if (type === 'price') { setMinPrice(''); setMaxPrice(''); next.minPrice = ''; next.maxPrice = ''; }
    if (type === 'rating') { setMinRating(''); next.minRating = ''; }
    void fetchVenues(next);
  };

  const changeSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(value => value === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortField(field);
    setSortDirection(field === 'rating' ? 'desc' : 'asc');
  };

  const sortedVenues = useMemo(() => [...venues].sort((a, b) => {
    if (sortField === 'price') {
      const aPrice = a.minPricePerPerson == null ? null : Number(a.minPricePerPerson);
      const bPrice = b.minPricePerPerson == null ? null : Number(b.minPricePerPerson);
      if (aPrice == null && bPrice == null) return a.name.localeCompare(b.name, appLocale(getAppLanguage()));
      if (aPrice == null) return 1;
      if (bPrice == null) return -1;
      const difference = aPrice - bPrice;
      return sortDirection === 'asc' ? difference : -difference;
    }
    const difference = Number(a.rating || 0) - Number(b.rating || 0);
    return sortDirection === 'asc' ? difference : -difference;
  }), [sortDirection, sortField, venues]);

  const filterCount = [city, guests, date, minPrice || maxPrice, minRating].filter(Boolean).length;

  return <Screen loading={loading} refreshing={refreshing} onRefresh={search}>
    <View style={styles.pageHeading}><Text style={styles.title}>{t('venues.title')}</Text><Text style={styles.subtitle}>{t('venues.found', { count: venues.length })}</Text></View>
    <View style={styles.searchRow}>
      <View style={styles.searchField}><Field label="" icon="search-outline" value={q} onChangeText={setQ} placeholder={t('venues.search')} returnKeyType="search" onSubmitEditing={search}/></View>
      <Pressable accessibilityRole="button" accessibilityLabel={t('venues.filterAccessibility')} onPress={() => { setCityOpen(false); setFilterOpen(true); }} style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}>
        <Ionicons name="options-outline" size={22} color="#fff"/>
        {!!filterCount && <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{filterCount}</Text></View>}
      </Pressable>
    </View>

    {!!filterCount && <View style={styles.activeFilters}>
      {!!city && <FilterChip label={city} onRemove={() => removeChip('city')}/>} 
      {!!guests && <FilterChip label={guestBandKeys[guestBand] ? t(guestBandKeys[guestBand]) : t('booking.guest', { count: Number(guests) })} onRemove={() => removeChip('guests')}/>} 
      {!!date && <FilterChip label={formatDate(`${date}T12:00:00`, getAppLanguage(), { day: 'numeric', month: 'short', year: 'numeric' })} onRemove={() => removeChip('date')}/>} 
      {!!(minPrice || maxPrice) && <FilterChip label={`${formatCurrency(Number(minPrice || 0), getAppLanguage())}–${maxPrice ? formatCurrency(Number(maxPrice), getAppLanguage()) : '∞'}`} onRemove={() => removeChip('price')}/>} 
      {!!minRating && <FilterChip label={`${minRating}+ ★`} onRemove={() => removeChip('rating')}/>} 
    </View>}

    <View style={styles.sortRow}>
      <Text style={styles.sortText}>{t('venues.sort')}</Text>
      <SortButton label={t('common.rating')} active={sortField === 'rating'} direction={sortDirection} onPress={() => changeSort('rating')}/>
      <SortButton label={t('venues.menuPrice')} active={sortField === 'price'} direction={sortDirection} onPress={() => changeSort('price')}/>
    </View>
    {!sortedVenues.length ? <Empty text={t('venues.empty')}/> : sortedVenues.map(venue => <VenueListCard key={venue.id} venue={venue} favorite={favoriteIds.has(venue.id)} available={!!date} onPress={() => router.push(`/venue/${venue.id}` as any)} onFavorite={() => toggleFavorite(venue.id)}/>) }

    <FormModal visible={filterOpen} title={cityOpen ? t('venues.chooseCity') : t('venues.filters')} closeTitle={cityOpen ? t('common.back') : t('common.close')} onClose={() => cityOpen ? setCityOpen(false) : setFilterOpen(false)}>
      {cityOpen ? <>
        {['', ...cities].map(value => <Pressable key={value || 'all'} accessibilityRole="radio" accessibilityState={{ selected: city === value }} onPress={() => { setCity(value); setCityOpen(false); }} style={[styles.cityOption, city === value && styles.cityOptionSelected]}>
          <Text style={[styles.cityOptionText, city === value && styles.cityOptionTextSelected]}>{value || t('venues.allCities')}</Text>
          {city === value && <Ionicons name="checkmark" size={18} color="#fff"/>}
        </Pressable>)}
      </> : <>
        <Pressable accessibilityRole="button" onPress={clearFilters} style={styles.clearButton}><Text style={styles.clearText}>{t('common.reset')}</Text></Pressable>
        <DatePickerField label={t('common.date')} value={date} onChange={setDate} minDate={todayIso()} placeholder={t('common.date')}/>
        <Text style={s.label}>{t('common.guests')}</Text>
        <Chips options={[
          { value: '', label: t('common.all') },
          { value: '100', label: t('home.guestBand100') },
          { value: '150', label: t('home.guestBand100_200') },
          { value: '250', label: t('home.guestBand200_300') },
          { value: '300', label: t('home.guestBand300') }
        ]} value={guests} onChange={(value: string) => { setGuests(value); setGuestBand(value === '100' ? 'UP_TO_100' : value === '150' ? '100_200' : value === '250' ? '200_300' : value === '300' ? '300_PLUS' : ''); }}/>
        <Text style={s.label}>{t('common.city')}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('venues.chooseCity')} onPress={() => setCityOpen(true)} style={({ pressed }) => [styles.selectField, pressed && styles.pressed]}>
          <Text style={styles.selectValue}>{city || t('venues.allCities')}</Text><Ionicons name="chevron-down" size={16} color={colors.brandDark}/>
        </Pressable>
        <View style={styles.priceFields}><View style={styles.half}><Field label={t('venues.minMenuPrice')} value={minPrice} onChangeText={value => setMinPrice(value.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="30 ₼"/></View><View style={styles.half}><Field label={t('venues.maxMenuPrice')} value={maxPrice} onChangeText={value => setMaxPrice(value.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="50 ₼"/></View></View>
        <Text style={s.label}>{t('common.rating')}</Text>
        <Chips options={['', '4', '4.5'].map(value => ({ value, label: value ? `${value}+` : t('common.all') }))} value={minRating} onChange={setMinRating}/>
        <Button title={t('venues.show')} onPress={applyFilters}/>
      </>}
    </FormModal>
  </Screen>;
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  const { t } = useTranslation();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${t('common.close')}: ${label}`} onPress={onRemove} style={styles.activeChip}><Text style={styles.activeChipText}>{label}</Text><Ionicons name="close" size={13} color={colors.brandDark}/></Pressable>;
}

function SortButton({ label, active, direction, onPress }: { label: string; active: boolean; direction: SortDirection; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.sortButton, active && styles.sortButtonActive, pressed && styles.pressed]}>
    <Text style={[styles.sortButtonText, active && styles.sortButtonTextActive]}>{label}</Text>
    {active && <Ionicons name={direction === 'asc' ? 'arrow-up' : 'arrow-down'} size={13} color="#fff"/>}
  </Pressable>;
}

const styles = StyleSheet.create({
  pressed: { opacity: .64 },
  pageHeading: { alignItems: 'center' },
  title: { color: colors.ink, fontSize: 29, lineHeight: 35, fontWeight: '700', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  subtitle: { color: colors.muted, fontSize: 11, marginTop: 2, textAlign: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 9 },
  searchField: { flex: 1 },
  filterButton: { width: 50, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  filterBadge: { position: 'absolute', right: -4, top: -6, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.danger },
  filterBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  activeFilters: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  activeChip: { minHeight: 33, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, borderRadius: 11, backgroundColor: '#FBF4E6', borderWidth: 1, borderColor: colors.goldLight },
  activeChipText: { color: colors.brandDark, fontSize: 10, fontWeight: '700' },
  sortRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7 },
  sortText: { color: colors.ink, fontSize: 12 },
  sortButton: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 11, borderRadius: 11, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.brand },
  sortButtonActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  sortButtonText: { color: colors.brand, fontSize: 10, fontWeight: '700' },
  sortButtonTextActive: { color: '#fff' },
  clearButton: { position: 'absolute', right: 0, top: -49, zIndex: 2, padding: 8 },
  clearText: { color: colors.brandDark, fontSize: 12, fontWeight: '700' },
  selectField: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  selectValue: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  cityOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  cityOptionSelected: { borderColor: colors.brand, backgroundColor: colors.brand },
  cityOptionText: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  cityOptionTextSelected: { color: '#fff' },
  priceFields: { flexDirection: 'row', gap: 9 },
  half: { flex: 1 }
});
