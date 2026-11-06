import { useRef, useState } from 'react';
import { Image, ImageSourcePropType, Modal, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, type ScrollViewInstance, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors } from './theme';
import { HeroImage, s } from './ui';

export type GalleryImage = ImageSourcePropType | { fullUri: string; previewUri?: string };

function source(image: GalleryImage, preview = false): ImageSourcePropType {
  if (typeof image === 'object' && image !== null && !Array.isArray(image) && 'fullUri' in image) {
    return { uri: preview ? image.previewUri || image.fullUri : image.fullUri };
  }
  return image as ImageSourcePropType;
}

export function ImageGallery({ images, label }: { images: GalleryImage[]; label?: string }) {
  const { t } = useTranslation();
  const resolvedLabel = label || t('gallery.images');
  const [active, setActive] = useState<number | null>(null);
  const [preview, setPreview] = useState(0);
  const previewRef = useRef<ScrollViewInstance>(null);
  const viewerRef = useRef<ScrollViewInstance>(null);
  const viewerOpenRef = useRef(false);
  const openBlockedRef = useRef(false);
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const previewWidth = Math.max(screenWidth - 40, 1);
  if (!images.length) return <HeroImage/>;

  const indexAfterScroll = (event: NativeSyntheticEvent<NativeScrollEvent>, pageWidth: number) => Math.round(event.nativeEvent.contentOffset.x / pageWidth);
  const openViewer = (index: number) => {
    if (openBlockedRef.current) return;
    viewerOpenRef.current = true;
    setActive(index);
  };
  const closeViewer = () => {
    viewerOpenRef.current = false;
    openBlockedRef.current = true;
    if (active !== null) {
      setPreview(active);
      previewRef.current?.scrollTo({ x: active * previewWidth, animated: false });
    }
    setActive(null);
    setTimeout(() => { openBlockedRef.current = false; }, 1000);
  };
  const moveViewer = (step: number) => {
    if (active === null) return;
    const next = (active + step + images.length) % images.length;
    setActive(next);
    viewerRef.current?.scrollTo({ x: next * screenWidth, animated: true });
  };
  const selectPreview = (index: number) => {
    setPreview(index);
    previewRef.current?.scrollTo({ x: index * previewWidth, animated: true });
  };

  return <>
    <View style={styles.previewShell}>
      <ScrollView ref={previewRef} horizontal pagingEnabled nestedScrollEnabled showsHorizontalScrollIndicator={false} decelerationRate="fast" onMomentumScrollEnd={event => setPreview(indexAfterScroll(event, previewWidth))}>
        {images.map((image, index) => <Pressable key={index} accessibilityRole="imagebutton" accessibilityLabel={t('gallery.enlarge', { label: resolvedLabel, index: index + 1 })} onPress={() => openViewer(index)} style={{ width: previewWidth }}><Image source={source(image, true)} style={s.heroImage}/></Pressable>)}
      </ScrollView>
      <View pointerEvents="none" style={styles.counter}><Text style={styles.counterText}>{preview + 1} / {images.length}</Text></View>
    </View>
    {images.length > 1 && <View style={styles.thumbnails}>{images.map((image, index) => <Pressable key={index} accessibilityRole="button" accessibilityLabel={t('gallery.show', { index: index + 1 })} onPress={() => selectPreview(index)} style={({ pressed }) => [styles.thumbnail, preview === index && styles.thumbnailActive, pressed && { opacity: .7 }]}><Image source={source(image, true)} style={styles.thumbnailImage}/></Pressable>)}</View>}
    {active !== null && <Modal visible transparent animationType="fade" onShow={() => viewerRef.current?.scrollTo({ x: active * screenWidth, animated: false })} onRequestClose={closeViewer}>
      <View style={[styles.viewer, { paddingTop: Math.max(insets.top, 32) + 12, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <StatusBar style="light"/>
        <View style={styles.viewerHeader}><Text style={styles.viewerTitle}>{resolvedLabel}</Text><Pressable accessibilityRole="button" accessibilityLabel={t('gallery.close')} onPress={event => { event.stopPropagation(); closeViewer(); }} style={styles.iconButton}><Ionicons name="close" size={28} color="#fff"/></Pressable></View>
        <ScrollView ref={viewerRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} decelerationRate="fast" onMomentumScrollEnd={event => { if (viewerOpenRef.current) setActive(indexAfterScroll(event, screenWidth)); }} style={styles.fullScroller} contentContainerStyle={styles.fullScrollerContent}>
          {images.map((image, index) => <View key={index} style={[styles.fullImagePage, { width: screenWidth }]}><Image source={source(image, index !== active)} style={styles.fullImage} resizeMode="contain"/></View>)}
        </ScrollView>
        <View style={styles.viewerFooter}>{images.length > 1 && <Pressable accessibilityRole="button" accessibilityLabel={t('gallery.previous')} onPress={() => moveViewer(-1)} style={styles.iconButton}><Ionicons name="chevron-back" size={30} color="#fff"/></Pressable>}<Text style={styles.viewerCount}>{active === null ? 0 : active + 1} / {images.length}</Text>{images.length > 1 && <Pressable accessibilityRole="button" accessibilityLabel={t('gallery.next')} onPress={() => moveViewer(1)} style={styles.iconButton}><Ionicons name="chevron-forward" size={30} color="#fff"/></Pressable>}</View>
      </View>
    </Modal>}
  </>;
}

const styles = {
  counter: { position: 'absolute' as const, right: 12, bottom: 12, backgroundColor: 'rgba(148,107,36,.88)', borderRadius: 20, paddingHorizontal: 11, paddingVertical: 6 },
  counterText: { color: '#fff', fontSize: 12, fontWeight: '800' as const },
  previewShell: { borderRadius: 24, overflow: 'hidden' as const },
  thumbnails: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 },
  thumbnail: { width: 92, height: 70, borderRadius: 14, overflow: 'hidden' as const, borderWidth: 1, borderColor: colors.line },
  thumbnailActive: { borderWidth: 3, borderColor: colors.brand },
  thumbnailImage: { width: '100%' as const, height: '100%' as const },
  viewer: { flex: 1, backgroundColor: colors.brandDark },
  viewerHeader: { height: 64, paddingHorizontal: 18, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 },
  viewerTitle: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '800' as const },
  iconButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: 'rgba(255,255,255,.14)' },
  fullScroller: { flex: 1 },
  fullScrollerContent: { alignItems: 'stretch' as const },
  fullImagePage: { flex: 1, height: '100%' as const, justifyContent: 'center' as const },
  fullImage: { width: '100%' as const, height: '100%' as const },
  viewerFooter: { minHeight: 84, paddingHorizontal: 24, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
  viewerCount: { color: '#fff', fontSize: 15, fontWeight: '800' as const }
};
