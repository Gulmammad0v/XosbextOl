import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Camera, type CameraRef, Map, type ViewStateChangeEvent } from '@maplibre/maplibre-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button } from './ui';
import { colors } from './theme';

type Coordinate = { latitude: number; longitude: number };
type SelectedLocation = Coordinate & { address?: string };
type Props = { initialCoordinate: Coordinate; onCancel: () => void; onConfirm: (location: SelectedLocation) => void };

const OPENFREE_MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const MIN_MAP_ZOOM = 10;
const MIN_CONFIRM_ZOOM = 15;
const DEFAULT_ZOOM = 15;

export default function NativeLocationPicker({ initialCoordinate, onCancel, onConfirm }: Props) {
  const { t } = useTranslation();
  const cameraRef = useRef<CameraRef>(null);
  const [coordinate, setCoordinate] = useState(initialCoordinate);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [locating, setLocating] = useState(false);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [error, setError] = useState<string>();

  const onCameraIdle = (event: { nativeEvent: ViewStateChangeEvent }) => {
    const [longitude, latitude] = event.nativeEvent.center;
    setCoordinate({ latitude, longitude });
    setZoom(event.nativeEvent.zoom);
  };

  const moveToMyLocation = async () => {
    setLocating(true);
    setError(undefined);
    try {
      if (!await Location.hasServicesEnabledAsync()) throw new Error(t('locationPicker.servicesDisabled'));
      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted') permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw new Error(permission.canAskAgain ? t('locationPicker.permissionRequest') : t('locationPicker.permissionSettings'));
      const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 60_000, requiredAccuracy: 200 });
      const location = lastKnown || await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const next = { latitude: location.coords.latitude, longitude: location.coords.longitude };
      setCoordinate(next);
      cameraRef.current?.easeTo({ center: [next.longitude, next.latitude], zoom: 16, duration: 700 });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('locationPicker.locationError'));
    } finally {
      setLocating(false);
    }
  };

  const confirmLocation = async () => {
    setResolvingAddress(true);
    setError(undefined);
    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted' && permission.canAskAgain) permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        onConfirm(coordinate);
        return;
      }
      const [place] = await Location.reverseGeocodeAsync(coordinate);
      const street = [place?.streetNumber, place?.street || place?.name].filter(Boolean).join(' ');
      const address = place?.formattedAddress || [street, place?.district, place?.city].filter((value, index, values) => value && values.indexOf(value) === index).join(', ');
      onConfirm({ ...coordinate, address: address || undefined });
    } catch {
      onConfirm(coordinate);
    } finally {
      setResolvingAddress(false);
    }
  };

  const zoomIsValid = zoom >= MIN_CONFIRM_ZOOM;
  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
    <View style={styles.header}>
      <Text style={styles.title}>{t('locationPicker.title')}</Text>
      <Text style={styles.subtitle}>{t('locationPicker.subtitle')}</Text>
    </View>
    <View style={styles.mapShell}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={OPENFREE_MAP_STYLE}
        attribution
        logo
        compass
        scaleBar={false}
        touchPitch={false}
        onRegionDidChange={onCameraIdle}>
        <Camera ref={cameraRef} initialViewState={{ center: [initialCoordinate.longitude, initialCoordinate.latitude], zoom: DEFAULT_ZOOM }} minZoom={MIN_MAP_ZOOM} maxZoom={19}/>
      </Map>
      <View pointerEvents="none" style={styles.pinWrap}><Ionicons name="location" size={48} color={colors.brand}/><View style={styles.pinDot}/></View>
      <Pressable accessibilityRole="button" accessibilityLabel={t('locationPicker.myLocation')} disabled={locating} onPress={moveToMyLocation} style={({ pressed }) => [styles.locationButton, (pressed || locating) && { opacity: .65 }]}>
        {locating ? <ActivityIndicator color={colors.brandDark}/> : <Ionicons name="locate" size={24} color={colors.brandDark}/>}<Text style={styles.locationText}>{t('locationPicker.myLocation')}</Text>
      </Pressable>
    </View>
    <View style={styles.footer}>
      <Text style={styles.coordinate}>{coordinate.latitude.toFixed(6)}, {coordinate.longitude.toFixed(6)}</Text>
      {!zoomIsValid && <Text style={styles.warning}>{t('locationPicker.zoomWarning')}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.actions}><Button title={t('common.back')} variant="secondary" onPress={onCancel}/><Button title={resolvingAddress ? t('locationPicker.resolving') : t('common.confirm')} disabled={!zoomIsValid || resolvingAddress} onPress={confirmLocation}/></View>
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14, gap: 4 },
  title: { color: colors.ink, fontSize: 26, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  mapShell: { flex: 1, marginHorizontal: 14, overflow: 'hidden', borderRadius: 24, borderWidth: 1, borderColor: colors.line, backgroundColor: '#E7E2D8' },
  pinWrap: { position: 'absolute', left: '50%', top: '50%', width: 52, height: 58, marginLeft: -26, marginTop: -52, alignItems: 'center' },
  pinDot: { position: 'absolute', bottom: 0, width: 8, height: 4, borderRadius: 4, backgroundColor: 'rgba(38,31,24,.25)' },
  locationButton: { position: 'absolute', right: 14, bottom: 14, minHeight: 46, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: '#000', shadowOpacity: .12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  locationText: { color: colors.brandDark, fontWeight: '800' },
  footer: { padding: 16, gap: 8 },
  coordinate: { color: colors.brandDark, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  warning: { color: '#8A651D', textAlign: 'center' },
  error: { color: colors.danger, textAlign: 'center', lineHeight: 20 },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 10 }
});
