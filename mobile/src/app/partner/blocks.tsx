import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '@/api';
import { PartnerVenueSelector } from '@/partner-venue-selector';
import type { Hall, Venue, VenueDetail } from '@/types';
import { Button, Card, Chips, Empty, Field, FormModal, Screen, confirm, run, s } from '@/ui';
import { colors } from '@/theme';
import { useTranslation } from 'react-i18next';
import { appLocale, formatDate } from '@/format';
import { getAppLanguage } from '@/i18n';

const iso = (year: number, month: number, day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export default function Blocks() {
  const { t } = useTranslation();
  const language = getAppLanguage();
  const locale = appLocale(language);
  const dayNames = Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, index + 1)));
  const p = useLocalSearchParams<{ hallId?: string; venueId?: string; name?: string }>();
  const venueId = Number(p.venueId || 0);
  const [detail, setDetail] = useState<VenueDetail>();
  const [hallId, setHallId] = useState(Number(p.hallId || 0));
  const [items, setItems] = useState<any[]>([]);
  const [occupiedItems, setOccupiedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState('');
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const load = useCallback(async () => {
    let venue = detail;
    if (venueId && venue?.venue.id !== venueId) {
      venue = await api.partnerVenue(venueId);
      setDetail(venue);
    }
    if (!venue?.halls.length) { setItems([]); setOccupiedItems([]); return; }
    const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
    const selectedHalls = hallId ? venue.halls.filter(item => item.id === hallId) : venue.halls;
    const results = await Promise.all(selectedHalls.map(async selectedHall => ({
      hall: selectedHall,
      availability: await api.availability(selectedHall.id, monthKey),
    })));
    setItems(results.flatMap(({ hall: selectedHall, availability }) => (availability.blocked || []).map((item: any) => ({ ...item, hallId: selectedHall.id, hallName: selectedHall.name }))));
    setOccupiedItems(results.flatMap(({ hall: selectedHall, availability }) => (availability.occupied || []).map((item: any) => ({ ...item, hallId: selectedHall.id, hallName: selectedHall.name }))));
  }, [detail, hallId, month, venueId]);
  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);
  const hall: Hall | undefined = detail?.halls.find(item => item.id === hallId);
  const blocked = useMemo(() => groupByDate(items, item => item.blocked_date || item.blockedDate || item.date), [items]);
  const occupied = useMemo(() => groupByDate(occupiedItems, item => item.date || item.eventDate), [occupiedItems]);
  const firstDay = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: days }, (_, index) => index + 1)];
  const save = () => run(async () => {
    const targetHallIds = hallId ? [hallId] : (detail?.halls.map(item => item.id) || []);
    await Promise.all(targetHallIds.map(targetHallId => api.block(targetHallId, { date: selected, reason: reason.trim() })));
    setOpen(false); setReason(''); await load();
  }, hallId ? t('partnerCalendar.dateBlocked') : t('partnerCalendar.allBlocked'));
  const move = (amount: number) => setMonth(value => new Date(value.getFullYear(), value.getMonth() + amount, 1));
  const selectDay = (day: number) => {
    const date = iso(month.getFullYear(), month.getMonth(), day);
    const entries = blocked.get(date) || [];
    setSelected(date);
    if (entries.length) confirm(t('partnerCalendar.reopenTitle'), t('partnerCalendar.reopenMessage', { date: formatDate(`${date}T12:00:00`, language), target: hallId ? t('common.hall') : t('partnerCalendar.allHalls') }), () => run(async () => {
      await Promise.all(entries.map(entry => api.unblock(entry.hallId || hallId, entry.id)));
      await load();
    }));
  };
  const selectVenue = (venue: Venue) => {
    setHallId(0);
    setItems([]);
    setOccupiedItems([]);
    setSelected('');
    setReason('');
    setLoading(true);
    router.setParams({ venueId: String(venue.id), name: venue.name, hallId: '' });
  };
  return <Screen title={t('partnerCalendar.title')} subtitle={t('partnerCalendar.blockedDates')} loading={loading} partnerNav={{ venueId: venueId || detail?.venue.id, hallId, venueName: p.name || detail?.venue.name }}>
    <PartnerVenueSelector venueId={venueId} venueName={p.name || detail?.venue.name} onSelect={selectVenue}/>
    {detail?.halls.length ? <Chips options={[{ value: 0, label: t('partnerCalendar.allHalls') }, ...detail.halls.map(item => ({ value: item.id, label: item.name }))]} value={hallId} onChange={value => setHallId(Number(value))}/> : null}
    <View style={styles.monthRow}><Pressable onPress={() => move(-1)} style={s.backButton}><Text>‹</Text></Pressable><Text style={styles.month}>{new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(month)}</Text><Pressable onPress={() => move(1)} style={s.backButton}><Text>›</Text></Pressable></View>
    {!detail?.halls.length ? <Empty text={t('partnerCalendar.addHall')}/> : <>
      <View style={styles.calendar}>
        {dayNames.map(name => <Text key={name} style={styles.dayName}>{name}</Text>)}
        {cells.map((day, index) => {
          if (!day) return <View key={`empty-${index}`} style={styles.day}/>;
          const date = iso(month.getFullYear(), month.getMonth(), day);
          const blockedEntries = blocked.get(date) || [];
          const reservations = occupied.get(date) || [];
          const isSelected = selected === date;
          return <Pressable key={date} onPress={() => selectDay(day)} style={[styles.day, reservations.length > 0 && styles.reserved, blockedEntries.length > 0 && styles.blocked, isSelected && styles.selected]}><Text style={[styles.dayText, isSelected && styles.selectedText]}>{day}</Text>{reservations.length > 0 && <Text style={styles.dayHint}>{hallId ? t('partnerCalendar.reservedShort') : t('partnerCalendar.hallCount', { count: reservations.length })}</Text>}{blockedEntries.length > 0 && <Text style={styles.dayHint}>{hallId ? t('partnerCalendar.blockedShort') : t('partnerCalendar.blockedCount', { count: blockedEntries.length })}</Text>}</Pressable>;
        })}
      </View>
      <View style={styles.legend}><Legend color="#E9DAB0" label={t('partnerCalendar.reserved')}/><Legend color="#EEE9DF" label={t('partnerCalendar.blocked')}/><Legend color="#fff" label={t('partnerCalendar.selected')} border/></View>
      <Card><Text style={s.h1}>{selected ? formatDate(`${selected}T12:00:00`, language, { day: 'numeric', month: 'long' }) : t('partnerCalendar.selectDateFor', { target: hall?.name || t('partnerCalendar.allHalls') })}</Text>{selected && (occupied.get(selected)?.length || 0) > 0 ? <Text style={styles.reservationInfo}>{t('partnerCalendar.hasReservation', { halls: occupied.get(selected)!.map(item => item.hallName).join(', ') })}</Text> : selected && (blocked.get(selected)?.length || 0) > 0 ? <Text style={s.muted}>{blocked.get(selected)!.map(item => `${item.hallName}: ${item.reason || t('partnerCalendar.isBlocked')}`).join('\n')}</Text> : <><Field label={t('partnerCalendar.reason')} value={reason} onChangeText={setReason} placeholder={t('partnerCalendar.reasonPlaceholder')}/><Button title={hallId ? t('partnerCalendar.blockDate') : t('partnerCalendar.blockAll')} onPress={() => setOpen(true)} disabled={!selected || selected < iso(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())}/></>}{(items.length > 0 || occupiedItems.length > 0) && <Text style={s.muted}>{t('partnerCalendar.summary', { reservations: occupiedItems.length, blocked: items.length })}</Text>}</Card>
    </>}
    <FormModal visible={open} title={t('partnerCalendar.blockTitle')} onClose={() => setOpen(false)}><Text style={s.body}>{t('partnerCalendar.blockMessage', { date: selected ? formatDate(`${selected}T12:00:00`, language) : '', target: hall?.name || t('partnerCalendar.allHallsLower') })}</Text><Button title={t('common.confirm')} onPress={save}/></FormModal>
  </Screen>;
}

function Legend({ color, label, border }: { color: string; label: string; border?: boolean }) { return <View style={styles.legendItem}><View style={[styles.legendBox, { backgroundColor: color }, border && { borderWidth: 1, borderColor: colors.ink }]}/><Text style={s.muted}>{label}</Text></View>; }
function groupByDate(items: any[], dateOf: (item: any) => string) {
  const grouped = new Map<string, any[]>();
  items.forEach(item => { const date = dateOf(item); grouped.set(date, [...(grouped.get(date) || []), item]); });
  return grouped;
}
const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, month: { color: colors.ink, fontSize: 19, fontFamily: 'serif', fontWeight: '700' },
  calendar: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 }, dayName: { width: '12.9%', textAlign: 'center', color: colors.muted, fontSize: 10, marginBottom: 2 }, day: { width: '12.9%', height: 42, borderRadius: 9, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, reserved: { backgroundColor: '#E9DAB0', borderColor: '#E9DAB0' }, blocked: { backgroundColor: '#EEE9DF' }, selected: { borderColor: colors.ink, borderWidth: 2 }, dayText: { color: colors.ink, fontSize: 12 }, selectedText: { fontWeight: '800' }, dayHint: { fontSize: 7, color: colors.brandDark },
  reservationInfo: { color: colors.brandDark, fontSize: 12, lineHeight: 18, backgroundColor: colors.softGold, borderRadius: 10, padding: 10 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 14 }, legendItem: { flexDirection: 'row', gap: 5, alignItems: 'center' }, legendBox: { width: 12, height: 12, borderRadius: 3 }
});
