import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { colors } from './theme';
import { usePartnerVenue } from './partner-context';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export type PartnerNavContext = { venueId?: number; hallId?: number; venueName?: string };

export function PartnerBottomNav({ venueId, hallId, venueName }: PartnerNavContext) {
  const { t } = useTranslation();
  const path = usePathname();
  const { venueId: contextVenueId, hallId: contextHallId, venueName: contextVenueName, select, resolve } = usePartnerVenue();
  useEffect(() => {
    if (venueId || hallId || venueName) select({ venueId, hallId, venueName });
  }, [hallId, select, venueId, venueName]);
  const selectedVenueId = venueId || contextVenueId;
  const selectedHallId = hallId || contextHallId;
  const selectedVenueName = venueName || contextVenueName;
  const destination = async () => {
    if (selectedVenueId) return { venueId: selectedVenueId, hallId: selectedHallId, venueName: selectedVenueName };
    return resolve();
  };
  const items = [
    { label: t('partner.dashboard'), icon: 'grid-outline' as const, active: path === '/partner', go: () => router.replace('/partner') },
    { label: t('partner.bookings'), icon: 'receipt-outline' as const, active: path.includes('bookings'), go: async () => { const target = await destination(); if (target.venueId) router.replace({ pathname: '/partner/bookings', params: { venueId: target.venueId, name: target.venueName } } as any); else router.replace('/partner/pending-bookings' as any); } },
    { label: t('partner.calendar'), icon: 'calendar-outline' as const, active: path.includes('blocks'), go: async () => { const target = await destination(); router.replace({ pathname: '/partner/blocks', params: { hallId: target.hallId, venueId: target.venueId, name: target.venueName } } as any); } },
    { label: t('partner.profile'), icon: 'person-outline' as const, active: path.includes('profile') || path.includes('report') || path.includes('reviews'), go: () => router.replace('/partner/profile' as any) },
  ];
  return <View style={styles.bar}>{items.map(item => <Pressable
    key={item.label}
    accessibilityRole="tab"
    accessibilityState={{ selected: item.active }}
    onPress={() => { if (!item.active) void item.go(); }}
    style={styles.item}
  ><Ionicons name={item.icon} size={20} color={item.active ? colors.brandDark : colors.muted}/><Text style={[styles.label, item.active && styles.active]}>{item.label}</Text></Pressable>)}</View>;
}

const styles = StyleSheet.create({
  bar: { height: 58, flexDirection: 'row', backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: 8, paddingTop: 7 },
  item: { flex: 1, alignItems: 'center', gap: 2 },
  label: { color: colors.muted, fontSize: 9 },
  active: { color: colors.brandDark, fontWeight: '700' },
});
