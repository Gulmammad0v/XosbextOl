import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api';
import type { Hall, VenueDetail } from '@/types';
import { Empty, Screen, run, s } from '@/ui';
import { colors } from '@/theme';
import { useTranslation } from 'react-i18next';

export default function Halls() {
  const { t } = useTranslation();
  const p = useLocalSearchParams<{ venueId: string; name?: string }>();
  const venueId = Number(p.venueId);
  const [detail, setDetail] = useState<VenueDetail>();
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<number>();
  const load = useCallback(async () => setDetail(await api.partnerVenue(venueId)), [venueId]);
  useFocusEffect(useCallback(() => {
    let active = true;
    load().finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load]));

  const edit = (hall: Hall) => router.push({
    pathname: '/partner/hall-form',
    params: { venueId, hallId: hall.id, name: p.name, hallName: hall.name },
  } as any);
  const add = () => router.push({ pathname: '/partner/hall-form', params: { venueId, name: p.name } } as any);

  const toggle = async (hall: Hall) => {
    if (togglingId !== undefined) return;
    setTogglingId(hall.id);
    try {
      const success = await run(() => api.saveHall(venueId, {
        name: hall.name,
        capacityMin: hall.capacityMin,
        capacityMax: hall.capacityMax,
        pricePerPerson: hall.pricePerPerson || 0,
        depositPercent: hall.depositPercent || 1,
        active: !hall.active,
      }, hall.id));
      if (success) await load();
    } finally {
      setTogglingId(undefined);
    }
  };

  const halls = detail?.halls || [];
  const activeCount = halls.filter(hall => hall.active).length;

  return <Screen title={t('partnerHalls.title')} subtitle={p.name} loading={loading} footer={
    <Pressable accessibilityRole="button" onPress={add} style={({ pressed }) => [styles.footerButton, pressed && styles.pressed]}>
      <Text style={styles.footerButtonText}>{t('partnerHalls.newHall')}</Text>
    </Pressable>
  }>
    {!!halls.length && <Text style={styles.summary}>{t('partnerHalls.summary', { count: halls.length, active: activeCount })}</Text>}
    {!halls.length ? <Empty text={t('partnerHalls.empty')}/> : halls.map(hall => {
      const hallMedia = detail?.media.filter(media => (media.hallId ?? media.hall_id) === hall.id) || [];
      const cover = hallMedia[0];
      return <View key={hall.id} style={styles.card}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('partnerHalls.editLabel', { name: hall.name })} onPress={() => edit(hall)} style={({ pressed }) => [styles.cardTop, pressed && styles.pressed]}>
          {cover
            ? <Image source={{ uri: cover.thumbUrl || cover.thumb_url || cover.url }} style={styles.photo}/>
            : <View style={styles.photoPlaceholder}><Ionicons name="image-outline" size={25} color={colors.brandDark}/></View>}
          <View style={styles.cardDetails}>
            <Text style={s.h1}>{hall.name}</Text>
            <Text style={styles.capacity}>{t('partnerHalls.capacity', { min: hall.capacityMin, max: hall.capacityMax })}</Text>
            <View style={[styles.badge, !hallMedia.length && styles.badgeMissing]}>
              <Text style={[styles.badgeText, !hallMedia.length && styles.badgeMissingText]}>{hallMedia.length ? t('partnerHalls.photos', { count: hallMedia.length }) : t('partnerHalls.photoNeeded')}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted}/>
        </Pressable>
        <View style={styles.separator}/>
        <View style={styles.statusRow}>
          <Text style={styles.statusText}>{t('partnerHalls.acceptsBookings')}</Text>
          <AvailabilitySwitch active={hall.active} disabled={togglingId !== undefined} onPress={() => void toggle(hall)}/>
        </View>
      </View>;
    })}
    {!!halls.length && <View style={styles.info}>
      <Ionicons name="information-circle-outline" size={17} color={colors.brandDark}/>
      <Text style={styles.infoText}>{t('partnerHalls.feeInfo')}</Text>
    </View>}
  </Screen>;
}

function AvailabilitySwitch({ active, disabled, onPress }: { active: boolean; disabled?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="switch" accessibilityState={{ checked: active, disabled }} disabled={disabled} onPress={onPress} style={[styles.switch, active && styles.switchActive, disabled && { opacity: .55 }]}>
    <View style={[styles.knob, active && styles.knobActive]}/>
  </Pressable>;
}

const styles = StyleSheet.create({
  summary: { color: colors.muted, fontSize: 12, marginBottom: 1 },
  card: { backgroundColor: colors.paper, borderRadius: 17, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  cardTop: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13 },
  photo: { width: 62, height: 62, borderRadius: 12, backgroundColor: colors.softGold },
  photoPlaceholder: { width: 62, height: 62, borderRadius: 12, backgroundColor: '#E4D2A8', alignItems: 'center', justifyContent: 'center' },
  cardDetails: { flex: 1, alignItems: 'flex-start', gap: 2 },
  capacity: { color: colors.muted, fontSize: 12 },
  badge: { marginTop: 2, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, backgroundColor: colors.softGold },
  badgeText: { color: colors.brandDark, fontSize: 9, fontWeight: '600' },
  badgeMissing: { backgroundColor: '#F9E5E2' },
  badgeMissingText: { color: colors.danger },
  separator: { height: StyleSheet.hairlineWidth, marginHorizontal: 13, backgroundColor: colors.line },
  statusRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13 },
  statusText: { color: colors.ink, fontSize: 12 },
  switch: { width: 43, height: 25, padding: 3, borderRadius: 14, backgroundColor: '#D9CFB9' },
  switchActive: { backgroundColor: colors.brand },
  knob: { width: 19, height: 19, borderRadius: 10, backgroundColor: colors.paper },
  knobActive: { alignSelf: 'flex-end' },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 13, borderRadius: 13, backgroundColor: colors.softBrand },
  infoText: { flex: 1, color: colors.ink, fontSize: 11, lineHeight: 16 },
  footerButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: colors.brand },
  footerButtonText: { color: colors.paper, fontSize: 14, fontWeight: '800' },
  pressed: { opacity: .65 },
});
