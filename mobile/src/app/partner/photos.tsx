import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api';
import type { VenueDetail } from '@/types';
import { Button, Empty, Screen, confirm, run, s } from '@/ui';
import { colors } from '@/theme';
import { useTranslation } from 'react-i18next';

const MAX_IMAGES = 10;

export default function Photos() {
  const { t } = useTranslation();
  const p = useLocalSearchParams<{ venueId: string; name?: string }>(); const venueId = Number(p.venueId);
  const { width } = useWindowDimensions();
  const tileWidth = Math.floor((width - 42) / 3);
  const tileSize = { width: tileWidth, height: Math.round(tileWidth / .84) };
  const [detail, setDetail] = useState<VenueDetail>(); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [newImages, setNewImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const load = useCallback(async () => setDetail(await api.partnerVenue(venueId)), [venueId]);
  useFocusEffect(useCallback(() => { load().finally(() => setLoading(false)); }, [load]));
  const images = detail?.media.filter(item => !(item.hallId ?? item.hall_id)) || [];
  const imageCount = images.length + newImages.length;
  const pick = () => run(async () => {
    const available = MAX_IMAGES - imageCount;
    if (available <= 0) {
      Alert.alert(t('partnerPhotos.limitTitle'), t('partnerPhotos.limitMessage'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: .9 });
    if (result.canceled) return;
    setNewImages(values => [...values, ...result.assets.slice(0, available)]);
    if (result.assets.length > available)
      Alert.alert(t('partnerPhotos.limitTitle'), t('partnerPhotos.limitMessage'));
  });
  const save = async () => {
    if (!newImages.length || busy) return;
    setBusy(true);
    let uploaded = 0;
    try {
      await run(async () => {
        for (const asset of newImages) {
          await api.uploadMedia(venueId, asset);
          uploaded += 1;
        }
      }, t('partnerPhotos.saved'));
      if (uploaded > 0) {
        setNewImages(values => values.slice(uploaded));
        await load();
      }
    } finally {
      setBusy(false);
    }
  };
  const remove = (id: number) => confirm(t('partnerPhotos.deleteTitle'), t('partnerPhotos.deleteMessage'), () => run(async () => { await api.removeMedia(venueId, id); await load(); }, t('partnerPhotos.deleted')));
  return <Screen title={t('partnerPhotos.title')} subtitle={p.name} loading={loading}>
    <View style={styles.progress}><Text style={s.h2}>{t('partnerPhotos.minimum', { count: imageCount, minimum: 5 })}</Text><Text style={styles.ok}>{imageCount >= 5 ? t('partnerPhotos.requirementMet') : t('partnerPhotos.addPhoto')}</Text><View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, imageCount / 5 * 100)}%` }]}/></View></View>
    {!imageCount ? <Empty text={t('partnerPhotos.empty')}/> : <View style={styles.grid}>
      {images.map(media => <View key={media.id} style={[styles.item, tileSize]}><Image source={{ uri: media.thumbUrl || media.thumb_url || media.url }} style={styles.image}/><Pressable onPress={() => remove(media.id)} style={styles.remove}><Text style={styles.removeText}>×</Text></Pressable></View>)}
      {newImages.map((image, index) => <View key={`${image.uri}-${index}`} style={[styles.item, tileSize]}><Image source={{ uri: image.uri }} style={styles.image}/><Pressable onPress={() => setNewImages(values => values.filter((_, itemIndex) => itemIndex !== index))} style={styles.remove}><Text style={styles.removeText}>×</Text></Pressable></View>)}
      <Pressable accessibilityRole="button" accessibilityLabel={t('partnerPhotos.addNewLabel')} onPress={pick} style={[styles.add, tileSize]}><Ionicons name="add" size={32} color={colors.brandDark}/></Pressable>
    </View>}
    <Text style={s.muted}>{t('partnerPhotos.uploadInfo')}</Text>
    <Button title={busy ? t('partnerPhotos.uploading') : newImages.length ? t('common.save') : t('partnerPhotos.addPhoto')} onPress={newImages.length ? () => void save() : pick} disabled={busy}/>
  </Screen>;
}
const styles = StyleSheet.create({ progress: { backgroundColor: colors.paper, borderRadius: 15, borderWidth: 1, borderColor: colors.line, padding: 13, gap: 9 }, ok: { position: 'absolute', right: 13, top: 14, color: colors.brandDark, fontSize: 11 }, track: { height: 6, backgroundColor: colors.line, borderRadius: 4, overflow: 'hidden' }, fill: { height: '100%', backgroundColor: colors.gold }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, item: { flexGrow: 0, flexShrink: 0 }, image: { width: '100%', height: '100%', borderRadius: 11, backgroundColor: '#E7D5A7' }, remove: { position: 'absolute', right: 5, top: 5, width: 22, height: 22, borderRadius: 12, backgroundColor: colors.brandDark, alignItems: 'center', justifyContent: 'center' }, removeText: { color: '#fff', fontSize: 15 }, add: { flexGrow: 0, flexShrink: 0, borderRadius: 11, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.gold, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' } });
