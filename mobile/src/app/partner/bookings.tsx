import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '@/api';
import { PartnerBottomNav } from '@/partner-nav';
import { PartnerVenueSelector } from '@/partner-venue-selector';
import { colors } from '@/theme';
import { labels, type Booking, type Venue, type VenueDetail } from '@/types';
import { Button, Field, FormModal, confirm, run, s } from '@/ui';
import { useTranslation } from 'react-i18next';
import { appLocale, formatCurrency, formatDate } from '@/format';
import { getAppLanguage } from '@/i18n';

type Filters = { hallId: string; menuPackageId: string; status: string };
type StatusTab = '' | 'PENDING_APPROVAL' | 'CONFIRMED' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';

const emptyFilters: Filters = { hallId: '', menuPackageId: '', status: '' };
const filterStatuses = ['PENDING_APPROVAL', 'CONFIRMED', 'COMPLETED', 'REJECTED', 'CANCELLED'];

function monthValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function moveMonth(value: string, amount: number) {
  const [year, month] = value.split('-').map(Number);
  return monthValue(new Date(year, month - 1 + amount, 1));
}

function monthLabel(value: string) {
  const [year, month] = value.split('-').map(Number);
  const locale = appLocale(getAppLanguage());
  const label = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
  return label.charAt(0).toLocaleUpperCase(locale) + label.slice(1);
}

function matchesTab(item: Booking, tab: StatusTab) {
  if (!tab) return true;
  return item.status === tab;
}

function filterBookings(items: Booking[], filters: Filters, tab: StatusTab, search = '') {
  const locale = appLocale(getAppLanguage());
  const term = search.trim().toLocaleLowerCase(locale);
  return items.filter(item => {
    const searchable = `${item.customerName || ''} ${item.bookingNumber || ''}`.toLocaleLowerCase(locale);
    return (!term || searchable.includes(term))
      && (!filters.hallId || String(item.hallId) === filters.hallId)
      && (!filters.menuPackageId || String(item.menuPackageId) === filters.menuPackageId)
      && (!filters.status || item.status === filters.status)
      && matchesTab(item, tab);
  }).sort((a, b) => a.eventDate.localeCompare(b.eventDate));
}

export default function PartnerBookings() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ venueId: string; name?: string }>();
  const venueId = Number(params.venueId);
  const [detail, setDetail] = useState<VenueDetail>();
  const [items, setItems] = useState<Booking[]>([]);
  const [month, setMonth] = useState(monthValue());
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<StatusTab>('');
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [rejecting, setRejecting] = useState<Booking>();
  const [rejectionReason, setRejectionReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [venue, firstPage] = await Promise.all([
      api.partnerVenue(venueId),
      api.partnerBookings(venueId, { month, size: 100 }),
    ]);
    const remaining = firstPage.totalPages > 1
      ? await Promise.all(Array.from({ length: firstPage.totalPages - 1 }, (_, index) => api.partnerBookings(venueId, { month, page: index + 1, size: 100 })))
      : [];
    setDetail(venue);
    setItems([...(firstPage.content || []), ...remaining.flatMap(page => page.content || [])]);
  }, [month, venueId]);

  useEffect(() => {
    setLoading(true);
    void run(load).finally(() => setLoading(false));
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    try { await run(load); } finally { setRefreshing(false); }
  };

  const approve = (booking: Booking) => confirm(
    t('partner.approveTitle'),
    t('partner.approveMessage', { date: formatDate(`${booking.eventDate}T12:00:00`, getAppLanguage(), { day: 'numeric', month: 'long', year: 'numeric' }) }),
    () => { void run(async () => { await api.approveBooking(booking.id); await load(); }, t('partner.approveSuccess')); },
  );

  const reject = () => run(async () => {
    if (!rejecting) return;
    await api.rejectBooking(rejecting.id, rejectionReason.trim());
    setRejecting(undefined);
    setRejectionReason('');
    await load();
  }, t('partner.rejectSuccess'));

  const totals = useMemo(() => items.reduce((value, item) => ({
    guests: value.guests + Number(item.guestCount || 0),
    total: value.total + Number(item.totalPrice || 0),
    deposit: value.deposit + Number(item.depositAmount || 0),
  }), { guests: 0, total: 0, deposit: 0 }), [items]);

  const counts = useMemo(() => ({
    all: items.length,
    waiting: items.filter(item => matchesTab(item, 'PENDING_APPROVAL')).length,
    confirmed: items.filter(item => matchesTab(item, 'CONFIRMED')).length,
    completed: items.filter(item => matchesTab(item, 'COMPLETED')).length,
    rejected: items.filter(item => matchesTab(item, 'REJECTED')).length,
    cancelled: items.filter(item => matchesTab(item, 'CANCELLED')).length,
  }), [items]);

  const visibleItems = useMemo(() => filterBookings(items, filters, activeTab, search), [activeTab, filters, items, search]);
  const draftCount = useMemo(() => filterBookings(items, draft, '', search).length, [draft, items, search]);
  const activeFilterCount = [filters.hallId, filters.menuPackageId, filters.status].filter(Boolean).length;

  const openFilters = () => {
    setDraft(filters);
    setFilterOpen(true);
  };

  const selectTab = (tab: StatusTab) => {
    setActiveTab(tab);
    if (filters.status) setFilters(value => ({ ...value, status: '' }));
  };

  const selectVenue = (venue: Venue) => {
    setDetail(undefined);
    setItems([]);
    setFilters(emptyFilters);
    setDraft(emptyFilters);
    setActiveTab('');
    setSearch('');
    setLoading(true);
    router.setParams({ venueId: String(venue.id), name: venue.name });
  };

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.loading}><ActivityIndicator color={colors.brand} size="large"/><Text style={styles.muted}>{t('common.loading')}</Text></View></SafeAreaView>;

  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
    <ScrollView
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.screen}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.brand}/>}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{t('partner.title')}</Text>
        <PartnerVenueSelector venueId={venueId} venueName={params.name || detail?.venue.name} onSelect={selectVenue}/>
      </View>

      <View style={styles.monthRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('partner.previousMonth')} onPress={() => setMonth(value => moveMonth(value, -1))} style={styles.monthButton}>
          <Ionicons name="chevron-back" size={16} color={colors.ink}/>
        </Pressable>
        <View style={styles.monthCenter}>
          <Text style={styles.monthTitle}>{monthLabel(month)}</Text>
          <Pressable disabled={month === monthValue()} onPress={() => setMonth(monthValue())}>
            <Text style={styles.currentMonth}>{month === monthValue() ? t('partner.currentMonth') : t('partner.returnCurrentMonth')}</Text>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('partner.nextMonth')} onPress={() => setMonth(value => moveMonth(value, 1))} style={styles.monthButton}>
          <Ionicons name="chevron-forward" size={16} color={colors.ink}/>
        </Pressable>
      </View>

      <View style={styles.metrics}>
        <Metric value={counts.all} label={t('partner.reservation')}/>
        <Metric value={formatNumber(totals.guests)} label={t('partner.guestsMetric')} bordered/>
        <Metric value={formatCurrency(totals.total, getAppLanguage())} label={t('partner.order')} bordered/>
        <Metric value={formatCurrency(totals.deposit, getAppLanguage())} label={t('partner.deposit')} bordered/>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={colors.muted}/>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('partner.search')}
            placeholderTextColor="#918A80"
            returnKeyType="search"
            style={styles.searchInput}
          />
          {!!search && <Pressable accessibilityRole="button" accessibilityLabel={t('partner.clear')} onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={17} color={colors.muted}/>
          </Pressable>}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('venues.filterAccessibility')} onPress={openFilters} style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}>
          <Ionicons name="options-outline" size={21} color="#fff"/>
          {activeFilterCount > 0 && <View style={styles.filterCount}><Text style={styles.filterCountText}>{activeFilterCount}</Text></View>}
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        <StatusTabButton label={t('common.all')} count={counts.all} active={activeTab === ''} onPress={() => selectTab('')}/>
        <StatusTabButton label={t('labels.PENDING_APPROVAL')} count={counts.waiting} active={activeTab === 'PENDING_APPROVAL'} onPress={() => selectTab('PENDING_APPROVAL')}/>
        <StatusTabButton label={t('labels.CONFIRMED')} count={counts.confirmed} active={activeTab === 'CONFIRMED'} onPress={() => selectTab('CONFIRMED')}/>
        <StatusTabButton label={t('labels.COMPLETED')} count={counts.completed} active={activeTab === 'COMPLETED'} onPress={() => selectTab('COMPLETED')}/>
        <StatusTabButton label={t('labels.REJECTED')} count={counts.rejected} active={activeTab === 'REJECTED'} onPress={() => selectTab('REJECTED')}/>
        <StatusTabButton label={t('labels.CANCELLED')} count={counts.cancelled} active={activeTab === 'CANCELLED'} onPress={() => selectTab('CANCELLED')}/>
      </ScrollView>

      {activeFilterCount > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeFilters}>
        {!!filters.hallId && <ActiveFilter label={detail?.halls.find(hall => String(hall.id) === filters.hallId)?.name || t('common.hall')} onRemove={() => setFilters(value => ({ ...value, hallId: '' }))}/>} 
        {!!filters.menuPackageId && <ActiveFilter label={detail?.menus.find(menu => String(menu.id) === filters.menuPackageId)?.name || t('common.menu')} onRemove={() => setFilters(value => ({ ...value, menuPackageId: '' }))}/>} 
        {!!filters.status && <ActiveFilter label={t(`labels.${filters.status}`, { defaultValue: labels[filters.status] })} onRemove={() => setFilters(value => ({ ...value, status: '' }))}/>} 
        <Pressable onPress={() => setFilters(emptyFilters)} style={styles.clearButton}><Text style={styles.clearText}>{t('partner.clear')}</Text></Pressable>
      </ScrollView>}

      <View style={styles.list}>
        {!visibleItems.length ? <View style={styles.empty}><Text style={styles.emptyIcon}>◇</Text><Text style={styles.muted}>{t('partner.emptyBookings')}</Text></View> : visibleItems.map(item => <ReservationCard
          key={item.id}
          booking={item}
          onOpen={() => router.push({ pathname: '/partner/booking-detail', params: { venueId, bookingId: item.id, name: params.name } } as any)}
          onApprove={() => approve(item)}
          onReject={() => { setRejecting(item); setRejectionReason(''); }}
        />)}
      </View>
    </ScrollView>

    <PartnerBottomNav venueId={venueId} hallId={detail?.halls[0]?.id} venueName={params.name || detail?.venue.name}/>

    <FilterSheet
      visible={filterOpen}
      detail={detail}
      items={items}
      value={draft}
      resultCount={draftCount}
      onChange={setDraft}
      onReset={() => setDraft(emptyFilters)}
      onClose={() => setFilterOpen(false)}
      onApply={() => { setFilters(draft); setActiveTab(''); setFilterOpen(false); }}
    />

    <FormModal visible={!!rejecting} title={t('partner.rejectTitle')} onClose={() => setRejecting(undefined)}>
      <Text style={s.muted}>{t('partner.rejectInfo')}</Text>
      <Field label={t('partner.rejectReason')} value={rejectionReason} onChangeText={setRejectionReason} multiline maxLength={500}/>
      <Button title={t('partner.rejectAction')} variant="danger" onPress={reject} disabled={!rejectionReason.trim()}/>
    </FormModal>
  </SafeAreaView>;
}

function Metric({ value, label, bordered }: { value: string | number; label: string; bordered?: boolean }) {
  return <View style={[styles.metric, bordered && styles.metricBorder]}><Text numberOfLines={1} adjustsFontSizeToFit style={styles.metricValue}>{value}</Text><Text numberOfLines={1} style={styles.metricLabel}>{label}</Text></View>;
}

function StatusTabButton({ label, count, active, onPress }: { label: string; count: number; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}><Text style={[styles.tabText, active && styles.tabTextActive]}>{label} <Text style={styles.tabCount}>{count}</Text></Text></Pressable>;
}

function ActiveFilter({ label, onRemove }: { label: string; onRemove: () => void }) {
  const { t } = useTranslation();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${t('common.close')}: ${label}`} onPress={onRemove} style={styles.activeFilter}>
    <Text style={styles.activeFilterText}>{label}</Text><Ionicons name="close" size={12} color={colors.brandDark}/>
  </Pressable>;
}

function ReservationCard({ booking, onOpen, onApprove, onReject }: { booking: Booking; onOpen: () => void; onApprove: () => void; onReject: () => void }) {
  const { t } = useTranslation();
  const date = new Date(`${booking.eventDate}T12:00:00`);
  const locale = appLocale(getAppLanguage());
  const day = new Intl.DateTimeFormat(locale, { day: '2-digit' }).format(date);
  const month = new Intl.DateTimeFormat(locale, { month: 'short' }).format(date).replace('.', '').toLocaleUpperCase(locale);
  return <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.bookingCard, pressed && styles.cardPressed]}>
    <View style={styles.bookingMain}>
      <View style={styles.dateBox}><Text style={styles.dateDay}>{day}</Text><Text style={styles.dateMonth}>{month}</Text></View>
      <View style={styles.bookingInfo}>
        <View style={styles.nameRow}><Text numberOfLines={1} style={styles.customerName}>{booking.customerName || t('partner.nameMissing')}</Text><StatusBadge status={booking.status}/></View>
        <Text numberOfLines={1} style={styles.bookingMeta}>{t(`labels.${booking.eventType || 'WEDDING'}`)} · {booking.hallName || t('common.hall')} · {t('booking.guest', { count: booking.guestCount })}</Text>
        <View style={styles.menuRow}><View style={{ flex: 1 }}><Text numberOfLines={1} style={styles.bookingMeta}>{booking.menuName || t('partner.menuMissing')}</Text><Text numberOfLines={1} style={styles.bookingNumber}>{booking.bookingNumber}</Text></View><Text style={styles.amount}>{formatCurrency(Number(booking.totalPrice || 0), getAppLanguage())}</Text></View>
      </View>
    </View>
    {booking.status === 'PENDING_APPROVAL' && <View style={styles.bookingActions}>
      <Pressable onPress={onApprove} style={({ pressed }) => [styles.approveButton, pressed && styles.pressed]}><Text style={styles.approveText}>{t('partner.approve')}</Text></Pressable>
      <Pressable onPress={onReject} style={({ pressed }) => [styles.rejectButton, pressed && styles.pressed]}><Text style={styles.rejectText}>{t('partner.reject')}</Text></Pressable>
    </View>}
  </Pressable>;
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const success = status === 'CONFIRMED';
  const pending = status === 'PENDING_APPROVAL';
  const compactLabel = t(`labels.${status}`, { defaultValue: labels[status] || status });
  return <View style={[styles.statusBadge, success && styles.statusSuccess, !success && !pending && styles.statusNeutral]}>
    <Text numberOfLines={1} style={[styles.statusText, success && styles.statusSuccessText]}>{compactLabel}</Text>
  </View>;
}

function FilterSheet({ visible, detail, items, value, resultCount, onChange, onReset, onClose, onApply }: {
  visible: boolean;
  detail?: VenueDetail;
  items: Booking[];
  value: Filters;
  resultCount: number;
  onChange: (value: Filters) => void;
  onReset: () => void;
  onClose: () => void;
  onApply: () => void;
}) {
  const { t } = useTranslation();
  return <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
    <View style={styles.modalRoot}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('partner.filtersClose')} onPress={onClose} style={styles.backdrop}/>
      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <View style={styles.handle}/>
        <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>{t('venues.filters')}</Text><Pressable onPress={onReset} hitSlop={8}><Text style={styles.resetText}>{t('common.reset')}</Text></Pressable></View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
          <FilterGroup title={t('common.hall')}>
            <FilterChip label={t('partner.allHalls')} selected={!value.hallId} onPress={() => onChange({ ...value, hallId: '' })}/>
            {(detail?.halls || []).map(hall => <FilterChip key={hall.id} label={hall.name} selected={value.hallId === String(hall.id)} onPress={() => onChange({ ...value, hallId: String(hall.id) })}/>) }
          </FilterGroup>
          <FilterGroup title={t('common.menu')}>
            <FilterChip label={t('partner.allMenus')} selected={!value.menuPackageId} onPress={() => onChange({ ...value, menuPackageId: '' })}/>
            {(detail?.menus || []).map(menu => <FilterChip key={menu.id} label={menu.name} selected={value.menuPackageId === String(menu.id)} onPress={() => onChange({ ...value, menuPackageId: String(menu.id) })}/>) }
          </FilterGroup>
          <FilterGroup title={t('partner.filterStatus')}>
            {filterStatuses.map(status => <FilterChip
              key={status}
              label={`${t(`labels.${status}`, { defaultValue: labels[status] })} · ${items.filter(item => item.status === status).length}`}
              selected={value.status === status}
              onPress={() => onChange({ ...value, status: value.status === status ? '' : status })}
            />)}
          </FilterGroup>
        </ScrollView>
        <Pressable onPress={onApply} style={({ pressed }) => [styles.showResultsButton, pressed && styles.pressed]}><Text style={styles.showResultsText}>{t('partner.results', { count: resultCount })}</Text></Pressable>
      </SafeAreaView>
    </View>
  </Modal>;
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.filterGroup}><Text style={styles.filterTitle}>{title}</Text><View style={styles.filterChips}>{children}</View></View>;
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.filterChip, selected && styles.filterChipSelected]}><Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{label}</Text></Pressable>;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(appLocale(getAppLanguage()), { maximumFractionDigits: 0 }).format(value);
}

const serif = Platform.select({ ios: 'Georgia', android: 'serif' });
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  screen: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 20 },
  header: { gap: 8, marginBottom: 4 },
  title: { color: colors.ink, fontSize: 24, lineHeight: 29, fontWeight: '700', letterSpacing: -.35, fontFamily: serif },
  venueName: { color: colors.brandDark, fontSize: 10, lineHeight: 15, fontWeight: '600' },
  monthRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthButton: { width: 38, height: 38, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  monthCenter: { alignItems: 'center', gap: 1 },
  monthTitle: { color: colors.ink, fontSize: 17, lineHeight: 21, fontWeight: '700', fontFamily: serif },
  currentMonth: { color: colors.muted, fontSize: 9, lineHeight: 13 },
  metrics: { minHeight: 46, flexDirection: 'row', alignItems: 'center', marginTop: 3, marginBottom: 10, paddingVertical: 8, backgroundColor: colors.paper, borderWidth: 1, borderColor: '#F0E9DD', borderRadius: 16 },
  metric: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 3 },
  metricBorder: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.line },
  metricValue: { color: colors.ink, fontSize: 12, lineHeight: 14, fontWeight: '800', fontFamily: serif },
  metricLabel: { color: colors.muted, fontSize: 7.5, lineHeight: 10 },
  searchRow: { flexDirection: 'row', gap: 9, marginBottom: 9 },
  searchBox: { flex: 1, height: 42, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 12 },
  searchInput: { flex: 1, height: 40, paddingVertical: 0, color: colors.ink, fontSize: 12 },
  filterButton: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  filterCount: { position: 'absolute', right: -4, top: -5, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, borderWidth: 1.5, borderColor: colors.brand },
  filterCountText: { color: colors.brand, fontSize: 9, fontWeight: '800' },
  pressed: { opacity: .68 },
  tabs: { minHeight: 32, alignItems: 'flex-end', gap: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  tab: { height: 32, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.brand },
  tabText: { color: colors.muted, fontSize: 10 },
  tabTextActive: { color: colors.ink, fontWeight: '700' },
  tabCount: { fontSize: 8 },
  activeFilters: { alignItems: 'center', gap: 7, paddingTop: 9, paddingBottom: 1 },
  activeFilter: { height: 29, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.goldLight, backgroundColor: colors.softGold },
  activeFilterText: { color: colors.brandDark, fontSize: 9, fontWeight: '600' },
  clearButton: { height: 29, justifyContent: 'center', paddingHorizontal: 7 },
  clearText: { color: colors.brandDark, fontSize: 9, fontWeight: '600' },
  list: { gap: 8, paddingTop: 9 },
  bookingCard: { padding: 9, backgroundColor: colors.paper, borderWidth: 1, borderColor: '#F0E9DD', borderRadius: 16, shadowColor: colors.shadow, shadowOpacity: .02, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  cardPressed: { opacity: .74 },
  bookingMain: { flexDirection: 'row', gap: 10 },
  dateBox: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: colors.softGold },
  dateDay: { color: colors.ink, fontSize: 16, lineHeight: 18, fontWeight: '800', fontFamily: serif },
  dateMonth: { color: colors.brandDark, fontSize: 7, lineHeight: 9, fontWeight: '700' },
  bookingInfo: { flex: 1, minWidth: 0 },
  nameRow: { minHeight: 20, flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  customerName: { flex: 1, color: colors.ink, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  bookingMeta: { color: colors.muted, fontSize: 9, lineHeight: 14 },
  bookingNumber: { color: colors.muted, fontSize: 8, lineHeight: 11 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  amount: { color: colors.ink, fontSize: 12, lineHeight: 17, fontWeight: '800', fontFamily: serif },
  statusBadge: { maxWidth: 92, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: '#F6EBCF' },
  statusNeutral: { backgroundColor: '#F0ECE4' },
  statusSuccess: { backgroundColor: '#EAF0DF' },
  statusText: { color: colors.brandDark, fontSize: 7.5, lineHeight: 10, fontWeight: '700' },
  statusSuccessText: { color: colors.success },
  bookingActions: { flexDirection: 'row', gap: 7, marginTop: 8 },
  approveButton: { flex: 1, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.brand },
  approveText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  rejectButton: { flex: 1, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.brand },
  rejectText: { color: colors.brand, fontSize: 10, fontWeight: '800' },
  empty: { alignItems: 'center', gap: 7, paddingVertical: 52 },
  emptyIcon: { color: colors.gold, fontSize: 36 },
  muted: { color: colors.muted, fontSize: 11 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', inset: 0, backgroundColor: 'rgba(28, 26, 23, .48)' },
  sheet: { maxHeight: '76%', minHeight: 455, paddingHorizontal: 12, paddingBottom: 8, backgroundColor: colors.paper, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  handle: { alignSelf: 'center', width: 32, height: 4, borderRadius: 2, marginTop: 7, marginBottom: 14, backgroundColor: '#D6C7AA' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { color: colors.ink, fontSize: 17, fontWeight: '700', fontFamily: serif },
  resetText: { color: colors.brandDark, fontSize: 10, fontWeight: '700' },
  sheetContent: { gap: 12, paddingBottom: 12 },
  filterGroup: { gap: 5 },
  filterTitle: { color: colors.ink, fontSize: 10, lineHeight: 14 },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  filterChip: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 11, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  filterChipSelected: { backgroundColor: colors.brand, borderColor: colors.brand },
  filterChipText: { color: colors.ink, fontSize: 9, fontWeight: '600' },
  filterChipTextSelected: { color: '#fff' },
  showResultsButton: { height: 41, alignItems: 'center', justifyContent: 'center', marginTop: 4, marginBottom: 2, borderRadius: 21, backgroundColor: colors.brand },
  showResultsText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
