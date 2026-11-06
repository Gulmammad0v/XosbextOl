import { translate } from './i18n';

export function googleClientId(): string {
  throw new Error(translate('socialAuth.platformUnsupported'));
}

export function isGoogleSignInConfigured(): boolean {
  return false;
}

export function googleRedirectUri(): string {
  throw new Error(translate('socialAuth.platformUnsupported'));
}
