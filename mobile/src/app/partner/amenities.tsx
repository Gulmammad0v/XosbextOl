import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { api } from '@/api';
import type { Amenity } from '@/types';
import { AmenityEditor } from '@/amenity-editor';
import { Button, Screen, run } from '@/ui';
import { useTranslation } from 'react-i18next';

export default function PartnerAmenities() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ venueId: string; name?: string }>();
  const venueId = Number(params.venueId);
  const [catalog, setCatalog] = useState<Amenity[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [customNames, setCustomNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [detail, amenities] = await Promise.all([
      api.partnerVenue(venueId),
      api.catalog<Amenity[]>('amenities'),
    ]);
    setCatalog(amenities);
    setSelectedIds(detail.amenities.map(item => item.id));
    setCustomNames([]);
  }, [venueId]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]));

  const save = () => run(async () => {
    setBusy(true);
    try {
      await api.setAmenities(venueId, selectedIds, customNames);
      await load();
    } finally {
      setBusy(false);
    }
  }, t('partnerAmenities.updated'));

  return <Screen title={t('partnerAmenities.title')} subtitle={params.name} loading={loading} footer={<Button title={busy ? t('common.saving') : t('common.save')} onPress={save} disabled={busy}/>}> 
    <AmenityEditor
      catalog={catalog}
      selectedIds={selectedIds}
      onSelectedIdsChange={setSelectedIds}
      customNames={customNames}
      onCustomNamesChange={setCustomNames}
    />
  </Screen>;
}
