import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '@/api';
import { PartnerVenueSelector } from '@/partner-venue-selector';
import type { Venue } from '@/types';
import { Card, Screen, s } from '@/ui';
import { colors } from '@/theme';
import { useTranslation } from 'react-i18next';
import { appLocale, formatCurrency } from '@/format';
import { getAppLanguage } from '@/i18n';

type ReportData = { totalBookings: number; confirmedBookings: number; bookedValue: number; collected: number };
type MonthOption = { value: string; label: string; fullLabel: string };

function recentMonths(locale: string, count = 12): MonthOption[] {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return {
      value: `${date.getFullYear()}-${month}`,
      label: new Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit' }).format(date),
      fullLabel: new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date),
    };
  });
}

export default function Report() {
  const { t } = useTranslation();
  const language = getAppLanguage();
  const params = useLocalSearchParams<{ venueId: string; name?: string }>();
  const venueId = Number(params.venueId);
  const months = useMemo(() => recentMonths(appLocale(language)), [language]);
  const [selectedMonth, setSelectedMonth] = useState(months[0].value);
  const [data, setData] = useState<ReportData>();
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async (month: string, first = false) => {
    const currentRequest = ++requestId.current;
    if (first) setLoading(true);
    else setChanging(true);
    try {
      const report = await api.partnerReport(venueId, month);
      if (currentRequest === requestId.current) setData(report);
    } finally {
      if (currentRequest === requestId.current) {
        if (first) setLoading(false);
        else setChanging(false);
      }
    }
  }, [venueId]);

  useEffect(() => { void load(months[0].value, true); }, [load, months]);

  const current = months.find(item => item.value === selectedMonth) || months[0];
  const total = Number(data?.totalBookings || 0);
  const confirmed = Number(data?.confirmedBookings || 0);
  const confirmationRate = total ? Math.round(confirmed / total * 100) : 0;
  const booked = Number(data?.bookedValue || 0);
  const collected = Number(data?.collected || 0);
  const collectionRate = booked ? Math.min(100, Math.round(collected / booked * 100)) : 0;

  const selectVenue = (venue: Venue) => {
    setData(undefined);
    setSelectedMonth(months[0].value);
    setLoading(true);
    router.setParams({ venueId: String(venue.id), name: venue.name });
  };

  return <Screen title={t('partnerReport.title')} subtitle={params.name || t('partnerReport.selectedVenue')} loading={loading} partnerNav={{ venueId, venueName: params.name }}>
    <PartnerVenueSelector venueId={venueId} venueName={params.name} onSelect={selectVenue}/>
    <Text style={styles.sectionLabel}>{t('partnerReport.selectMonth')}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.months}>
      {months.map(month => <Pressable key={month.value} onPress={() => { setSelectedMonth(month.value); void load(month.value); }} style={[styles.month, selectedMonth === month.value && styles.monthActive]}>
        <Text style={[styles.monthText, selectedMonth === month.value && styles.monthTextActive]}>{month.label}</Text>
      </Pressable>)}
    </ScrollView>

    <View style={styles.heading}><Text style={styles.title}>{current.fullLabel}</Text>{changing && <Text style={styles.loadingText}>{t('partnerReport.updating')}</Text>}</View>
    <View style={styles.grid}>
      <Metric label={t('partnerReport.totalBookings')} value={total}/>
      <Metric label={t('partnerReport.confirmed')} value={confirmed}/>
      <Metric label={t('partnerReport.bookingValue')} value={formatCurrency(booked, language)}/>
      <Metric label={t('partnerReport.collected')} value={formatCurrency(collected, language)}/>
    </View>

    <Card>
      <Text style={s.h1}>{t('partnerReport.monthlyMetrics')}</Text>
      <Progress label={t('partnerReport.confirmationRate')} value={confirmationRate}/>
      <Progress label={t('partnerReport.collectionRate')} value={collectionRate}/>
    </Card>
  </Screen>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <Card style={styles.metric}><Text style={s.muted}>{label}</Text><Text style={styles.metricValue}>{value}</Text></Card>;
}

function Progress({ label, value }: { label: string; value: number }) {
  return <View style={styles.progressBlock}>
    <View style={styles.progressHeader}><Text style={styles.progressLabel}>{label}</Text><Text style={styles.progressValue}>{value}%</Text></View>
    <View style={styles.track}><View style={[styles.fill, { width: `${value}%` }]}/></View>
  </View>;
}

const styles = StyleSheet.create({
  sectionLabel: { color: colors.muted, fontSize: 9, fontWeight: '700', letterSpacing: .8, marginLeft: 4, marginBottom: -5 },
  months: { gap: 7, paddingRight: 12 },
  month: { minWidth: 67, height: 35, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 11, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  monthActive: { borderColor: colors.brand, backgroundColor: colors.brand },
  monthText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  monthTextActive: { color: colors.paper },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.ink, fontSize: 20, fontWeight: '800', fontFamily: 'serif' },
  loadingText: { color: colors.brand, fontSize: 9 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { width: '48%', flexGrow: 1 },
  metricValue: { color: colors.ink, fontSize: 18, lineHeight: 25, fontWeight: '800', fontFamily: 'serif' },
  progressBlock: { gap: 7, marginTop: 13 },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressLabel: { color: colors.muted, fontSize: 11 },
  progressValue: { color: colors.brand, fontSize: 12, fontWeight: '800' },
  track: { height: 8, overflow: 'hidden', borderRadius: 5, backgroundColor: colors.softGold },
  fill: { height: '100%', borderRadius: 5, backgroundColor: colors.brand },
});
