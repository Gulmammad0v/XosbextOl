import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError, getCurrentRefreshToken, saveTokens, setExpiredHandler } from './api';
import { BiometricState, clearBiometricRefreshToken, clearLegacyBiometricData, emptyBiometricState, getBiometricInfo, markBiometricLoginOffered, markDuplicateDevicesRepaired, readBiometricRefreshToken, saveBiometricRefreshToken, shouldOfferBiometricLogin, shouldRepairDuplicateDevices } from './biometric-session';
import type { Profile, Tokens } from './types';
import type { SocialCredential, SocialProvider } from './social-auth';
import { changeAppLanguage, getAppLanguage, hasLanguageChoice, translate } from './i18n';

type AuthValue = {
  loading: boolean; user: Profile | null; signIn(email: string, password: string): Promise<void>;
  replaceDevice(id: number, limitToken: string): Promise<void>;
  signInBiometric(): Promise<void>;
  signInSocial(provider: SocialProvider, challenge: string, credential: SocialCredential): Promise<void>;
  completeRegistration(data: { token: string; firstName: string; lastName: string; birthDate: string; role: 'CUSTOMER' | 'VENUE_OWNER'; phone?: string; password: string; confirmPassword: string }): Promise<void>;
  signOut(): Promise<void>; refreshProfile(): Promise<void>; setProfile(profile: Profile): void;
  biometric: BiometricState;
  biometricOfferVisible: boolean;
  enableBiometric(): Promise<void>; disableBiometric(): Promise<void>;
  acceptBiometricOffer(): Promise<void>; dismissBiometricOffer(): Promise<void>;
  verifyBiometric(): Promise<void>; refreshBiometricState(): Promise<BiometricState>;
};
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<Profile | null>(null);
  const [biometric, setBiometric] = useState<BiometricState>(emptyBiometricState);
  const [biometricOfferVisible, setBiometricOfferVisible] = useState(false);

  const rejectAdmin = useCallback(async (profile: Profile, tokens: Tokens) => {
    if (profile.role !== 'ADMIN') return profile;
    try { await api.logout(tokens.refreshToken); } catch { /* local cleanup still blocks mobile admin access */ }
    await saveTokens(null);
    throw new Error(translate('auth.adminWebOnly'));
  }, []);

  const openSession = useCallback(async (next: Tokens, offerBiometric = false) => {
    await saveTokens(next);
    let profile = await api.me();
    if (hasLanguageChoice()) {
      const localLanguage = getAppLanguage();
      if (profile.language !== localLanguage) profile = await api.updateLanguage(localLanguage);
    } else {
      await changeAppLanguage(profile.language);
    }
    const accepted = await rejectAdmin(profile, next);
    try {
      if (await shouldRepairDuplicateDevices(accepted.id)) {
        await api.repairDuplicateDevices();
        await markDuplicateDevicesRepaired(accepted.id);
      }
    } catch { /* device cleanup can retry after the next successful login */ }
    setUser(accepted);
    const state = await getBiometricInfo();
    setBiometric(state);
    if (offerBiometric && state.available && !state.enabled && await shouldOfferBiometricLogin()) {
      setBiometricOfferVisible(true);
    }
  }, [rejectAdmin]);

  const enableBiometricAccess = useCallback(async () => {
    const refreshToken = getCurrentRefreshToken();
    if (!refreshToken) throw new Error(translate('biometric.signInFirst'));
    await saveBiometricRefreshToken(refreshToken);
    setBiometric(await getBiometricInfo());
  }, []);

  const resumeWithBiometrics = useCallback(async () => {
    const refreshToken = await readBiometricRefreshToken();
    if (!refreshToken) throw new Error(translate('biometric.noSavedSession'));
    try {
      const next = await api.refresh(refreshToken);
      await openSession(next);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await clearBiometricRefreshToken();
        setBiometric(await getBiometricInfo());
        throw new Error(translate('biometric.sessionExpired'));
      }
      throw error;
    }
  }, [openSession]);

  useEffect(() => {
    let active = true;
    setExpiredHandler(() => {
      setUser(null);
      void getBiometricInfo().then(setBiometric);
    });
    void (async () => {
      await clearLegacyBiometricData();
      if (!active) return;
      const state = await getBiometricInfo();
      setBiometric(state);
      if (state.enabled) {
        try { await resumeWithBiometrics(); }
        catch { /* cancellation or failure returns the user to password login */ }
      }
    })().finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [resumeWithBiometrics]);

  const value = useMemo<AuthValue>(() => ({
    loading, user, biometric, biometricOfferVisible,
    async signIn(email, password) {
      const next = await api.login(email, password);
      await openSession(next, true);
    },
    async replaceDevice(id, limitToken) {
      const next = await api.replaceDevice(id, limitToken);
      await openSession(next, true);
    },
    async signInBiometric() {
      await resumeWithBiometrics();
    },
    async signInSocial(provider, challenge, credential) {
      const next = await api.socialLogin({ provider, challenge, ...credential });
      await openSession(next, true);
    },
    async completeRegistration(data) {
      const next = await api.completeRegistration(data);
      await openSession(next, true);
    },
    async signOut() {
      const refreshToken = getCurrentRefreshToken();
      try { if (refreshToken) await api.logout(refreshToken); } finally { await saveTokens(null); setUser(null); setBiometricOfferVisible(false); setBiometric(await getBiometricInfo()); }
    },
    async enableBiometric() {
      await enableBiometricAccess();
    },
    async disableBiometric() {
      await clearBiometricRefreshToken();
      setBiometric(await getBiometricInfo());
    },
    async acceptBiometricOffer() {
      await enableBiometricAccess();
      await markBiometricLoginOffered();
      setBiometricOfferVisible(false);
    },
    async dismissBiometricOffer() {
      await markBiometricLoginOffered();
      setBiometricOfferVisible(false);
    },
    async verifyBiometric() {
      const verified = await readBiometricRefreshToken();
      if (!verified) throw new Error(translate('biometric.notActive'));
    },
    async refreshBiometricState() {
      const state = await getBiometricInfo();
      setBiometric(state);
      return state;
    },
    async refreshProfile() { setUser(await api.me()); },
    setProfile: setUser
  }), [biometric, biometricOfferVisible, enableBiometricAccess, loading, openSession, resumeWithBiometrics, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
