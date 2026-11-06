import * as AuthSession from 'expo-auth-session';
import { translate } from './i18n';

const clientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

export function googleClientId(): string {
  if (!clientId) throw new Error(translate('socialAuth.notConfigured', { platform: 'iOS' }));
  return clientId;
}

export function isGoogleSignInConfigured(): boolean {
  return Boolean(clientId);
}

export function googleRedirectUri(): string {
  const reversedClientId = googleClientId().split('.').reverse().join('.');
  return AuthSession.makeRedirectUri({ native: `${reversedClientId}:/oauthredirect` });
}
