import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from './auth';
import { run } from './ui';
import { colors } from './theme';

export function BiometricSettings() {
  const { t } = useTranslation();
  const { biometric, enableBiometric, disableBiometric, refreshBiometricState } = useAuth();
  const [busy, setBusy] = useState(false);
  const label = biometric.label || t('biometric.label');

  const perform = (action: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    void run(action, success).finally(() => setBusy(false));
  };

  const toggle = () => perform(biometric.enabled ? disableBiometric : enableBiometric);
  const retry = () => perform(async () => {
    const state = await refreshBiometricState();
    if (!state.available) throw new Error(state.unavailableReason || t('biometric.unavailable'));
  }, t('biometric.ready'));
  return <View style={styles.card}>
    <View style={styles.icon}><Ionicons name={label === 'Face ID' ? 'scan-outline' : 'finger-print-outline'} size={21} color={colors.brandDark}/></View>
    <View style={styles.copy}>
      <Text style={styles.title}>{t('biometric.signInWith', { label })}</Text>
      <Text style={styles.subtitle}>{biometric.available ? (biometric.unavailableReason || t('biometric.fasterSignIn')) : biometric.unavailableReason}</Text>
      {!biometric.available && <Pressable accessibilityRole="button" accessibilityLabel={t('biometric.retryAccessibility')} disabled={busy} hitSlop={8} onPress={retry} style={({ pressed }) => [styles.retryButton, (pressed || busy) && styles.pressed]}>
        <Ionicons name="refresh-outline" size={15} color={colors.brandDark}/><Text style={styles.retry}>{t('biometric.retry')}</Text>
      </Pressable>}
    </View>
    {biometric.available && <Switch accessibilityLabel={t('biometric.toggleAccessibility', { label })} value={biometric.enabled} disabled={busy} onValueChange={toggle} trackColor={{ false: colors.line, true: colors.brand }} thumbColor="#fff"/>}
  </View>;
}

export function BiometricEnrollmentPrompt() {
  const { t } = useTranslation();
  const { biometric, biometricOfferVisible, acceptBiometricOffer, dismissBiometricOffer } = useAuth();
  const [busy, setBusy] = useState(false);
  const label = biometric.label || t('biometric.label');

  const accept = () => {
    setBusy(true);
    void run(acceptBiometricOffer, t('biometric.enabledSuccess', { label })).finally(() => setBusy(false));
  };

  return <Modal visible={biometricOfferVisible} transparent animationType="fade" onRequestClose={() => void dismissBiometricOffer()}>
    <SafeAreaView style={styles.backdrop}>
      <View style={styles.prompt}>
        <View style={styles.promptIcon}><Ionicons name={label === 'Face ID' ? 'scan-outline' : 'finger-print-outline'} size={31} color={colors.brandDark}/></View>
        <Text style={styles.promptTitle}>{t('biometric.signInWith', { label })}</Text>
        <Text style={styles.promptText}>{t('biometric.promptDescription')}</Text>
        <Pressable accessibilityRole="button" disabled={busy} onPress={accept} style={({ pressed }) => [styles.enableButton, (pressed || busy) && styles.pressed]}>
          <Text style={styles.enableButtonText}>{busy ? t('auth.wait') : t('biometric.enable')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void dismissBiometricOffer()} style={({ pressed }) => [styles.laterButton, pressed && styles.pressed]}>
          <Text style={styles.laterButtonText}>{t('notificationPermission.notNow')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  card: { minHeight: 58, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 17, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', gap: 11 },
  icon: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.softGold, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  title: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 10, marginTop: 3 },
  retryButton: { alignSelf: 'flex-start', minHeight: 42, marginTop: 8, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 21, borderWidth: 1, borderColor: colors.goldLight, backgroundColor: colors.softGold },
  retry: { color: colors.brandDark, fontSize: 11, fontWeight: '800' },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22, backgroundColor: 'rgba(37,36,33,.46)' },
  prompt: { width: '100%', maxWidth: 390, alignItems: 'center', padding: 22, borderRadius: 24, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  promptIcon: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softGold, marginBottom: 14 },
  promptTitle: { color: colors.ink, fontSize: 21, fontWeight: '800', textAlign: 'center' },
  promptText: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8, marginBottom: 20 },
  enableButton: { width: '100%', minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: colors.brand },
  enableButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  laterButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  laterButtonText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  pressed: { opacity: .6 },
});
