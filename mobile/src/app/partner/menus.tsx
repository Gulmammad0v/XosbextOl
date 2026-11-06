import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { api } from '@/api';
import type { VenueDetail } from '@/types';
import { Button, Card, Empty, Screen, confirm, run, s } from '@/ui';
import { colors } from '@/theme';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '@/format';
import { getAppLanguage } from '@/i18n';

export default function Menus() {
  const { t } = useTranslation();
  const language = getAppLanguage();
  const p = useLocalSearchParams<{ venueId: string; name?: string }>(); const venueId = Number(p.venueId);
  const [detail, setDetail] = useState<VenueDetail>(); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => setDetail(await api.partnerVenue(venueId)), [venueId]);
  useFocusEffect(useCallback(() => { load().finally(() => setLoading(false)); }, [load]));
  const remove = (id: number, name: string) => confirm(t('partnerMenus.deleteTitle'), t('partnerMenus.deleteMessage', { name }), () => run(async () => { await api.deleteMenuPackage(venueId, id); await load(); }, t('partnerMenus.deleted')));
  return <Screen title={t('partnerMenus.title')} subtitle={p.name} loading={loading}>
    {!detail?.menus.length ? <Empty text={t('partnerMenus.empty')}/> : detail.menus.map(menu => <Card key={menu.id}><View style={s.titleRow}><View style={{ flex: 1 }}><Text style={s.h1}>{menu.name}</Text><Text style={s.muted}>{menu.description || t('partnerMenus.package')}</Text></View><Text style={styles.price}>{formatCurrency(menu.pricePerPerson, language)}<Text style={styles.per}> {t('partnerMenus.perPerson')}</Text></Text></View><View style={styles.tags}><Text style={styles.tag}>{t('partnerMenus.sections', { count: menu.categories.length })}</Text><Text style={styles.tag}>{t('partnerMenus.items', { count: menu.categories.reduce((sum, item) => sum + item.items.length, 0) })}</Text></View><View style={styles.actions}><Button title={t('common.edit')} compact variant="secondary" onPress={() => router.push({ pathname: '/partner/menu-form', params: { venueId, menuId: menu.id, name: p.name } } as any)}/><Button title="×" compact variant="danger" onPress={() => remove(menu.id, menu.name)}/></View></Card>)}
    <View style={styles.actions}><Button title={t('partnerMenus.fromTemplate')} onPress={() => router.push({ pathname: '/partner/menu-form', params: { venueId, name: p.name, mode: 'standard' } } as any)}/><Button title={t('partnerMenus.emptyMenu')} variant="secondary" onPress={() => router.push({ pathname: '/partner/menu-form', params: { venueId, name: p.name, mode: 'empty' } } as any)}/></View>
  </Screen>;
}
const styles = StyleSheet.create({ price: { color: colors.ink, fontSize: 18, fontFamily: 'serif', fontWeight: '700' }, per: { fontSize: 10, fontWeight: '400' }, tags: { flexDirection: 'row', gap: 7 }, tag: { backgroundColor: colors.softGold, borderRadius: 13, paddingHorizontal: 10, paddingVertical: 5, fontSize: 10 }, actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' } });
