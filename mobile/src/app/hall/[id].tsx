import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '@/api';
import type { Hall, VenueDetail } from '@/types';
import { GalleryImage, ImageGallery } from '@/image-gallery';
import { Button, Empty, MoneyRange, Row, Screen, SectionTitle, s } from '@/ui';

const demoImages: GalleryImage[] = [require('../../../assets/demo-halls/small-hall.png'), require('../../../assets/demo-halls/grand-hall.png')];

export default function HallDetails() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string; venueId: string }>();
  const hallId = Number(params.id); const venueId = Number(params.venueId);
  const [detail, setDetail] = useState<VenueDetail>(); const [loading, setLoading] = useState(true);
  const load = useCallback(() => api.venue(venueId).then(setDetail), [venueId]);
  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);
  const hall: Hall | undefined = detail?.halls.find(item => item.id === hallId);
  if (!detail || !hall) return <Screen loading={loading}><Empty text={t('hallDetails.notFound')}/></Screen>;
  const menuPrices = detail.menus?.map(menu => Number(menu.pricePerPerson)) || [];
  const menuPriceRange = menuPrices.length ? { min: Math.min(...menuPrices), max: Math.max(...menuPrices) } : undefined;

  const images: GalleryImage[] = detail.media.filter(item => (item.hallId ?? item.hall_id) === hallId && item.url).map(item => ({ fullUri: item.url, previewUri: item.thumbUrl || item.thumb_url }));
  if (detail.venue.slug?.startsWith('demo-')) images.push(...(hall.name.toLocaleLowerCase('az').includes('böyük') ? [...demoImages].reverse() : demoImages));

  return <Screen loading={loading}>
    <ImageGallery images={images} label={`${detail.venue.name} · ${hall.name}`}/>
    <View><Text style={s.overline}>{detail.venue.name}</Text><Text style={s.title}>{hall.name}</Text><Text style={s.subtitle}>{detail.venue.address}</Text></View>
    <SectionTitle>{t('hallDetails.about')}</SectionTitle>
    <Row label={t('hallDetails.capacity')} value={t('hallDetails.guestRange', { min: hall.capacityMin, max: hall.capacityMax })}/>{menuPriceRange && <Row label={t('hallDetails.menuPrice')} value={<MoneyRange {...menuPriceRange}/>}/>}<Row label={t('hallDetails.deposit')} value={t('hallDetails.depositValue')}/>
    <Button title={t('hallDetails.reserve')} onPress={() => router.push({ pathname: '/booking/new', params: { venueId, hallId } } as any)}/>
  </Screen>;
}
