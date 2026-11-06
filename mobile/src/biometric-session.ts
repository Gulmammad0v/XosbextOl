import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { translate } from './i18n';

const BIOMETRIC_REFRESH_TOKEN_KEY = 'xosbextol.biometric-refresh-token-v2';
const BIOMETRIC_ENABLED_KEY = 'xosbextol.biometric-enabled-v2';
const BIOMETRIC_OFFER_SEEN_KEY = 'xosbextol.biometric-offer-seen-v2';
const DEVICE_ID_KEY = 'xosbextol.device-id';
const LEGACY_DEVICE_ID_KEY = 'xosbextol.biometric-device-id';
const DEVICE_DUPLICATE_REPAIR_KEY_PREFIX = 'xosbextol.device-duplicate-repair-v1';
const LEGACY_KEYS = [
  'xosbextol.tokens',
  'xosbextol.biometric-enabled',
  'xosbextol.biometric-enrollment',
];
let deviceIdOperation: Promise<string> | undefined;

export type BiometricState = {
  available: boolean;
  enabled: boolean;
  label: string;
  unavailableReason?: string;
};

export const emptyBiometricState: BiometricState = {
  available: false,
  enabled: false,
  label: '',
};

function labelFor(types: LocalAuthentication.AuthenticationType[]) {
  if (Platform.OS === 'android' && types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return translate('biometric.fingerprint');
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return Platform.OS === 'ios' ? 'Face ID' : translate('biometric.faceRecognition');
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return Platform.OS === 'ios' ? 'Touch ID' : translate('biometric.fingerprint');
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return translate('biometric.irisRecognition');
  return translate('biometric.label');
}

export async function shouldOfferBiometricLogin() {
  return await SecureStore.getItemAsync(BIOMETRIC_OFFER_SEEN_KEY) !== 'true';
}

export async function markBiometricLoginOffered() {
  await SecureStore.setItemAsync(BIOMETRIC_OFFER_SEEN_KEY, 'true');
}

export async function clearLegacyBiometricData() {
  await Promise.allSettled(LEGACY_KEYS.map(key => SecureStore.deleteItemAsync(key)));
}

async function stablePlatformDeviceId() {
  try {
    const nativeId = Platform.OS === 'android'
      ? Application.getAndroidId()
      : Platform.OS === 'ios'
        ? await Application.getIosIdForVendorAsync()
        : null;
    if (!nativeId) return undefined;
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${Platform.OS}:${Application.applicationId || 'xosbextol'}:${nativeId}`,
    );
  } catch {
    return undefined;
  }
}

async function resolveDeviceId() {
  const stored = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (stored) return stored;

  const legacy = await SecureStore.getItemAsync(LEGACY_DEVICE_ID_KEY);
  if (legacy) {
    await SecureStore.setItemAsync(DEVICE_ID_KEY, legacy);
    await SecureStore.deleteItemAsync(LEGACY_DEVICE_ID_KEY);
    return legacy;
  }

  const deviceId = await stablePlatformDeviceId() || Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
  return deviceId;
}

export function getDeviceId() {
  deviceIdOperation ??= resolveDeviceId().catch(error => {
    deviceIdOperation = undefined;
    throw error;
  });
  return deviceIdOperation;
}

export async function shouldRepairDuplicateDevices(userId: number) {
  return await SecureStore.getItemAsync(`${DEVICE_DUPLICATE_REPAIR_KEY_PREFIX}.${userId}`) !== 'true';
}

export async function markDuplicateDevicesRepaired(userId: number) {
  await SecureStore.setItemAsync(`${DEVICE_DUPLICATE_REPAIR_KEY_PREFIX}.${userId}`, 'true');
}

export async function getBiometricInfo(): Promise<BiometricState> {
  try {
    const [hasHardware, enrolled, types, enabledValue, token] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
      SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY),
      SecureStore.getItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY),
    ]);
    const label = labelFor(types);
    if (!hasHardware) {
      return { available: false, enabled: false, label, unavailableReason: translate('biometric.noSensor') };
    }
    if (!enrolled) {
      return { available: false, enabled: false, label, unavailableReason: translate('biometric.notEnrolled') };
    }
    const enabled = enabledValue === 'true' && !!token;
    if (enabledValue === 'true' && !token) await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
    return { available: true, enabled, label };
  } catch {
    return {
      ...emptyBiometricState,
      unavailableReason: translate('biometric.moduleUnavailable'),
    };
  }
}

async function authenticateBiometric() {
  const state = await getBiometricInfo();
  if (!state.available) throw new Error(state.unavailableReason || translate('biometric.notActive'));
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: translate('biometric.confirmWith', { label: state.label }),
    promptSubtitle: translate('biometric.promptSubtitle'),
    promptDescription: translate('biometric.systemPromptDescription'),
    cancelLabel: translate('common.cancel'),
    fallbackLabel: '',
    disableDeviceFallback: true,
    biometricsSecurityLevel: 'weak',
  });
  if (result.success) return;
  if (result.error === 'user_cancel' || result.error === 'app_cancel' || result.error === 'system_cancel') {
    throw new Error(translate('biometric.cancelled'));
  }
  if (result.error === 'lockout') throw new Error(translate('biometric.lockout'));
  if (result.error === 'not_enrolled') throw new Error(translate('biometric.enrollFirst'));
  throw new Error(translate('biometric.failed'));
}

export async function saveBiometricRefreshToken(refreshToken: string) {
  await authenticateBiometric();
  await SecureStore.setItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY, refreshToken);
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
}

export async function updateBiometricRefreshTokenIfEnabled(refreshToken: string) {
  try {
    if (await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY) === 'true') {
      await SecureStore.setItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY, refreshToken);
    }
  } catch {
    // Token rotation must still succeed when secure persistence is unavailable.
  }
}

export async function readBiometricRefreshToken() {
  if (await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY) !== 'true') return null;
  await authenticateBiometric();
  const token = await SecureStore.getItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY);
  if (!token) await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
  return token;
}

export async function clearBiometricRefreshToken() {
  await Promise.allSettled([
    SecureStore.deleteItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY),
  ]);
}
