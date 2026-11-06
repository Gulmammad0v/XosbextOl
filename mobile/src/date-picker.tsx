import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, NativeScrollEvent, NativeSyntheticEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, useCompactAndroidLayout } from './theme';
import { appLocale } from './format';
import { getAppLanguage } from './i18n';

function pad(value: number) { return String(value).padStart(2, '0'); }
function toIso(date: Date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function fromIso(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : undefined;
}
function monthKey(date: Date) { return date.getFullYear() * 12 + date.getMonth(); }
function monthIso(date: Date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`; }
function startOfMonth(date: Date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function displayDate(value: string | undefined, locale: string) {
  const date = fromIso(value);
  return date ? new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date) : '';
}
function displayLongDate(value: string | undefined, locale: string) {
  const date = fromIso(value);
  return date ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(date) : '';
}

export function todayIso() { return toIso(new Date()); }

export function yesterdayIso() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return toIso(yesterday);
}

const WHEEL_ITEM_HEIGHT = 48;
const WHEEL_VISIBLE_ITEMS = 5;

type WheelOption = { value: number; label: string };

function WheelColumn({ label, options, value, onChange }: {
  label: string;
  options: WheelOption[];
  value: number;
  onChange: (value: number) => void;
}) {
  const list = useRef<FlatList<WheelOption>>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value));

  useEffect(() => {
    if (!options.length) return;
    list.current?.scrollToOffset({ offset: selectedIndex * WHEEL_ITEM_HEIGHT, animated: false });
  }, [options, selectedIndex]);

  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }, []);

  const selectNearest = (offset: number) => {
    const index = Math.max(0, Math.min(options.length - 1, Math.round(offset / WHEEL_ITEM_HEIGHT)));
    const option = options[index];
    if (option && option.value !== value) onChange(option.value);
  };

  return <View style={styles.wheelColumn}>
    <Text style={styles.wheelLabel}>{label}</Text>
    <View style={styles.wheelViewport}>
      <View pointerEvents="none" style={styles.wheelSelection}/>
      <FlatList
        ref={list}
        style={styles.wheelList}
        data={options}
        keyExtractor={option => String(option.value)}
        renderItem={({ item }) => <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${item.label}`}
          accessibilityState={{ selected: item.value === value }}
          onPress={() => {
            onChange(item.value);
            const index = options.findIndex(option => option.value === item.value);
            list.current?.scrollToOffset({ offset: index * WHEEL_ITEM_HEIGHT, animated: true });
          }}
          style={styles.wheelItem}
        >
          <Text style={[styles.wheelItemText, item.value === value && styles.wheelItemTextSelected]}>{item.label}</Text>
        </Pressable>}
        contentContainerStyle={styles.wheelContent}
        getItemLayout={(_, index) => ({ length: WHEEL_ITEM_HEIGHT, offset: WHEEL_ITEM_HEIGHT * index, index })}
        initialScrollIndex={selectedIndex}
        snapToInterval={WHEEL_ITEM_HEIGHT}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onMomentumScrollBegin={() => {
          if (settleTimer.current) clearTimeout(settleTimer.current);
        }}
        onMomentumScrollEnd={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
          if (settleTimer.current) clearTimeout(settleTimer.current);
          selectNearest(event.nativeEvent.contentOffset.y);
        }}
        onScrollEndDrag={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
          const offset = event.nativeEvent.contentOffset.y;
          if (settleTimer.current) clearTimeout(settleTimer.current);
          settleTimer.current = setTimeout(() => selectNearest(offset), 120);
        }}
      />
    </View>
  </View>;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function clampDateParts(year: number, month: number, day: number, minimum: Date, maximum: Date) {
  const date = new Date(year, month - 1, Math.min(day, daysInMonth(year, month)));
  if (date < minimum) return new Date(minimum);
  if (date > maximum) return new Date(maximum);
  return date;
}

/** A compact day/month/year wheel intended for dates far in the past, such as birthdays. */
export function BirthDatePickerField({ label, value, onChange, placeholder, minDate = '1900-01-01', maxDate = yesterdayIso() }: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minDate?: string;
  maxDate?: string;
}) {
  const { t } = useTranslation();
  const locale = appLocale(getAppLanguage());
  const resolvedPlaceholder = placeholder || t('datePicker.selectBirthDate');
  const compactLayout = useCompactAndroidLayout();
  const [visible, setVisible] = useState(false);
  const minimum = useMemo(() => fromIso(minDate) || new Date(1900, 0, 1), [minDate]);
  const maximum = useMemo(() => {
    const parsed = fromIso(maxDate) || fromIso(yesterdayIso())!;
    return parsed < minimum ? minimum : parsed;
  }, [maxDate, minimum]);
  const minimumYear = minimum.getFullYear();
  const maximumYear = maximum.getFullYear();
  const defaultDay = Math.min(maximum.getDate(), daysInMonth(maximum.getFullYear() - 25, maximum.getMonth() + 1));
  const defaultDate = new Date(maximum.getFullYear() - 25, maximum.getMonth(), defaultDay);
  const [draft, setDraft] = useState(() => clampDateParts(defaultDate.getFullYear(), defaultDate.getMonth() + 1, defaultDate.getDate(), minimum, maximum));

  const years = useMemo(() => Array.from(
    { length: maximumYear - minimumYear + 1 },
    (_, index) => minimumYear + index,
  ).map(year => ({ value: year, label: String(year) })), [maximumYear, minimumYear]);

  const monthNames = useMemo(() => Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2024, index, 1))), [locale]);
  const months = useMemo(() => monthNames
    .map((name, index) => ({ value: index + 1, label: name }))
    .filter(option => {
      if (draft.getFullYear() === minimum.getFullYear() && option.value < minimum.getMonth() + 1) return false;
      return draft.getFullYear() !== maximum.getFullYear() || option.value <= maximum.getMonth() + 1;
    }), [draft, maximum, minimum, monthNames]);

  const days = useMemo(() => Array.from(
    { length: daysInMonth(draft.getFullYear(), draft.getMonth() + 1) },
    (_, index) => index + 1,
  ).filter(day => {
    const candidate = new Date(draft.getFullYear(), draft.getMonth(), day);
    return candidate >= minimum && candidate <= maximum;
  }).map(day => ({ value: day, label: pad(day) })), [draft, maximum, minimum]);

  const open = () => {
    const selected = fromIso(value);
    setDraft(selected && selected >= minimum && selected <= maximum
      ? selected
      : clampDateParts(defaultDate.getFullYear(), defaultDate.getMonth() + 1, defaultDate.getDate(), minimum, maximum));
    setVisible(true);
  };
  const updateDraft = (year: number, month: number, day: number) => {
    setDraft(clampDateParts(year, month, day, minimum, maximum));
  };

  return <View style={[styles.field, compactLayout && styles.fieldDense]}>
    <Text style={[styles.label, compactLayout && styles.labelDense]}>{label}</Text>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${displayDate(value, locale) || resolvedPlaceholder}`}
      onPress={open}
      style={({ pressed }) => [styles.inputShell, compactLayout && styles.inputShellDense, pressed && styles.pressed]}
    >
      <Ionicons name="calendar-outline" size={compactLayout ? 17 : 20} color={colors.brand}/>
      <Text maxFontSizeMultiplier={1.15} style={[styles.inputText, compactLayout && styles.inputTextDense, !value && styles.placeholder]}>{displayDate(value, locale) || resolvedPlaceholder}</Text>
      <Ionicons name="chevron-down" size={compactLayout ? 16 : 18} color={colors.muted}/>
    </Pressable>

    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <SafeAreaView style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setVisible(false)}/>
        <View style={styles.wheelModal}>
          <View style={styles.wheelHeader}>
            <View>
              <Text style={styles.wheelTitle}>{label}</Text>
              <Text style={styles.wheelHint}>{t('datePicker.wheelHint')}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={() => setVisible(false)} style={styles.iconClose}>
              <Ionicons name="close" size={22} color={colors.muted}/>
            </Pressable>
          </View>
          <View style={styles.wheels}>
            <WheelColumn label={t('datePicker.day')} options={days} value={draft.getDate()} onChange={day => updateDraft(draft.getFullYear(), draft.getMonth() + 1, day)}/>
            <WheelColumn label={t('datePicker.month')} options={months} value={draft.getMonth() + 1} onChange={month => updateDraft(draft.getFullYear(), month, draft.getDate())}/>
            <WheelColumn label={t('datePicker.year')} options={years} value={draft.getFullYear()} onChange={year => updateDraft(year, draft.getMonth() + 1, draft.getDate())}/>
          </View>
          <View style={styles.wheelActions}>
            <Pressable onPress={() => setVisible(false)} style={styles.cancelButton}><Text style={styles.cancelButtonText}>{t('common.cancel')}</Text></Pressable>
            <Pressable onPress={() => { onChange(toIso(draft)); setVisible(false); }} style={styles.confirmButton}><Text style={styles.confirmButtonText}>{t('datePicker.confirm')}</Text></Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  </View>;
}

export function DatePickerField({ label, value, onChange, placeholder, minDate, maxDate, loadUnavailableDates, displayMode = 'short' }: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minDate?: string;
  maxDate?: string;
  loadUnavailableDates?: (month: string) => Promise<string[]>;
  displayMode?: 'short' | 'long';
}) {
  const { t } = useTranslation();
  const locale = appLocale(getAppLanguage());
  const resolvedPlaceholder = placeholder || t('datePicker.selectDate');
  const monthNames = useMemo(() => Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2024, index, 1))), [locale]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, 1 + index))), [locale]);
  const compactLayout = useCompactAndroidLayout();
  const [visible, setVisible] = useState(false);
  const selected = fromIso(value);
  const minimum = fromIso(minDate);
  const maximum = fromIso(maxDate);
  const initialMonth = selected || minimum || maximum || new Date();
  const [month, setMonth] = useState(() => startOfMonth(initialMonth));
  const [unavailableDates, setUnavailableDates] = useState<Set<string>>(new Set());
  const [loadingUnavailable, setLoadingUnavailable] = useState(false);
  const [availabilityError, setAvailabilityError] = useState(false);
  const visibleMonth = monthIso(month);
  const displayedValue = displayMode === 'long' ? displayLongDate(value, locale) : displayDate(value, locale);

  useEffect(() => {
    if (!visible || !loadUnavailableDates) return;
    let active = true;
    setUnavailableDates(new Set());
    setLoadingUnavailable(true);
    setAvailabilityError(false);
    loadUnavailableDates(visibleMonth)
      .then(dates => { if (active) setUnavailableDates(new Set(dates)); })
      .catch(() => { if (active) setAvailabilityError(true); })
      .finally(() => { if (active) setLoadingUnavailable(false); });
    return () => { active = false; };
  }, [loadUnavailableDates, visible, visibleMonth]);

  const days = useMemo(() => {
    const leading = (month.getDay() + 6) % 7;
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(leading).fill(null), ...Array.from({ length: count }, (_, index) => index + 1)];
  }, [month]);
  const canGoBack = !minimum || monthKey(month) > monthKey(minimum);
  const canGoForward = !maximum || monthKey(month) < monthKey(maximum);

  const choose = (day: number) => {
    const next = new Date(month.getFullYear(), month.getMonth(), day);
    const iso = toIso(next);
    if ((minDate && iso < minDate) || (maxDate && iso > maxDate) || unavailableDates.has(iso) || loadingUnavailable || availabilityError) return;
    onChange(iso);
    setVisible(false);
  };
  const open = () => {
    setMonth(startOfMonth(fromIso(value) || fromIso(minDate) || fromIso(maxDate) || new Date()));
    setVisible(true);
  };

  return <View style={[styles.field, compactLayout && styles.fieldDense]}>
    <Text style={[styles.label, compactLayout && styles.labelDense]}>{label}</Text>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${displayedValue || resolvedPlaceholder}`}
      onPress={open}
      style={({ pressed }) => [styles.inputShell, compactLayout && styles.inputShellDense, pressed && styles.pressed]}
    >
      <Ionicons name="calendar-outline" size={compactLayout ? 17 : 20} color={colors.brand}/>
      <Text maxFontSizeMultiplier={1.15} style={[styles.inputText, compactLayout && styles.inputTextDense, !value && styles.placeholder]}>{displayedValue || resolvedPlaceholder}</Text>
      <Ionicons name="chevron-down" size={compactLayout ? 16 : 18} color={colors.muted}/>
    </Pressable>

    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <SafeAreaView style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setVisible(false)}/>
        <View style={styles.calendar}>
          <View style={styles.calendarHeader}>
            <Pressable accessibilityLabel={t('datePicker.previousMonth')} disabled={!canGoBack} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={[styles.arrow, !canGoBack && styles.disabled]}>
              <Ionicons name="chevron-back" size={23} color={colors.brandDark}/>
            </Pressable>
            <Text style={styles.monthTitle}>{monthNames[month.getMonth()]} {month.getFullYear()}</Text>
            <Pressable accessibilityLabel={t('datePicker.nextMonth')} disabled={!canGoForward} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={[styles.arrow, !canGoForward && styles.disabled]}>
              <Ionicons name="chevron-forward" size={23} color={colors.brandDark}/>
            </Pressable>
          </View>
          <View style={styles.weekRow}>{weekDays.map(day => <Text key={day} style={styles.weekDay}>{day}</Text>)}</View>
          <View style={styles.days}>
            {days.map((day, index) => {
              if (day == null) return <View key={`blank-${index}`} style={styles.dayCell}/>;
              const iso = toIso(new Date(month.getFullYear(), month.getMonth(), day));
              const outsideRange = !!((minDate && iso < minDate) || (maxDate && iso > maxDate));
              const booked = unavailableDates.has(iso);
              const unavailable = outsideRange || booked || loadingUnavailable || availabilityError;
              const isSelected = iso === value;
              const isToday = iso === todayIso();
              return <View key={iso} style={styles.dayCell}>
                <Pressable accessibilityRole="button" accessibilityLabel={booked ? t('datePicker.bookedDay', { day }) : String(day)} accessibilityState={{ selected: isSelected, disabled: unavailable }} disabled={unavailable} onPress={() => choose(day)} style={[styles.day, isToday && styles.today, booked && styles.bookedDay, isSelected && styles.selectedDay]}>
                  <Text style={[styles.dayText, unavailable && !booked && styles.unavailableText, booked && styles.bookedText, isSelected && styles.selectedText]}>{day}</Text>
                </Pressable>
              </View>;
            })}
          </View>
          {loadUnavailableDates && <View style={styles.availabilityInfo}>
            <View style={styles.bookedDot}/><Text style={styles.availabilityText}>{t('datePicker.bookedDate')}</Text>
            {loadingUnavailable && <Text style={styles.loadingText}>{t('datePicker.loadingDates')}</Text>}
          </View>}
          {availabilityError && <Text style={styles.errorText}>{t('datePicker.loadError')}</Text>}
          <Pressable onPress={() => setVisible(false)} style={styles.close}><Text style={styles.closeText}>{t('common.close')}</Text></Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  field: { gap: 7 },
  fieldDense: { gap: 5 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  labelDense: { fontSize: 11 },
  inputShell: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 16, paddingHorizontal: 15 },
  inputShellDense: { minHeight: 42, gap: 7, borderRadius: 13, paddingHorizontal: 12 },
  pressed: { opacity: .7 },
  inputText: { flex: 1, color: colors.ink, fontSize: 16 },
  inputTextDense: { fontSize: 13 },
  placeholder: { color: '#9F9688' },
  backdrop: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: 'rgba(45,41,35,.42)' },
  calendar: { backgroundColor: colors.paper, borderRadius: 26, padding: 18, borderWidth: 1, borderColor: colors.line, shadowColor: colors.shadow, shadowOpacity: .18, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  monthTitle: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  arrow: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.softGold, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: .25 },
  weekRow: { flexDirection: 'row', paddingBottom: 7 },
  weekDay: { width: `${100 / 7}%`, textAlign: 'center', color: colors.muted, fontSize: 12, fontWeight: '700' },
  days: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 3 },
  day: { flex: 1, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
  today: { borderWidth: 1, borderColor: colors.gold },
  bookedDay: { backgroundColor: '#F8EAE8', borderWidth: 1, borderColor: '#E9C8C4' },
  selectedDay: { backgroundColor: colors.brand },
  dayText: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  unavailableText: { color: '#C9C2B7' },
  bookedText: { color: colors.danger, textDecorationLine: 'line-through' },
  selectedText: { color: colors.paper, fontWeight: '900' },
  availabilityInfo: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 7, paddingTop: 8 },
  bookedDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#F8EAE8', borderWidth: 1, borderColor: '#E9C8C4' },
  availabilityText: { color: colors.muted, fontSize: 12 },
  loadingText: { marginLeft: 'auto', color: colors.muted, fontSize: 12 },
  errorText: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  close: { alignSelf: 'flex-end', paddingHorizontal: 12, paddingTop: 15, paddingBottom: 3 },
  closeText: { color: colors.brandDark, fontSize: 15, fontWeight: '800' },
  wheelModal: { backgroundColor: colors.paper, borderRadius: 26, padding: 18, borderWidth: 1, borderColor: colors.line, shadowColor: colors.shadow, shadowOpacity: .18, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  wheelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  wheelTitle: { color: colors.ink, fontSize: 20, lineHeight: 25, fontWeight: '800' },
  wheelHint: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 2 },
  iconClose: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.softGold, alignItems: 'center', justifyContent: 'center' },
  wheels: { flexDirection: 'row', gap: 8 },
  wheelColumn: { flex: 1, alignItems: 'stretch' },
  wheelLabel: { color: colors.muted, fontSize: 12, fontWeight: '700', textAlign: 'center', marginBottom: 7 },
  wheelViewport: { height: WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ITEMS, overflow: 'hidden', position: 'relative' },
  wheelSelection: { position: 'absolute', zIndex: 1, left: 0, right: 0, top: WHEEL_ITEM_HEIGHT * 2, height: WHEEL_ITEM_HEIGHT, borderRadius: 12, backgroundColor: colors.softGold, borderWidth: 1, borderColor: colors.goldLight },
  wheelList: { position: 'relative', zIndex: 2 },
  wheelContent: { paddingVertical: WHEEL_ITEM_HEIGHT * 2 },
  wheelItem: { height: WHEEL_ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  wheelItemText: { color: '#A69D90', fontSize: 16, fontWeight: '600' },
  wheelItemTextSelected: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  wheelActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelButton: { flex: 1, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  cancelButtonText: { color: colors.muted, fontSize: 15, fontWeight: '700' },
  confirmButton: { flex: 1, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  confirmButtonText: { color: colors.paper, fontSize: 15, fontWeight: '800' }
});
