import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { api } from './api';
import { usePartnerVenue } from './partner-context';
import { colors } from './theme';
import type { Venue } from './types';

type Props = {
  venueId: number;
  venueName?: string;
  onSelect: (venue: Venue) => void;
  compact?: boolean;
};

export function PartnerVenueSelector({ venueId, venueName, onSelect, compact = false }: Props) {
  const { t } = useTranslation();
  const partner = usePartnerVenue();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (venues.length) return;
    setLoading(true);
    try {
      const page = await api.partnerVenues(0, 100);
      setVenues(page.content || []);
    } finally {
      setLoading(false);
    }
  }, [venues.length]);

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

  const choose = (venue: Venue) => {
    setOpen(false);
    if (venue.id !== venueId) {
      partner.select({ venueId: venue.id, venueName: venue.name, hallId: undefined });
      onSelect(venue);
    }
  };

  const selectedVenueName = venueName || venues.find(venue => venue.id === venueId)?.name;

  return <>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('venueSelector.select')}
      accessibilityHint={t('venueSelector.hint')}
      onPress={() => { setOpen(true); void load().catch(() => undefined); }}
      style={({ pressed }) => [styles.trigger, compact && styles.triggerCompact, pressed && styles.pressed]}
    >
      {!compact && <Ionicons name="business-outline" size={17} color={colors.brandDark}/>} 
      <Text numberOfLines={1} style={[styles.triggerText, compact && styles.triggerTextCompact]}>{selectedVenueName || t('venueSelector.select')}</Text>
      <Ionicons name="chevron-down" size={compact ? 13 : 16} color={colors.brandDark}/>
    </Pressable>

    <Modal visible={open} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setOpen(false)}>
      <View style={styles.modalRoot}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('venueSelector.closeSelection')} onPress={() => setOpen(false)} style={styles.backdrop}/>
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.handle}/>
          <View style={styles.sheetHeader}>
            <View><Text style={styles.sheetTitle}>{t('venueSelector.select')}</Text><Text style={styles.sheetSubtitle}>{t('venueSelector.subtitle')}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={() => setOpen(false)} hitSlop={8} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={colors.ink}/>
            </Pressable>
          </View>
          {loading ? <View style={styles.loading}><ActivityIndicator color={colors.brand}/><Text style={styles.muted}>{t('venueSelector.loading')}</Text></View> :
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
              {venues.map(venue => {
                const selected = venue.id === venueId;
                return <Pressable
                  key={venue.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => choose(venue)}
                  style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}
                >
                  <View style={[styles.icon, selected && styles.iconSelected]}><Ionicons name="business-outline" size={20} color={selected ? '#fff' : colors.brandDark}/></View>
                  <View style={styles.optionText}>
                    <Text numberOfLines={1} style={styles.venueName}>{venue.name}</Text>
                    {!!venue.address && <Text numberOfLines={1} style={styles.address}>{venue.city ? `${venue.city} · ` : ''}{venue.address}</Text>}
                  </View>
                  {selected && <Ionicons name="checkmark-circle" size={22} color={colors.brand}/>} 
                </Pressable>;
              })}
              {!venues.length && <Text style={styles.empty}>{t('venueSelector.empty')}</Text>}
            </ScrollView>}
        </SafeAreaView>
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  trigger: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 13, borderWidth: 1, borderColor: colors.goldLight, backgroundColor: colors.paper },
  triggerCompact: { alignSelf: 'flex-start', minHeight: 24, maxWidth: '100%', paddingHorizontal: 0, paddingVertical: 2, gap: 3, borderWidth: 0, backgroundColor: 'transparent' },
  triggerText: { flex: 1, color: colors.ink, fontSize: 12, fontWeight: '700' },
  triggerTextCompact: { flex: 0, maxWidth: '90%', color: colors.brandDark, fontSize: 10, lineHeight: 15, fontWeight: '600' },
  pressed: { opacity: .65 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', inset: 0, backgroundColor: 'rgba(28, 26, 23, .48)' },
  sheet: { maxHeight: '72%', minHeight: 310, paddingHorizontal: 14, paddingBottom: 10, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: colors.paper },
  handle: { alignSelf: 'center', width: 34, height: 4, marginTop: 8, marginBottom: 15, borderRadius: 2, backgroundColor: '#D6C7AA' },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  sheetTitle: { color: colors.ink, fontSize: 20, lineHeight: 26, fontWeight: '800', fontFamily: 'serif' },
  sheetSubtitle: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  closeButton: { width: 35, height: 35, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.cream },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 9, paddingVertical: 45 },
  muted: { color: colors.muted, fontSize: 11 },
  list: { gap: 8, paddingBottom: 12 },
  option: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 15, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  optionSelected: { borderColor: colors.gold, backgroundColor: colors.softGold },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: colors.cream },
  iconSelected: { backgroundColor: colors.brand },
  optionText: { flex: 1, minWidth: 0 },
  venueName: { color: colors.ink, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  address: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 2 },
  empty: { color: colors.muted, fontSize: 12, textAlign: 'center', paddingVertical: 44 },
});
