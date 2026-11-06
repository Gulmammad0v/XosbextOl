import * as AuthSession from 'expo-auth-session';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { googleClientId, googleRedirectUri, isGoogleSignInConfigured } from './google-auth-config';
import { translate } from './i18n';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};
const GOOGLE_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
];
export type SocialProvider = 'GOOGLE';
export type SocialCredential = {
  idToken: string;
  firstName?: string;
  lastName?: string;
};

export { isGoogleSignInConfigured };

export async function signInWithGoogle(nonce: string): Promise<SocialCredential | null> {
  const clientId = googleClientId();
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    throw new Error(translate('socialAuth.expoGoUnsupported', { platform: Platform.OS === 'android' ? 'Android' : 'iOS' }));
  }
  const redirectUri = googleRedirectUri();
  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    scopes: GOOGLE_SCOPES,
    prompt: AuthSession.Prompt.SelectAccount,
    usePKCE: true,
    extraParams: { nonce },
  });
  const result = await request.promptAsync(GOOGLE_DISCOVERY);
  if (result.type === 'cancel' || result.type === 'dismiss') return null;
  if (result.type !== 'success' || !result.params.code) {
    const message = result.type === 'error'
      ? result.error?.description
      : undefined;
    throw new Error(message || translate('socialAuth.failed'));
  }
  const token = await AuthSession.exchangeCodeAsync({
    clientId,
    code: result.params.code,
    redirectUri,
    extraParams: { code_verifier: request.codeVerifier || '' },
  }, GOOGLE_DISCOVERY);
  if (!token.idToken) throw new Error(translate('socialAuth.tokenMissing'));
  return { idToken: token.idToken };
}
