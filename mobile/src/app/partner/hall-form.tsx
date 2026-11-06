import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api';
import type { Media } from '@/types';
import { Card, Field, Screen, confirm, run } from '@/ui';
import { colors } from '@/theme';
import { useTranslation } from 'react-i18next';

const MAX_IMAGES = 10;

export default function HallForm() {
  const { t } = useTranslation();
  const p = useLocalSearchParams<{ venueId: string; hallId?: string; name?: string; hallName?: string }>();
  const venueId = Number(p.venueId); const routeHallId = p.hallId ? Number(p.hallId) : undefined;
  const [persistedHallId, setPersistedHallId] = useState(routeHallId);
  const [loading, setLoading] = useState(!!routeHallId); const [busy, setBusy] = useState(false);
  const [name, setName] = useState(''); const [min, setMin] = useState('50'); const [max, setMax] = useState('500'); const [active, setActive] = useState(true);
  const [existingImages, setExistingImages] = useState<Media[]>([]);
  const [newImages, setNewImages] = useState<ImagePicker.ImagePickerAsset[]>([]);

  useEffect(() => {
    if (!routeHallId) return;
    api.partnerVenue(venueId).then(detail => {
      const hall = detail.halls.find(value => value.id === routeHallId);
      if (hall) { setName(hall.name); setMin(String(hall.capacityMin)); setMax(String(hall.capacityMax)); setActive(hall.active); }
      setExistingImages(detail.media.filter(media => (media.hallId ?? media.hall_id) === routeHallId));
    }).finally(() => setLoading(false));
  }, [venueId, routeHallId]);

  const pickImage = () => run(async () => {
    if (existingImages.length + newImages.length >= MAX_IMAGES) {
      Alert.alert(t('partnerHallForm.photoLimit'), t('partnerHallForm.photoLimitMessage'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: .9 });
    if (!result.canceled) setNewImages(values => [...values, result.assets[0]]);
  });
  const save = () => run(async () => {
    setBusy(true);
    try {
      const saved = await api.saveHall(venueId, { name, capacityMin: Number(min), capacityMax: Number(max), depositPercent: 1, active }, persistedHallId);
      setPersistedHallId(saved.id);
      for (const image of newImages) await api.uploadMedia(venueId, image, saved.id);
      router.back();
    } finally { setBusy(false); }
  }, t('partnerHallForm.saved'));
  const deleteImage = (image: Media) => confirm(t('partnerPhotos.deleteTitle'), t('partnerHallForm.deletePhotoMessage'), () => run(async () => {
    await api.removeMedia(venueId, image.id);
    setExistingImages(values => values.filter(value => value.id !== image.id));
  }, t('partnerPhotos.deleted')));

  const hasImage = existingImages.length + newImages.length > 0;
  const valid = !!name.trim() && Number(min) >= 1 && Number(max) >= Number(min) && hasImage;
  const subtitle = routeHallId
    ? [p.hallName || name, p.name].filter(Boolean).join(' · ')
    : p.name;

  return <Screen
    title={routeHallId ? t('partnerHallForm.editTitle') : t('partnerHallForm.newTitle')}
    subtitle={subtitle}
    loading={loading}
    back
    footer={<Pressable accessibilityRole="button" disabled={busy || !valid} onPress={save} style={({ pressed }) => [styles.saveButton, (pressed || busy || !valid) && styles.disabled]}>
      <Text style={styles.saveButtonText}>{busy ? t('common.saving') : t('common.save')}</Text>
    </Pressable>}>
    <SectionLabel>{t('partnerHallForm.basic')}</SectionLabel>
    <Card style={styles.sectionCard}>
      <Field label={t('partnerHallForm.name')} value={name} onChangeText={setName} maxLength={150}/>
      <View style={styles.capacityRow}>
        <View style={styles.flex}><Field label={t('partnerHallForm.minimumGuests')} value={min} onChangeText={setMin} keyboardType="number-pad"/></View>
        <View style={styles.flex}><Field label={t('partnerHallForm.maximumGuests')} value={max} onChangeText={setMax} keyboardType="number-pad"/></View>
      </View>
      <Text style={styles.hint}>{t('partnerHallForm.capacityHint')}</Text>
    </Card>

    <SectionLabel>{t('partnerHallForm.reservation')}</SectionLabel>
    <Card style={styles.statusCard}>
      <View style={styles.statusCopy}>
        <Text style={styles.statusTitle}>{t('partnerHallForm.active')}</Text>
        <Text style={styles.statusHint}>{t('partnerHallForm.activeHint')}</Text>
      </View>
      <AvailabilitySwitch active={active} onPress={() => setActive(value => !value)}/>
    </Card>

    <View style={styles.sectionHeading}>
      <SectionLabel>{t('partnerHallForm.photos')}</SectionLabel>
      <Text style={[styles.minimum, hasImage && styles.minimumComplete]}>{t('partnerHallForm.minimumPhotos', { count: existingImages.length + newImages.length, minimum: 1 })}{hasImage ? ' ✓' : ''}</Text>
    </View>
    <Card style={styles.galleryCard}>
      <View style={styles.gallery}>
        {existingImages.map(image => <View key={image.id} style={styles.photoTile}>
          <Image source={{ uri: image.thumbUrl || image.thumb_url || image.url }} style={styles.photo}/>
          <Pressable accessibilityRole="button" accessibilityLabel={t('partnerPhotos.deleteTitle')} onPress={() => deleteImage(image)} style={styles.removeButton}><Ionicons name="close" size={14} color="#fff"/></Pressable>
        </View>)}
        {newImages.map((image, index) => <View key={`${image.uri}-${index}`} style={styles.photoTile}>
          <Image source={{ uri: image.uri }} style={styles.photo}/>
          <Pressable accessibilityRole="button" accessibilityLabel={t('partnerPhotos.deleteTitle')} onPress={() => setNewImages(values => values.filter((_, itemIndex) => itemIndex !== index))} style={styles.removeButton}><Ionicons name="close" size={14} color="#fff"/></Pressable>
        </View>)}
        <Pressable accessibilityRole="button" accessibilityLabel={t('partnerHallForm.addPhoto')} onPress={pickImage} style={({ pressed }) => [styles.addPhoto, pressed && styles.pressed]}>
          <Ionicons name="add" size={25} color={colors.brandDark}/>
        </Pressable>
      </View>
      <Text style={styles.galleryHint}>{t('partnerHallForm.galleryHint')}</Text>
    </Card>
  </Screen>;
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function AvailabilitySwitch({ active, onPress }: { active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="switch" accessibilityState={{ checked: active }} onPress={onPress} style={[styles.switch, active && styles.switchActive]}>
    <View style={[styles.knob, active && styles.knobActive]}/>
  </Pressable>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sectionLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: .5, marginTop: 2 },
  sectionCard: { gap: 11 },
  capacityRow: { flexDirection: 'row', gap: 9 },
  hint: { color: colors.muted, fontSize: 9, lineHeight: 13 },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusCopy: { flex: 1, gap: 2 },
  statusTitle: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  statusHint: { color: colors.muted, fontSize: 9, lineHeight: 13 },
  switch: { width: 43, height: 25, padding: 3, borderRadius: 14, backgroundColor: '#D9CFB9' },
  switchActive: { backgroundColor: colors.brand },
  knob: { width: 19, height: 19, borderRadius: 10, backgroundColor: colors.paper },
  knobActive: { alignSelf: 'flex-end' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  minimum: { color: colors.danger, fontSize: 10, fontWeight: '700' },
  minimumComplete: { color: colors.success },
  galleryCard: { gap: 10 },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoTile: { width: 88, height: 88 },
  photo: { width: '100%', height: '100%', borderRadius: 10, backgroundColor: colors.softGold },
  removeButton: { position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  addPhoto: { width: 88, height: 88, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.gold, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, overflow: 'hidden' },
  galleryHint: { color: colors.muted, fontSize: 9, lineHeight: 13 },
  saveButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: colors.brand },
  saveButtonText: { color: colors.paper, fontSize: 14, fontWeight: '800' },
  disabled: { opacity: .5 },
  pressed: { opacity: .65 },
});
