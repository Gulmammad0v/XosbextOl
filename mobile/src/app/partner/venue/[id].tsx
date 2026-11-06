import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api';
import type { VenueDetail } from '@/types';
import { Badge, Card, Empty, Screen, s } from '@/ui';
import { colors } from '@/theme';
import { useTranslation } from 'react-i18next';

export default function ManageVenue() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>(); const venueId = Number(id);
  const [detail, setDetail] = useState<VenueDetail>(); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => setDetail(await api.partnerVenue(venueId)), [venueId]);
  useFocusEffect(useCallback(() => { load().finally(() => setLoading(false)); }, [load]));
  const refresh = async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } };
  if (!detail) return <Screen loading={loading}><Empty/></Screen>;
  const params = { venueId, name: detail.venue.name };
  const sections = [
    { icon: 'information-circle-outline' as const, title: t('manageVenue.basicInfo'), subtitle: t('manageVenue.basicInfoSubtitle'), go: () => router.push({ pathname: '/partner/onboarding', params: { venueId, section: 0 } } as any) },
    { icon: 'options-outline' as const, title: t('manageVenue.amenities'), subtitle: t('manageVenue.amenitiesCount', { count: detail.amenities.length }), go: () => router.push({ pathname: '/partner/amenities', params } as any) },
    { icon: 'images-outline' as const, title: t('manageVenue.photos'), subtitle: t('manageVenue.photosCount', { count: detail.media.filter(item => !(item.hallId ?? item.hall_id)).length }), go: () => router.push({ pathname: '/partner/photos', params } as any) },
    { icon: 'business-outline' as const, title: t('partnerHalls.title'), subtitle: t('manageVenue.hallsCount', { count: detail.halls.length }), go: () => router.push({ pathname: '/partner/halls', params } as any) },
    { icon: 'restaurant-outline' as const, title: t('partnerMenus.title'), subtitle: t('manageVenue.menusCount', { count: detail.menus.length }), go: () => router.push({ pathname: '/partner/menus', params } as any) },
    { icon: 'briefcase-outline' as const, title: t('manageVenue.companyInfo'), subtitle: t('manageVenue.companyInfoSubtitle'), go: () => router.push({ pathname: '/partner/onboarding', params: { venueId, section: 3 } } as any) },
    { icon: 'sparkles-outline' as const, title: t('manageVenue.services'), subtitle: t('manageVenue.servicesCount', { count: detail.services.length }), go: () => router.push({ pathname: '/partner/services', params } as any) },
  ];
  return <Screen title={detail.venue.name} subtitle={t('manageVenue.subtitle')} loading={loading} refreshing={refreshing} onRefresh={refresh}>
    <Card><View style={s.titleRow}><Badge value={detail.venue.status}/><View style={{ flex: 1 }}/><Text style={styles.rating}>★ {Number(detail.venue.ratingAvg ?? detail.venue.rating ?? 0).toFixed(1)}</Text><Text style={s.muted}>{t('manageVenue.reviews', { count: detail.venue.reviewCount || 0 })}</Text></View></Card>
    <View style={styles.group}>{sections.map((item, index) => <Pressable key={item.title} onPress={item.go} style={[styles.row, index < sections.length - 1 && styles.border]}><View style={styles.icon}><Ionicons name={item.icon} size={20} color={colors.brandDark}/></View><View style={{ flex: 1 }}><Text style={s.h2}>{item.title}</Text><Text style={s.muted}>{item.subtitle}</Text></View><Ionicons name="chevron-forward" size={17} color={colors.muted}/></Pressable>)}</View>
  </Screen>;
}
const styles = StyleSheet.create({ rating: { color: colors.brandDark, fontWeight: '800' }, group: { overflow: 'hidden', borderRadius: 17, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line }, row: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }, border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, icon: { width: 38, height: 38, borderRadius: 11, backgroundColor: colors.softGold, alignItems: 'center', justifyContent: 'center' } });
