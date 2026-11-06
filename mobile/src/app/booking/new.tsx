import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '@/api';
import { DatePickerField, todayIso } from '@/date-picker';
import { formatCurrency, formatDate } from '@/format';
import { getAppLanguage } from '@/i18n';
import { colors } from '@/theme';
import type { BookingEventType, ExtraService, MenuItem, MenuPackage, VenueDetail } from '@/types';
import { useAuth } from '@/auth';
import { useNotificationState } from '@/notification-state';
import { claimNotificationPermissionExplanation, markNotificationExplanationAfterBooking } from '@/notification-prompt';
import { AndroidScaledContent } from '@/ui';

const stepKeys = ['event', 'menu', 'service', 'confirm'] as const;
const eventTypes: BookingEventType[] = ['WEDDING', 'BIRTHDAY', 'PRIVATE_EVENT'];

function servicePrice(service: ExtraService, guests: number) {
  const perPerson = service.priceType === 'PER_PERSON' || service.price_type === 'PER_PERSON';
  return Number(service.price) * (perPerson ? guests || 0 : 1);
}
function bookingDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  return new Date(`${value}T12:00:00`);
}

export default function NewBooking() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { pushEnabled } = useNotificationState();
  const { venueId, hallId: requestedHallId, menuPackageId: requestedMenuId } = useLocalSearchParams<{ venueId: string; hallId?: string; menuPackageId?: string }>();
  const [detail, setDetail] = useState<VenueDetail>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [hallId, setHallId] = useState<number>();
  const [date, setDate] = useState('');
  const [guests, setGuests] = useState('100');
  const [eventType, setEventType] = useState<BookingEventType>('WEDDING');
  const [services, setServices] = useState<number[]>([]);
  const [menuPackageId, setMenuPackageId] = useState<number>();
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  const [addedIds, setAddedIds] = useState<number[]>([]);
  const [openCategories, setOpenCategories] = useState<number[]>([]);
  const [promo, setPromo] = useState('');
  const [note, setNote] = useState('');
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(undefined);
    try {
      const value = await api.venue(Number(venueId));
      setDetail(value);
      const requestedHall = Number(requestedHallId);
      setHallId(value.halls.some(hall => hall.id === requestedHall) ? requestedHall : value.halls[0]?.id);
      const requestedMenu = Number(requestedMenuId);
      const initialMenu = (value.menus || []).find(menu => menu.id === requestedMenu)
        || (value.menus || []).find(menu => menu.popular)
        || value.menus?.[0];
      setMenuPackageId(initialMenu?.id);
      setOpenCategories(initialMenu?.categories[0] ? [initialMenu.categories[0].id] : []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [requestedHallId, requestedMenuId, venueId]);
  useEffect(() => { load(); }, [load]);

  const hall = useMemo(() => detail?.halls.find(item => item.id === hallId), [detail, hallId]);
  const menu = useMemo(() => detail?.menus?.find(item => item.id === menuPackageId), [detail, menuPackageId]);
  const guestCount = Number(guests);
  const validGuests = Number.isInteger(guestCount) && guestCount > 0 ? guestCount : 0;
  const allItems = useMemo(() => detail?.menus?.flatMap(item => item.categories.flatMap(category => category.items)) || [], [detail]);
  const addedItems = useMemo(() => {
    const seen = new Set<number>();
    return allItems.filter(item => addedIds.includes(item.id) && !seen.has(item.id) && Boolean(seen.add(item.id)));
  }, [addedIds, allItems]);
  const removedItems = useMemo(() => menu?.categories.flatMap(category => category.items).filter(item => removedIds.includes(item.id)) || [], [menu, removedIds]);
  const menuUnit = Number(menu?.pricePerPerson || hall?.pricePerPerson || 0)
    + addedItems.reduce((sum, item) => sum + Number(item.additionalPricePerPerson), 0)
    - removedItems.reduce((sum, item) => sum + Number(item.additionalPricePerPerson), 0);
  const menuTotal = menuUnit * validGuests;
  const selectedServices = useMemo(() => detail?.services.filter(service => services.includes(service.id)) || [], [detail, services]);
  const servicesTotal = selectedServices.reduce((sum, service) => sum + servicePrice(service, validGuests), 0);
  const total = menuTotal + servicesTotal;

  const addons = useMemo(() => {
    if (!menu || !detail) return [];
    const included = new Set(menu.categories.flatMap(category => category.items.map(item => item.id)));
    const seen = new Set<number>();
    return detail.menus.filter(item => item.tier > menu.tier)
      .flatMap(item => item.categories.flatMap(category => category.items))
      .filter(item => item.customizable && !included.has(item.id) && !seen.has(item.id) && Boolean(seen.add(item.id)));
  }, [detail, menu]);

  const unavailableDates = useCallback(async (month: string) => {
    if (!hallId) return [];
    const availability = await api.availability(hallId, month);
    return [...(availability.occupied || []), ...(availability.blocked || [])]
      .map((item: any) => item.date || item.eventDate || item.blockedDate)
      .filter((item: unknown): item is string => typeof item === 'string');
  }, [hallId]);

  const validateEvent = () => {
    if (!hall || !date) {
      Alert.alert(t('bookingFlow.validation.completeTitle'), t('bookingFlow.validation.completeMessage'));
      return false;
    }
    if (!Number.isInteger(guestCount) || guestCount < hall.capacityMin || guestCount > hall.capacityMax) {
      Alert.alert(t('bookingFlow.validation.guestTitle'), t('bookingFlow.validation.guestMessage', { min: hall.capacityMin, max: hall.capacityMax }));
      return false;
    }
    return true;
  };
  const next = () => {
    if (step === 0 && !validateEvent()) return;
    if (step === 1 && detail?.menus.length && !menu) {
      Alert.alert(t('bookingFlow.validation.menuTitle'), t('bookingFlow.validation.menuMessage'));
      return;
    }
    setStep(current => Math.min(current + 1, 3));
  };
  const back = () => step ? setStep(current => current - 1) : router.back();
  const selectMenu = (nextMenu: MenuPackage) => {
    setMenuPackageId(nextMenu.id);
    setRemovedIds([]);
    setAddedIds([]);
    setOpenCategories(nextMenu.categories[0] ? [nextMenu.categories[0].id] : []);
  };

  const submit = async () => {
    if (!termsAccepted) {
      Alert.alert(t('bookingFlow.terms.title'), t('bookingFlow.validation.termsMessage'));
      return;
    }
    if (!validateEvent() || busy) return;
    setBusy(true);
    try {
      const payment = await api.checkoutBooking({
        hallId, eventDate: date, guestCount, eventType, extraServiceIds: services,
        promoCode: promo || null, customerNote: note || null, menuPackageId: menu?.id || null,
        removedMenuItemIds: removedIds, addedMenuItemIds: addedIds,
      });
      if (payment.status === 'SUCCESS') {
        const showExplanation = !!user && !pushEnabled && await claimNotificationPermissionExplanation(user.id);
        if (showExplanation) {
          router.replace({ pathname: '/account/notification-permission', params: { next: '/bookings', source: 'booking' } } as any);
        } else {
          router.replace('/bookings' as any);
          Alert.alert(t('bookingFlow.successTitle'), t('bookingFlow.successMessage'));
        }
      } else if (payment.checkoutUrl) {
        if (user && !pushEnabled) await markNotificationExplanationAfterBooking(user.id);
        await Linking.openURL(payment.checkoutUrl);
      }
      else throw new Error(t('bookingFlow.paymentLinkPending'));
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={colors.brand} size="large"/><Text style={styles.muted}>{t('common.loading')}</Text></View></SafeAreaView>;
  if (!detail) return <SafeAreaView style={styles.safe}><View style={styles.center}><Ionicons name="alert-circle-outline" size={38} color={colors.brand}/><Text style={styles.error}>{loadError || t('bookingFlow.venueMissing')}</Text><GoldButton title={t('common.retry')} onPress={load}/></View></SafeAreaView>;

  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
    <AndroidScaledContent><Header venue={detail.venue.name} step={step} onBack={back}/></AndroidScaledContent>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView key={step} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} contentContainerStyle={styles.content}>
        <AndroidScaledContent style={styles.scaledFlow}>
        {step === 0 && <EventStep detail={detail} hallId={hallId} hall={hall} date={date} guests={guests} eventType={eventType}
          onHall={value => { setHallId(value); setDate(''); }} onDate={setDate} onGuests={setGuests} onEventType={setEventType} unavailableDates={unavailableDates}/>}
        {step === 1 && <MenuStep menus={detail.menus || []} selected={menu} removedIds={removedIds} addedIds={addedIds}
          openCategories={openCategories} addons={addons} onSelect={selectMenu}
          onRemove={item => setRemovedIds(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id])}
          onAdd={item => setAddedIds(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id])}
          onCategory={id => setOpenCategories(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])}
          onAll={() => setOpenCategories(current => current.length === menu?.categories.length ? [] : menu?.categories.map(category => category.id) || [])}/>}
        {step === 2 && <ServicesStep items={detail.services || []} selectedIds={services} guests={validGuests} note={note}
          onToggle={id => setServices(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])} onNote={setNote}/>}
        {step === 3 && <ConfirmStep hall={hall?.name || ''} date={date} guests={validGuests} eventType={eventType} menu={menu}
          removed={removedItems} added={addedItems} services={selectedServices} menuTotal={menuTotal} servicesTotal={servicesTotal}
          total={total} promo={promo} termsOpen={termsOpen} termsAccepted={termsAccepted} onPromo={setPromo}
          onEvent={() => setStep(0)} onMenu={() => setStep(1)} onServices={() => setStep(2)}
          onAcceptTerms={() => setTermsAccepted(value => !value)} onToggleTerms={() => setTermsOpen(value => !value)}/>}
        </AndroidScaledContent>
      </ScrollView>
      <Footer step={step} deposit={validGuests} menuTotal={menuTotal} servicesTotal={servicesTotal} busy={busy}
        disabled={(step === 0 && (!hallId || !date || !validGuests)) || (step === 3 && !termsAccepted)} onPress={step === 3 ? submit : next}/>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

function Header({ venue, step, onBack }: { venue: string; step: number; onBack: () => void }) {
  const { t } = useTranslation();
  return <View style={styles.header}>
    <View style={styles.headerMain}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={onBack} style={styles.backButton}><Ionicons name="chevron-back" size={22} color={colors.ink}/></Pressable>
      <View style={styles.flex}><Text style={styles.title}>{t('bookingFlow.title')}</Text><Text style={styles.subtitle}>{t('bookingFlow.stepProgress', { venue, current: step + 1, total: 4 })}</Text></View>
    </View>
    <View style={styles.steps}>{stepKeys.map((key, index) => <View key={key} style={styles.stepItem}><View style={[styles.stepLine, index <= step && styles.stepLineActive]}/><Text style={[styles.stepLabel, index === step && styles.stepLabelActive]}>{t(`bookingFlow.steps.${key}`)}</Text></View>)}</View>
  </View>;
}

type EventProps = {
  detail: VenueDetail; hallId?: number; hall?: VenueDetail['halls'][number]; date: string; guests: string; eventType: BookingEventType;
  onHall: (id: number) => void; onDate: (value: string) => void; onGuests: (value: string) => void;
  onEventType: (value: BookingEventType) => void; unavailableDates: (month: string) => Promise<string[]>;
};
function EventStep({ detail, hallId, hall, date, guests, eventType, onHall, onDate, onGuests, onEventType, unavailableDates }: EventProps) {
  const { t } = useTranslation();
  const count = Number(guests) || 0;
  const bump = (delta: number) => onGuests(String(Math.min(hall?.capacityMax || 9999, Math.max(hall?.capacityMin || 1, count + delta))));
  return <>
    <Label>{t('bookingFlow.selectHall')}</Label>
    <View style={styles.wrap}>{detail.halls.map(item => <Chip key={item.id} label={item.name} selected={hallId === item.id} onPress={() => onHall(item.id)}/>)}</View>
    {hall && <View style={styles.card}><Text style={styles.cardTitle}>{hall.name}</Text><Text style={styles.muted}>{t('bookingFlow.guestRange', { min: hall.capacityMin, max: hall.capacityMax })}</Text><Text style={styles.muted}>{t('bookingFlow.depositPerGuest')}</Text></View>}
    <DatePickerField label={t('bookingFlow.eventDate')} value={date} onChange={onDate} minDate={todayIso()} placeholder={t('bookingFlow.selectEventDate')} loadUnavailableDates={unavailableDates} displayMode="long"/>
    {date && <View style={styles.available}><Ionicons name="checkmark" size={14} color={colors.success}/><Text style={styles.availableText}>{t('bookingFlow.dateAvailable')}</Text></View>}
    <Label>{t('bookingFlow.guestCount')}</Label>
    <View style={styles.counter}><Pressable onPress={() => bump(-10)} style={styles.roundButton}><Ionicons name="remove" size={22} color={colors.ink}/></Pressable>
      <View style={styles.guestShell}><TextInput accessibilityLabel={t('bookingFlow.guestCount')} keyboardType="number-pad" value={guests} onChangeText={value => onGuests(value.replace(/\D/g, ''))} style={styles.guestInput}/></View>
      <Pressable onPress={() => bump(10)} style={styles.roundButton}><Ionicons name="add" size={22} color={colors.ink}/></Pressable></View>
    {hall && <Text style={styles.hint}>{t('bookingFlow.hallGuestRange', { min: hall.capacityMin, max: hall.capacityMax })}</Text>}
    <Label>{t('bookingFlow.eventType')}</Label>
    <View style={styles.wrap}>{eventTypes.map(value => <Chip key={value} label={t(`labels.${value}`)} selected={eventType === value} onPress={() => onEventType(value)}/>)}</View>
  </>;
}

type MenuProps = {
  menus: MenuPackage[]; selected?: MenuPackage; removedIds: number[]; addedIds: number[]; openCategories: number[]; addons: MenuItem[];
  onSelect: (menu: MenuPackage) => void; onRemove: (item: MenuItem) => void; onAdd: (item: MenuItem) => void;
  onCategory: (id: number) => void; onAll: () => void;
};
function MenuStep({ menus, selected, removedIds, addedIds, openCategories, addons, onSelect, onRemove, onAdd, onCategory, onAll }: MenuProps) {
  const { t } = useTranslation();
  const language = getAppLanguage();
  if (!menus.length) return <Empty icon="restaurant-outline" title={t('bookingFlow.noMenu')} text={t('bookingFlow.noMenuDescription')}/>;
  return <>
    <View style={styles.list}>{menus.map(menu => {
      const active = menu.id === selected?.id;
      const count = menu.categories.reduce((sum, category) => sum + category.items.length, 0);
      return <Pressable key={menu.id} onPress={() => onSelect(menu)} style={[styles.package, active && styles.packageActive]}>
        <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={21} color={active ? colors.brand : colors.muted}/>
        <View style={styles.flex}><Text style={styles.packageName}>{menu.name}</Text><Text style={styles.packageDescription}>{t('bookingFlow.packageDescription', { items: count, sections: menu.categories.length })}</Text></View>
        <View style={styles.alignEnd}><Text style={styles.packagePrice}>{formatCurrency(Number(menu.pricePerPerson), language)}</Text><Text style={styles.perPerson}>{t('bookingFlow.perPerson')}</Text></View>
      </Pressable>;
    })}</View>
    {selected && <>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{t('bookingFlow.menuContents')}</Text><Pressable onPress={onAll}><Text style={styles.link}>{t(openCategories.length === selected.categories.length ? 'bookingFlow.closeAll' : 'bookingFlow.openAll')}</Text></Pressable></View>
      <View style={styles.info}><Ionicons name="information-circle-outline" size={18} color={colors.brand}/><Text style={styles.infoText}>{t('bookingFlow.menuPriceInfo')}</Text></View>
      {selected.categories.map(category => {
        const open = openCategories.includes(category.id);
        const activeCount = category.items.filter(item => !removedIds.includes(item.id)).length;
        return <View key={category.id} style={styles.category}>
          <Pressable onPress={() => onCategory(category.id)} style={styles.categoryHeader}><Text style={[styles.packageName, styles.flex]}>{category.name}</Text>
            <View style={styles.countBadge}><Text style={styles.countText}>{t('bookingFlow.selectedCount', { count: activeCount })}</Text></View><Text style={styles.fraction}>{activeCount} / {category.items.length}</Text>
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted}/></Pressable>
          {open && category.items.map(item => <MenuRow key={item.id} item={item} active={!removedIds.includes(item.id)} onPress={item.customizable ? () => onRemove(item) : undefined} negative/>)}
        </View>;
      })}
      {!!addons.length && <View style={styles.category}><View style={styles.categoryHeader}><Text style={[styles.packageName, styles.flex]}>{t('bookingFlow.addons')}</Text><Text style={styles.fraction}>{t('bookingFlow.selectedCount', { count: addedIds.length })}</Text></View>
        {addons.map(item => <MenuRow key={item.id} item={item} active={addedIds.includes(item.id)} onPress={() => onAdd(item)}/>)}</View>}
    </>}
  </>;
}
function MenuRow({ item, active, onPress, negative }: { item: MenuItem; active: boolean; onPress?: () => void; negative?: boolean }) {
  const { t } = useTranslation();
  const language = getAppLanguage();
  const price = Number(item.additionalPricePerPerson);
  return <Pressable accessibilityRole={onPress ? 'switch' : undefined} accessibilityState={onPress ? { checked: active } : undefined} disabled={!onPress} onPress={onPress} style={styles.itemRow}>
    {onPress ? <Toggle active={active}/> : <View style={styles.fixedDot}/>}
    <View style={styles.flex}><Text style={[styles.itemName, !active && styles.itemDisabled]}>{item.name}</Text>{item.description && <Text style={styles.itemDescription}>{item.description}</Text>}</View>
    {!active && negative && <View style={styles.excluded}><Text style={styles.excludedText}>{t('bookingFlow.removed')}</Text></View>}
    {price > 0 && <Text style={styles.itemPrice}>{negative ? '−' : '+'}{formatCurrency(price, language)}</Text>}{!onPress && <Text style={styles.fixed}>{t('bookingFlow.fixed')}</Text>}
  </Pressable>;
}

function ServicesStep({ items, selectedIds, guests, note, onToggle, onNote }: { items: ExtraService[]; selectedIds: number[]; guests: number; note: string; onToggle: (id: number) => void; onNote: (value: string) => void }) {
  const { t } = useTranslation();
  const language = getAppLanguage();
  return <>
    <Text style={styles.intro}>{t('bookingFlow.servicesIntro')}</Text>
    {items.length ? items.map(service => {
      const included = Number(service.price) === 0;
      const selected = included || selectedIds.includes(service.id);
      return <View key={service.id} style={styles.service}><View style={styles.flex}><Text style={styles.cardTitle}>{service.name}</Text>{service.description && <Text style={styles.muted}>{service.description}</Text>}</View>
        {included ? <View style={styles.included}><Text style={styles.includedText}>{t('bookingFlow.included')}</Text></View> : <><Text style={styles.servicePrice}>+{formatCurrency(servicePrice(service, guests), language)}</Text><Pressable accessibilityRole="switch" accessibilityState={{ checked: selected }} onPress={() => onToggle(service.id)}><Toggle active={selected}/></Pressable></>}</View>;
    }) : <Empty icon="sparkles-outline" title={t('bookingFlow.noServices')}/>}
    <Label>{t('bookingFlow.noteLabel')}</Label>
    <View style={styles.noteShell}><TextInput multiline maxLength={1000} value={note} onChangeText={onNote} placeholder={t('bookingFlow.notePlaceholder')} placeholderTextColor="#9F9688" style={styles.noteInput}/></View>
  </>;
}

type ConfirmProps = {
  hall: string; date: string; guests: number; eventType: BookingEventType; menu?: MenuPackage; removed: MenuItem[]; added: MenuItem[];
  services: ExtraService[]; menuTotal: number; servicesTotal: number; total: number; promo: string; termsOpen: boolean; termsAccepted: boolean;
  onPromo: (value: string) => void; onEvent: () => void; onMenu: () => void; onServices: () => void;
  onAcceptTerms: () => void; onToggleTerms: () => void;
};
function ConfirmStep({ hall, date, guests, eventType, menu, removed, added, services, menuTotal, servicesTotal, total, promo, termsOpen, termsAccepted, onPromo, onEvent, onMenu, onServices, onAcceptTerms, onToggleTerms }: ConfirmProps) {
  const { t } = useTranslation();
  const language = getAppLanguage();
  const parsedDate = bookingDate(date);
  return <>
    <Summary title={t('bookingFlow.steps.event')} onEdit={onEvent}><SummaryRow label={t('bookingFlow.hall')} value={hall}/><SummaryRow label={t('bookingFlow.date')} value={parsedDate ? formatDate(parsedDate, language, { day: 'numeric', month: 'long', year: 'numeric' }) : t('common.notSelected')}/><SummaryRow label={t('bookingFlow.guestCount')} value={t('bookingFlow.guestsAndType', { count: guests, type: t(`labels.${eventType}`) })}/></Summary>
    <Summary title={t('bookingFlow.menuAndServices')} onEdit={onMenu}><SummaryRow label={t('bookingFlow.steps.menu')} value={menu?.name || t('bookingFlow.arrangeWithVenue')}/>
      {!!removed.length && <SummaryRow label={t('bookingFlow.removedItems')} value={removed.map(item => item.name).join(', ')}/>}
      {!!added.length && <SummaryRow label={t('bookingFlow.addedItems')} value={added.map(item => item.name).join(', ')}/>}
      <Pressable onPress={onServices}><SummaryRow label={t('bookingFlow.services')} value={services.map(item => item.name).join(', ') || t('common.notSelected')}/></Pressable></Summary>
    <View style={styles.totalCard}><SummaryRow label={t('bookingFlow.menuTotal')} value={formatCurrency(menuTotal, language)} strong/>{servicesTotal > 0 && <SummaryRow label={t('bookingFlow.services')} value={formatCurrency(servicesTotal, language)}/>}
      <View style={styles.divider}/><SummaryRow label={t('bookingFlow.estimatedTotal')} value={formatCurrency(total, language)} strong/><View style={styles.divider}/>
      <SummaryRow label={t('bookingFlow.payNow')} value={formatCurrency(guests, language)} strong gold/><Text style={styles.depositHint}>{t('bookingFlow.depositCalculation', { count: guests })}</Text>
      <SummaryRow label={t('bookingFlow.payAtVenue')} value={formatCurrency(Math.max(total - guests, 0), language)}/></View>
    <View style={styles.promo}><Ionicons name="pricetag-outline" size={19} color={colors.muted}/><TextInput value={promo} onChangeText={value => onPromo(value.toUpperCase())} autoCapitalize="characters" placeholder={t('bookingFlow.promoCode')} placeholderTextColor="#8D877E" style={styles.promoInput}/></View>
    <View style={styles.notice}><Ionicons name="information-circle-outline" size={18} color={colors.brand}/><Text style={styles.noticeText}>{t('bookingFlow.approvalNotice')}</Text></View>
    <View style={styles.terms}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: termsAccepted }} onPress={onAcceptTerms} style={styles.termsAccept}>
        <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>{termsAccepted && <Ionicons name="checkmark" size={15} color={colors.paper}/>}</View>
        <Text style={styles.termsText}>{t('bookingFlow.terms.accept')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('bookingFlow.terms.show')} onPress={onToggleTerms} style={styles.termsDetails}>
        <Text style={styles.termsLink}>{t('bookingFlow.terms.link')}</Text><Ionicons name={termsOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.brand}/>
      </Pressable>
    </View>
    {termsOpen && <View style={styles.termsBox}><Text style={styles.infoText}>{t('bookingFlow.terms.description')}</Text></View>}
  </>;
}
function Summary({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  const { t } = useTranslation();
  return <View style={styles.summary}><View style={styles.summaryHeader}><Text style={styles.summaryTitle}>{title}</Text><Pressable onPress={onEdit}><Text style={styles.link}>{t('common.change')}</Text></Pressable></View>{children}</View>;
}
function SummaryRow({ label, value, strong, gold }: { label: string; value: string; strong?: boolean; gold?: boolean }) {
  return <View style={styles.summaryRow}><Text style={[styles.summaryLabel, strong && styles.strong]}>{label}</Text><Text style={[styles.summaryValue, strong && styles.strong, gold && styles.goldText]}>{value}</Text></View>;
}

function Footer({ step, deposit, menuTotal, servicesTotal, busy, disabled, onPress }: { step: number; deposit: number; menuTotal: number; servicesTotal: number; busy: boolean; disabled: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const language = getAppLanguage();
  const values = [deposit, menuTotal, servicesTotal, deposit];
  const labels = [t('bookingFlow.deposit'), t('bookingFlow.menuTotal'), t('bookingFlow.services'), t('bookingFlow.payNowShort')];
  return <SafeAreaView edges={['bottom']} style={styles.footerSafe}><AndroidScaledContent><View style={styles.footer}><View style={styles.flex}><Text style={styles.footerLabel}>{labels[step]}</Text><Text style={styles.footerPrice}>{formatCurrency(values[step], language)}</Text>
    {step === 0 && <Text style={styles.footerHint}>{t('bookingFlow.depositCalculation', { count: deposit })}</Text>}{step === 2 && servicesTotal === 0 && <Text style={styles.footerHint}>{t('bookingFlow.noServiceSelected')}</Text>}</View>
    <GoldButton title={busy ? t('bookingFlow.paying') : step === 3 ? t('bookingFlow.reserve') : t('common.continue')} onPress={onPress} disabled={disabled || busy}/></View></AndroidScaledContent></SafeAreaView>;
}
function Label({ children }: { children: React.ReactNode }) { return <Text style={styles.label}>{children}</Text>; }
function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipActive]}><Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text></Pressable>;
}
function Toggle({ active }: { active: boolean }) { return <View style={[styles.toggle, active && styles.toggleActive]}><View style={[styles.toggleKnob, active && styles.toggleKnobActive]}/></View>; }
function GoldButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.goldButton, (pressed || disabled) && styles.disabled]}><Text style={styles.goldButtonText}>{title}</Text></Pressable>;
}
function Empty({ icon, title, text }: { icon: keyof typeof Ionicons.glyphMap; title: string; text?: string }) {
  return <View style={styles.empty}><Ionicons name={icon} size={36} color={colors.brand}/><Text style={styles.cardTitle}>{title}</Text>{text && <Text style={styles.muted}>{text}</Text>}</View>;
}

const serif = Platform.select({ ios: 'Georgia', android: 'serif' });
const styles = StyleSheet.create({
  scaledFlow: { gap: 10 },
  safe: { flex: 1, backgroundColor: colors.cream }, flex: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28 },
  header: { paddingHorizontal: 14, paddingTop: 4 }, headerMain: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  backButton: { width: 42, height: 42, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  title: { color: colors.ink, fontSize: 22, lineHeight: 27, fontWeight: '700', fontFamily: serif }, subtitle: { color: colors.muted, fontSize: 11, lineHeight: 15 },
  steps: { flexDirection: 'row', gap: 6, marginTop: 10 }, stepItem: { flex: 1, gap: 4 }, stepLine: { height: 3, borderRadius: 3, backgroundColor: '#E2DACB' },
  stepLineActive: { backgroundColor: colors.gold }, stepLabel: { color: colors.muted, fontSize: 9 }, stepLabelActive: { color: colors.ink, fontWeight: '800' },
  content: { paddingHorizontal: 14, paddingTop: 15, paddingBottom: 28, gap: 10 },
  card: { padding: 14, gap: 4, backgroundColor: colors.paper, borderRadius: 17, borderWidth: 1, borderColor: colors.line },
  cardTitle: { color: colors.ink, fontSize: 15, lineHeight: 20, fontWeight: '700', fontFamily: serif }, muted: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center' }, label: { color: colors.ink, fontSize: 13, lineHeight: 18, fontWeight: '600', marginTop: 2 },
  hint: { color: colors.muted, fontSize: 10, marginTop: -5 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand }, chipText: { color: colors.ink, fontSize: 12, fontWeight: '700' }, chipTextActive: { color: colors.paper },
  available: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 7, borderRadius: 11, gap: 2, backgroundColor: '#EEF1E6', marginTop: -4 },
  availableText: { color: colors.success, fontSize: 10, fontWeight: '700' }, counter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  roundButton: { width: 42, height: 42, borderRadius: 22, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  guestShell: { flex: 1, height: 42, justifyContent: 'center', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 12 },
  guestInput: { color: colors.ink, fontSize: 18, fontWeight: '800', textAlign: 'center', paddingVertical: 0 }, list: { gap: 8 },
  package: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: colors.paper, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 14, borderWidth: 1, borderColor: colors.line },
  packageActive: { borderColor: colors.gold, borderWidth: 1.5 }, packageName: { color: colors.ink, fontSize: 13, fontWeight: '700', fontFamily: serif },
  packageDescription: { color: colors.muted, fontSize: 9, lineHeight: 14 }, packagePrice: { color: colors.ink, fontSize: 15, fontWeight: '800', fontFamily: serif },
  perPerson: { color: colors.muted, fontSize: 8 }, alignEnd: { alignItems: 'flex-end' }, sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', fontFamily: serif }, link: { color: colors.brand, fontSize: 11, fontWeight: '700' },
  info: { flexDirection: 'row', gap: 7, padding: 10, borderRadius: 11, backgroundColor: colors.softGold }, infoText: { flex: 1, color: colors.muted, fontSize: 10, lineHeight: 15 },
  category: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 15, overflow: 'hidden' },
  categoryHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11 }, countBadge: { paddingHorizontal: 9, paddingVertical: 4, backgroundColor: colors.softGold, borderRadius: 10 },
  countText: { color: colors.brand, fontSize: 9, fontWeight: '700' }, fraction: { color: colors.muted, fontSize: 9 },
  itemRow: { minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 11, paddingVertical: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  itemName: { color: colors.ink, fontSize: 11, fontWeight: '500' }, itemDisabled: { color: colors.muted, textDecorationLine: 'line-through' }, itemDescription: { color: colors.muted, fontSize: 9 },
  itemPrice: { color: colors.brand, fontSize: 9, fontWeight: '700' }, fixed: { color: colors.muted, fontSize: 9 }, fixedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.goldLight },
  excluded: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 9, backgroundColor: colors.softGold }, excludedText: { color: colors.brand, fontSize: 8, fontWeight: '700' },
  toggle: { width: 38, height: 22, borderRadius: 12, padding: 2, justifyContent: 'center', backgroundColor: '#D8D1C3' }, toggleActive: { backgroundColor: colors.brand },
  toggleKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.paper }, toggleKnobActive: { alignSelf: 'flex-end' },
  intro: { color: colors.muted, fontSize: 12 }, service: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 16 },
  included: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#EEF1E6', borderRadius: 14 }, includedText: { color: colors.success, fontSize: 10, fontWeight: '700' },
  servicePrice: { color: colors.brand, fontSize: 13, fontWeight: '700' }, noteShell: { minHeight: 78, padding: 11, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 13 },
  noteInput: { minHeight: 56, color: colors.ink, fontSize: 12, padding: 0, textAlignVertical: 'top' }, empty: { alignItems: 'center', gap: 7, padding: 28, backgroundColor: colors.paper, borderRadius: 17, borderWidth: 1, borderColor: colors.line },
  summary: { gap: 5, padding: 12, backgroundColor: colors.paper, borderRadius: 16, borderWidth: 1, borderColor: colors.line }, summaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryTitle: { color: colors.ink, fontSize: 15, fontWeight: '700', fontFamily: serif }, summaryRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingVertical: 2 },
  summaryLabel: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 16 }, summaryValue: { flex: 1.35, color: colors.ink, fontSize: 11, lineHeight: 16, textAlign: 'right' },
  strong: { color: colors.ink, fontWeight: '800' }, goldText: { color: colors.brand, fontSize: 16, fontFamily: serif },
  totalCard: { gap: 5, padding: 12, backgroundColor: colors.paper, borderRadius: 16, borderWidth: 1, borderColor: colors.line }, divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginVertical: 2 },
  depositHint: { color: colors.muted, fontSize: 9, textAlign: 'right' }, promo: { minHeight: 45, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, backgroundColor: colors.paper, borderRadius: 12, borderWidth: 1, borderColor: colors.line },
  promoInput: { flex: 1, minHeight: 43, paddingVertical: 0, color: colors.ink, fontSize: 12 }, notice: { flexDirection: 'row', gap: 7, padding: 11, backgroundColor: colors.softGold, borderRadius: 12 },
  noticeText: { flex: 1, color: colors.muted, fontSize: 10, lineHeight: 15 }, terms: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  termsAccept: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 },
  checkbox: { width: 21, height: 21, borderRadius: 6, borderWidth: 1.5, borderColor: colors.gold, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.brand, borderColor: colors.brand },
  termsText: { flex: 1, color: colors.ink, fontSize: 11, fontWeight: '600' },
  termsDetails: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 36 }, termsLink: { color: colors.brand, fontSize: 10, fontWeight: '700' },
  termsBox: { padding: 10, backgroundColor: colors.paper, borderRadius: 12, borderWidth: 1, borderColor: colors.line },
  footerSafe: { backgroundColor: colors.paper, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }, footer: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 9 },
  footerLabel: { color: colors.muted, fontSize: 9 }, footerPrice: { color: colors.ink, fontSize: 17, lineHeight: 21, fontWeight: '800', fontFamily: serif }, footerHint: { color: colors.muted, fontSize: 8 },
  goldButton: { minWidth: 96, minHeight: 44, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.brand },
  goldButtonText: { color: colors.paper, fontSize: 12, fontWeight: '800' }, disabled: { opacity: .5 },
});
