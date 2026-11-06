import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { api } from '@/api';
import type { ExtraService, VenueDetail } from '@/types';
import { Button, Empty, Field, FormModal, Screen, confirm, run } from '@/ui';
import { colors } from '@/theme';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '@/format';
import { getAppLanguage } from '@/i18n';

type Availability = 'INCLUDED' | 'PAID' | 'UNAVAILABLE';
type Draft = { availability: Availability; price: string; priceType: string };

const availabilityOptions: Availability[] = ['INCLUDED', 'PAID', 'UNAVAILABLE'];

export default function Services() {
  const { t } = useTranslation();
  const p = useLocalSearchParams<{ venueId: string; name?: string }>();
  const venueId = Number(p.venueId);
  const [detail, setDetail] = useState<VenueDetail>();
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<number>();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const load = useCallback(async () => {
    const next = await api.partnerVenue(venueId);
    setDetail(next);
    setDrafts(Object.fromEntries(next.services.map(item => [item.id, {
      availability: !item.active ? 'UNAVAILABLE' : Number(item.price) > 0 ? 'PAID' : 'INCLUDED',
      price: String(item.price || ''),
      priceType: item.priceType || item.price_type || 'FIXED',
    }])));
    setExpandedId(current => current && next.services.some(item => item.id === current) ? current : next.services[0]?.id);
  }, [venueId]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]));

  const update = (id: number, patch: Partial<Draft>) => setDrafts(value => ({ ...value, [id]: { ...value[id], ...patch } }));
  const save = (service: ExtraService) => run(async () => {
    const draft = drafts[service.id];
    setBusy(true);
    try {
      await api.updateService(venueId, service.id, {
        name: service.name,
        description: service.description || null,
        active: draft.availability !== 'UNAVAILABLE',
        price: draft.availability === 'PAID' ? Number(draft.price) : 0,
        priceType: draft.priceType,
      });
      await load();
    } finally {
      setBusy(false);
    }
  }, t('partnerServices.saved'));
  const add = () => run(async () => {
    setBusy(true);
    try {
      const result = await api.addService(venueId, { name: name.trim(), description: description.trim() || null, price: 0, priceType: 'FIXED', active: true }) as { id?: number } | undefined;
      setOpen(false);
      setName('');
      setDescription('');
      await load();
      if (result?.id) setExpandedId(result.id);
    } finally {
      setBusy(false);
    }
  }, t('partnerServices.added'));
  const remove = (service: ExtraService) => confirm(t('partnerServices.deleteTitle'), t('partnerServices.deleteMessage', { name: service.name }), () => {
    void run(async () => {
      setBusy(true);
      try { await api.deleteService(venueId, service.id); await load(); }
      finally { setBusy(false); }
    }, t('partnerServices.deleted'));
  });

  const activeCount = detail?.services.filter(item => item.active).length || 0;
  return <Screen
    title={t('partnerServices.title')}
    subtitle={p.name}
    loading={loading}
    footer={<Button title={t('partnerServices.newService')} onPress={() => setOpen(true)} disabled={busy}/>}
  >
    <Text style={styles.summary}>{t('partnerServices.summary', { count: detail?.services.length || 0, active: activeCount })}</Text>
    {!detail?.services.length ? <Empty text={t('partnerServices.empty')}/> : detail.services.map(service => {
      const draft = drafts[service.id];
      if (!draft) return null;
      const expanded = expandedId === service.id;
      return <View key={service.id} style={[styles.card, expanded && styles.cardExpanded]}>
        <Pressable onPress={() => setExpandedId(expanded ? undefined : service.id)} style={({ pressed }) => [styles.cardHeader, pressed && styles.pressed]}>
          <View style={styles.cardTitleBlock}>
            <Text numberOfLines={1} style={styles.serviceName}>{service.name}</Text>
            {!!service.description && <Text numberOfLines={1} style={styles.description}>{service.description}</Text>}
          </View>
          {!expanded && <ServiceBadge draft={draft}/>} 
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-forward'} size={15} color={expanded ? colors.brandDark : colors.muted}/>
        </Pressable>

        {expanded && <View style={styles.editor}>
          <Text style={styles.fieldLabel}>{t('partnerServices.availability')}</Text>
          <View style={styles.segmented}>
            {availabilityOptions.map(option => <Pressable key={option} onPress={() => update(service.id, { availability: option })} style={[styles.segment, draft.availability === option && styles.segmentSelected]}>
              <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.segmentText, draft.availability === option && styles.segmentTextSelected]}>{t(`partnerServices.availabilityOptions.${option}`)}</Text>
            </Pressable>)}
          </View>

          {draft.availability === 'PAID' && <View style={styles.priceRow}>
            <View style={styles.priceField}><Field label={t('partnerServices.price')} value={draft.price} onChangeText={price => update(service.id, { price })} keyboardType="decimal-pad"/></View>
            <View style={styles.typeField}>
              <Text style={styles.fieldLabel}>{t('partnerServices.priceType')}</Text>
              <View style={styles.segmented}>
                {['FIXED', 'PER_PERSON'].map(option => <Pressable key={option} onPress={() => update(service.id, { priceType: option })} style={[styles.segment, draft.priceType === option && styles.segmentSelected]}>
                  <Text style={[styles.segmentText, draft.priceType === option && styles.segmentTextSelected]}>{t(`partnerServices.priceTypes.${option}`)}</Text>
                </Pressable>)}
              </View>
            </View>
          </View>}

          <Text style={styles.preview}>{customerPreview(draft, t, getAppLanguage())}</Text>
          <View style={styles.actions}>
            <Pressable
              onPress={() => save(service)}
              disabled={busy || (draft.availability === 'PAID' && (!Number.isFinite(Number(draft.price)) || Number(draft.price) <= 0))}
              style={({ pressed }) => [styles.saveButton, (busy || pressed) && styles.disabled]}
            ><Text style={styles.saveButtonText}>{busy ? t('common.saving') : t('common.save')}</Text></Pressable>
            <Pressable onPress={() => remove(service)} disabled={busy} style={styles.deleteButton}><Text style={styles.deleteText}>{t('common.delete')}</Text></Pressable>
          </View>
        </View>}
      </View>;
    })}

    <FormModal visible={open} title={t('partnerServices.newServiceTitle')} onClose={() => setOpen(false)}>
      <Field label={t('partnerServices.name')} value={name} onChangeText={setName} maxLength={150}/>
      <Field label={t('partnerServices.description')} value={description} onChangeText={setDescription} multiline maxLength={500}/>
      <Button title={busy ? t('partnerServices.adding') : t('common.add')} onPress={add} disabled={busy || !name.trim()}/>
    </FormModal>
  </Screen>;
}

function ServiceBadge({ draft }: { draft: Draft }) {
  const { t } = useTranslation();
  if (draft.availability === 'INCLUDED') return <View style={[styles.badge, styles.includedBadge]}><Text style={styles.includedText}>{t('partnerServices.availabilityOptions.INCLUDED')}</Text></View>;
  if (draft.availability === 'UNAVAILABLE') return <View style={styles.badge}><Text style={styles.badgeText}>{t('partnerServices.availabilityOptions.UNAVAILABLE')}</Text></View>;
  return <View style={[styles.badge, styles.paidBadge]}><Text style={styles.paidText}>{t('partnerServices.badgePrice', { price: formatCurrency(Number(draft.price || 0), getAppLanguage()), type: t(`partnerServices.priceTypes.${draft.priceType}`) })}</Text></View>;
}

function customerPreview(draft: Draft, t: (key: string, options?: Record<string, unknown>) => string, language: ReturnType<typeof getAppLanguage>) {
  if (draft.availability === 'INCLUDED') return t('partnerServices.previewIncluded');
  if (draft.availability === 'UNAVAILABLE') return t('partnerServices.previewUnavailable');
  return t('partnerServices.previewPaid', { price: formatCurrency(Number(draft.price || 0), language), type: t(`partnerServices.priceTypes.${draft.priceType}`) });
}

const styles = StyleSheet.create({
  summary: { color: colors.muted, fontSize: 10, marginTop: -5 },
  card: { overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  cardExpanded: { borderColor: colors.gold },
  cardHeader: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9 },
  cardTitleBlock: { flex: 1, minWidth: 0 },
  serviceName: { color: colors.ink, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 9, lineHeight: 14 },
  editor: { gap: 9, paddingHorizontal: 12, paddingBottom: 12 },
  fieldLabel: { color: colors.muted, fontSize: 9, lineHeight: 13 },
  segmented: { minHeight: 35, flexDirection: 'row', padding: 2, borderRadius: 11, backgroundColor: '#EFE9DC' },
  segment: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, borderRadius: 9 },
  segmentSelected: { backgroundColor: colors.brand },
  segmentText: { color: colors.muted, fontSize: 9, fontWeight: '600' },
  segmentTextSelected: { color: '#fff', fontWeight: '800' },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 9 },
  priceField: { flex: .8 },
  typeField: { flex: 1.3, gap: 6 },
  preview: { color: colors.brandDark, fontSize: 9, lineHeight: 14 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveButton: { flex: 1, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.brand },
  saveButtonText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  deleteButton: { minWidth: 36, height: 42, alignItems: 'center', justifyContent: 'center' },
  deleteText: { color: colors.danger, fontSize: 11, fontWeight: '700' },
  badge: { maxWidth: 105, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, backgroundColor: '#F0ECE3' },
  badgeText: { color: colors.muted, fontSize: 8 },
  includedBadge: { backgroundColor: '#EFF3E4' },
  includedText: { color: colors.success, fontSize: 8, fontWeight: '700' },
  paidBadge: { backgroundColor: '#F8ECD0' },
  paidText: { color: colors.brandDark, fontSize: 8, fontWeight: '700' },
  pressed: { opacity: .65 },
  disabled: { opacity: .5 },
});
