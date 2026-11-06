import { translate } from './i18n';

const ANDROID_REDIRECT_URI = 'az.xosbextol.mobile:/oauthredirect';
const clientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

export function googleClientId(): string {
  if (!clientId) throw new Error(translate('socialAuth.notConfigured', { platform: 'Android' }));
  return clientId;
}

export function isGoogleSignInConfigured(): boolean {
  return Boolean(clientId);
}

export function googleRedirectUri(): string {
  return ANDROID_REDIRECT_URI;
}

