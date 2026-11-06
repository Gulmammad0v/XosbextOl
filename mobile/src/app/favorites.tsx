import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { api } from '@/api';
import type { Venue } from '@/types';
import { Button, Card, Empty, ErrorText, HeroImage, Screen, s, run } from '@/ui';
import { colors } from '@/theme';

export default function Favorites() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Venue[]>([]); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [loadError, setLoadError] = useState<string>();
  const load = useCallback(async () => {
    try {
      setLoadError(undefined);
      const data = await api.favorites();
      setItems(data.content || []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    }
  }, []);
  useFocusEffect(useCallback(() => { load().finally(() => setLoading(false)); }, [load]));
  const refresh = async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } };
  return <Screen title={t('favorites.title')} subtitle={t('favorites.subtitle')} loading={loading} refreshing={refreshing} onRefresh={refresh} back>
    {loadError ? <Card><ErrorText error={loadError}/><Button title={t('common.retry')} compact variant="secondary" onPress={load}/></Card> : null}
    {!loadError && !items.length ? <Empty text={t('favorites.empty')}/> : items.map(venue => <Card key={venue.id} onPress={() => router.push(`/venue/${venue.id}` as any)}>
      <HeroImage uri={venue.coverImageUrl} compact/>
      <View style={s.titleRow}><View style={{ flex: 1 }}><Text style={s.h1}>{venue.name}</Text><Text style={s.muted}>{venue.address}</Text></View><View style={{ alignItems: 'flex-end' }}><Text style={{ color: '#A06A17', fontWeight: '900' }}>★ {Number(venue.rating ?? venue.ratingAvg ?? venue.rating_avg ?? 0).toFixed(1)}</Text><Text style={s.muted}>{t('favorites.reviews', { count: venue.reviewCount || 0 })}</Text></View></View>
      <View style={s.actions}><Button title={t('favorites.details')} compact onPress={() => router.push(`/venue/${venue.id}` as any)}/><Pressable accessibilityRole="button" accessibilityLabel={t('favorites.remove')} onPress={event => { event.stopPropagation(); void run(async () => { await api.unfavorite(venue.id); await load(); }); }} style={({ pressed }) => [styles.favoriteButton, pressed && { opacity: .6 }]}><Ionicons name="heart" size={19} color={colors.danger}/><Text style={styles.favoriteText}>{t('venueDetails.favorite')}</Text></Pressable></View>
    </Card>)}
  </Screen>;
}

const styles = StyleSheet.create({
  favoriteButton: { minHeight: 40, paddingHorizontal: 14, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#F8EAE8', borderWidth: 1, borderColor: '#E9C8C4' },
  favoriteText: { color: colors.danger, fontWeight: '800', fontSize: 15 }
});
