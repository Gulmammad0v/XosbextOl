import { useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError } from '@/api';
import { useAuth } from '@/auth';
import { AndroidScaledContent, Button, ErrorText, Field } from '@/ui';
import { colors } from '@/theme';
import { BirthDatePickerField, yesterdayIso } from '@/date-picker';
import { isGoogleSignInConfigured, signInWithGoogle } from '@/social-auth';
import type { DeviceLimitDetails, UserDevice } from '@/types';
import { useTranslation } from 'react-i18next';
import { appLocale } from '@/format';
import { getAppLanguage } from '@/i18n';

type AuthMode = 'login' | 'signup' | 'forgot';
type AuthStep = 'account-type' | 'credentials' | 'otp' | 'details';
type RegistrationRole = 'CUSTOMER' | 'VENUE_OWNER';

function normalizePhone(value: string) {
  const compact = value.replace(/[\s()-]/g, '');
  if (/^0\d{9}$/.test(compact)) return `+994${compact.slice(1)}`;
  if (/^994\d{9}$/.test(compact)) return `+${compact}`;
  return compact;
}

export default function Login() {
  const { t } = useTranslation();
  const { signIn, replaceDevice, signInBiometric, signInSocial, completeRegistration, biometric } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [step, setStep] = useState<AuthStep>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [role, setRole] = useState<RegistrationRole>();
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [notice, setNotice] = useState<string>();
  const [deviceLimit, setDeviceLimit] = useState<DeviceLimitDetails>();
  const [selectedDevice, setSelectedDevice] = useState<number>();

  const handleAuthError = (nextError: unknown) => {
    const response = nextError instanceof ApiError ? nextError.details as ({ code?: string; message?: string; params?: Partial<DeviceLimitDetails> }) | undefined : undefined;
    const details = response?.params;
    if (nextError instanceof ApiError && nextError.status === 409 && response?.code === 'AUTH_DEVICE_LIMIT_REACHED'
        && details?.limitToken && details.devices?.length) {
      const limit = { ...details, code: response.code, message: response.message || nextError.message } as DeviceLimitDetails;
      setDeviceLimit(limit);
      setSelectedDevice(limit.devices[0].id);
      return;
    }
    setError(nextError);
  };

  const changeMode = (next: AuthMode) => {
    setMode(next);
    setStep(next === 'signup' ? 'account-type' : 'credentials');
    setCode('');
    setPassword('');
    setConfirmPassword('');
    setChallenge('');
    if (next === 'signup') { setRole(undefined); setPhone(''); }
    setError(undefined);
    setNotice(undefined);
  };

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (mode === 'login') {
        await signIn(normalizedEmail, password);
      } else if (step === 'account-type') {
        if (!role) throw new Error(t('auth.chooseRoleError'));
        setStep('credentials');
      } else if (step === 'credentials') {
        if (mode === 'signup') await api.sendRegistrationOtp(normalizedEmail);
        else await api.sendPasswordResetOtp(normalizedEmail);
        setStep('otp');
      } else if (step === 'otp') {
        const result = mode === 'signup'
          ? await api.verifyRegistrationOtp(normalizedEmail, code)
          : await api.verifyPasswordResetOtp(normalizedEmail, code);
        setChallenge(result.token);
        setStep('details');
      } else if (mode === 'signup') {
        if (password !== confirmPassword) throw new Error(t('auth.passwordMismatch'));
        if (!role) throw new Error(t('auth.chooseRoleError'));
        await completeRegistration({ token: challenge, firstName: firstName.trim(), lastName: lastName.trim(), birthDate, role, phone: role === 'VENUE_OWNER' ? normalizePhone(phone) : undefined, password, confirmPassword });
      } else {
        if (password !== confirmPassword) throw new Error(t('auth.passwordMismatch'));
        await api.resetPassword(challenge, password, confirmPassword);
        changeMode('login');
        setNotice(t('auth.passwordUpdated'));
      }
    } catch (nextError) {
      handleAuthError(nextError);
    } finally {
      setBusy(false);
    }
  };

  const submitGoogle = async () => {
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      if (!isGoogleSignInConfigured()) {
        throw new Error(t('auth.googleUnavailable', { platform: Platform.OS }));
      }
      const socialChallenge = await api.socialChallenge('GOOGLE');
      const credential = await signInWithGoogle(socialChallenge.nonce);
      if (credential) await signInSocial('GOOGLE', socialChallenge.challenge, credential);
    } catch (nextError) {
      handleAuthError(nextError);
    } finally {
      setBusy(false);
    }
  };

  const submitBiometric = async () => {
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try { await signInBiometric(); }
    catch (nextError) { setError(nextError); }
    finally { setBusy(false); }
  };

  const submitDeviceReplacement = async () => {
    if (!deviceLimit || selectedDevice == null) return;
    setBusy(true);
    setError(undefined);
    try { await replaceDevice(selectedDevice, deviceLimit.limitToken); }
    catch (nextError) { setDeviceLimit(undefined); setSelectedDevice(undefined); setError(nextError); }
    finally { setBusy(false); }
  };

  const heading = step === 'account-type' ? t('auth.selectAccountType')
    : step === 'otp' ? t('auth.codeTitle')
    : step === 'details' && mode === 'signup' ? t('auth.detailsTitle')
      : step === 'details' ? t('auth.newPasswordTitle')
        : mode === 'login' ? t('auth.welcome')
          : mode === 'signup' ? t('auth.signupTitle') : t('auth.forgotTitle');
  const description = step === 'account-type'
    ? t('auth.accountDescription')
    : step === 'otp'
    ? t('auth.codeDescription', { email })
    : step === 'details' && mode === 'signup'
      ? t('auth.detailsDescription')
      : step === 'details'
        ? t('auth.newPasswordDescription')
    : mode === 'login'
      ? t('auth.loginDescription')
      : mode === 'signup' && role === 'VENUE_OWNER'
        ? t('auth.ownerSignupDescription')
        : mode === 'signup'
          ? t('auth.registerDescription')
        : t('auth.forgotDescription');

  const normalizedPhone = normalizePhone(phone);
  const disabled = busy || (step === 'account-type' && !role)
    || (step === 'credentials' && (!email.trim() || (mode === 'login' && password.length < 8) || (mode === 'signup' && role === 'VENUE_OWNER' && !/^\+994\d{9}$/.test(normalizedPhone))))
    || (step === 'otp' && code.length !== 6)
    || (step === 'details' && (password.length < 8 || confirmPassword.length < 8 || (mode === 'signup' && (!firstName.trim() || !lastName.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)))));
  const buttonTitle = busy ? t('auth.wait')
    : mode === 'login' ? t('auth.signIn')
      : step === 'account-type' ? t('common.continue')
      : step === 'credentials' ? (mode === 'signup' ? t('auth.registerStart') : t('auth.sendCode'))
        : step === 'otp' ? t('auth.confirmCode')
          : mode === 'signup' ? t('auth.createAccount') : t('auth.resetPassword');

  return <SafeAreaView style={styles.safe}>
    <View pointerEvents="none" style={styles.ringLarge}/>
    <View pointerEvents="none" style={styles.ringSmall}/>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <AndroidScaledContent>
        <Image source={require('../../assets/brand-logo.png')} resizeMode="contain" style={styles.logo}/>
        <View style={styles.card}>
          {mode !== 'forgot' && ((mode === 'login' && step === 'credentials') || (mode === 'signup' && step === 'account-type')) && <View style={styles.tabs}>
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === 'login' }} onPress={() => changeMode('login')} style={styles.tab}>
              <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>{t('auth.login')}</Text>
              {mode === 'login' && <View style={styles.tabLine}/>} 
            </Pressable>
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === 'signup' }} onPress={() => changeMode('signup')} style={styles.tab}>
              <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>{t('auth.register')}</Text>
              {mode === 'signup' && <View style={styles.tabLine}/>} 
            </Pressable>
          </View>}
          <View style={styles.intro}>
            <Text style={styles.heading}>{heading}</Text>
            <Text style={styles.description}>{description}</Text>
          </View>
          {step === 'account-type' && <View style={styles.roleList}>
            <RoleCard icon="person-outline" title={t('auth.customer')} subtitle={t('auth.customerDescription')} selected={role === 'CUSTOMER'} onPress={() => setRole('CUSTOMER')}/>
            <RoleCard icon="restaurant-outline" title={t('auth.owner')} subtitle={t('auth.ownerDescription')} selected={role === 'VENUE_OWNER'} onPress={() => setRole('VENUE_OWNER')}/>
          </View>}
          {(step === 'credentials' || step === 'otp') && <Field label={t('auth.email')} icon="mail-outline" value={email} onChangeText={setEmail} editable={step === 'credentials'} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="ad@example.com"/>}
          {mode === 'signup' && step === 'credentials' && role === 'VENUE_OWNER' && <Field label={t('auth.phone')} icon="call-outline" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" placeholder="050 123 45 67"/>}
          {mode === 'login' && <Field label={t('auth.password')} icon="lock-closed-outline" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" placeholder={t('auth.password')}/>} 
          {step === 'otp' && <Field label={t('auth.codeTitle')} icon="key-outline" value={code} onChangeText={value => setCode(value.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" placeholder="000000"/>}
          {step === 'details' && mode === 'signup' && <>
            <Field label={t('auth.firstName')} icon="person-outline" value={firstName} onChangeText={setFirstName} autoCapitalize="words" autoComplete="given-name" placeholder={t('auth.firstName')}/>
            <Field label={t('auth.lastName')} icon="person-outline" value={lastName} onChangeText={setLastName} autoCapitalize="words" autoComplete="family-name" placeholder={t('auth.lastName')}/>
            <BirthDatePickerField label={t('auth.birthDate')} value={birthDate} onChange={setBirthDate} maxDate={yesterdayIso()} placeholder={t('auth.birthDate')}/>
          </>}
          {step === 'details' && <>
            <Field label={t('auth.newPassword')} icon="lock-closed-outline" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="new-password" placeholder={t('auth.passwordHint')}/>
            <Field label={t('auth.confirmPassword')} icon="lock-closed-outline" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" autoComplete="new-password" placeholder={t('auth.repeatPasswordPlaceholder')}/>
          </>}
          {error != null && <ErrorText error={error}/>} 
          {notice && <Text style={styles.notice}>{notice}</Text>}
          <Button title={buttonTitle} onPress={submit} disabled={disabled}/>
          {mode === 'login' && step === 'credentials' && biometric.enabled && <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('auth.loginBiometric', { label: biometric.label })}
            disabled={busy}
            onPress={submitBiometric}
            style={({ pressed }) => [styles.biometricButton, (pressed || busy) && styles.socialDisabled]}>
            <Ionicons name={biometric.label === 'Face ID' ? 'scan-outline' : 'finger-print-outline'} size={22} color={colors.brandDark}/>
            <Text style={styles.biometricButtonText}>{t('auth.loginBiometric', { label: biometric.label })}</Text>
          </Pressable>}
          {mode === 'login' && <Button title={t('auth.forgot')} variant="ghost" onPress={() => changeMode('forgot')}/>} 
          {mode === 'forgot' && <Button title={t('auth.returnLogin')} variant="ghost" onPress={() => changeMode('login')}/>} 
          {mode !== 'login' && (step === 'otp' || step === 'details') && <Button title={t('auth.changeEmail')} variant="ghost" onPress={() => { setStep('credentials'); setCode(''); setChallenge(''); setError(undefined); }}/>} 
          {mode === 'signup' && step === 'credentials' && <Button title={t('auth.changeRole')} variant="ghost" onPress={() => { setStep('account-type'); setError(undefined); }}/>} 
          {mode === 'login' && step === 'credentials' && <View style={styles.socialSection}>
            <View style={styles.socialDivider}>
              <View style={styles.securityLine}/>
              <Text style={styles.socialDividerText}>{t('auth.orContinue')}</Text>
              <View style={styles.securityLine}/>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('auth.continueGoogle')}
              disabled={busy}
              onPress={submitGoogle}
              style={({ pressed }) => [styles.googleButton, (pressed || busy) && styles.socialDisabled]}>
              <Image source={require('../../assets/google-g-logo.png')} resizeMode="contain" style={styles.googleLogo}/>
              <Text style={styles.googleButtonText}>{t('auth.continueGoogle')}</Text>
            </Pressable>
          </View>}
          <View style={styles.securityRow}>
            <View style={styles.securityLine}/>
            <Text style={styles.securityText}>{t('auth.secureLogin')}</Text>
            <View style={styles.securityLine}/>
          </View>
          <Text style={styles.terms}>{t('auth.terms')}</Text>
        </View>
        </AndroidScaledContent>
      </ScrollView>
    </KeyboardAvoidingView>
    <DeviceLimitSheet details={deviceLimit} selected={selectedDevice} busy={busy} onSelect={setSelectedDevice} onSubmit={submitDeviceReplacement} onClose={() => { setDeviceLimit(undefined); setSelectedDevice(undefined); }}/>
  </SafeAreaView>;
}

function DeviceLimitSheet({ details, selected, busy, onSelect, onSubmit, onClose }: { details?: DeviceLimitDetails; selected?: number; busy: boolean; onSelect: (id: number) => void; onSubmit: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  return <Modal visible={!!details} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.sheetBackdrop}><Pressable accessibilityLabel={t('common.close')} onPress={onClose} style={StyleSheet.absoluteFill}/><View style={styles.sheet}>
      <View style={styles.sheetHandle}/>
      <Text style={styles.sheetTitle}>{t('auth.deviceLimitTitle')}</Text>
      <Text style={styles.sheetDescription}>{t('auth.deviceLimitDescription', { limit: details?.deviceLimit })}</Text>
      <View style={styles.sheetDevices}>{details?.devices.map(device => <LimitDevice key={device.id} device={device} selected={selected === device.id} onPress={() => onSelect(device.id)}/>)}</View>
      <Button title={busy ? t('auth.wait') : t('auth.replaceDevice')} disabled={busy || selected == null} onPress={onSubmit}/>
      <Button title={t('common.cancel')} variant="ghost" disabled={busy} onPress={onClose}/>
    </View></View>
  </Modal>;
}

function LimitDevice({ device, selected, onPress }: { device: UserDevice; selected: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const time = new Intl.DateTimeFormat(appLocale(getAppLanguage()), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(device.lastActiveAt));
  const platform = device.platform === 'IOS' ? 'iOS' : 'Android';
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[styles.limitDevice, selected && styles.limitDeviceSelected]}>
    <View style={[styles.radio, selected && styles.radioSelected]}>{selected && <View style={styles.radioDot}/>}</View>
    <View style={styles.limitIcon}><Ionicons name="phone-portrait-outline" size={17} color={colors.brandDark}/></View>
    <View style={{ flex: 1 }}><Text style={styles.limitName}>{device.deviceName} · {platform} {device.osVersion}</Text><Text style={styles.limitActivity}>{t('auth.lastActive', { time })}{device.lastCity ? ` · ${device.lastCity}` : ''}</Text></View>
  </Pressable>;
}

function RoleCard({ icon, title, subtitle, selected, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.roleCard, selected && styles.roleCardSelected, pressed && { opacity: .72 }]}>
    <View style={[styles.roleIcon, selected && styles.roleIconSelected]}><Ionicons name={icon} size={28} color={selected ? '#FFFDF8' : colors.brandDark}/></View>
    <View style={{ flex: 1 }}><Text style={[styles.roleTitle, selected && styles.roleTitleSelected]}>{title}</Text><Text style={[styles.roleSubtitle, selected && styles.roleSubtitleSelected]}>{subtitle}</Text></View>
    <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={23} color={selected ? colors.goldLight : colors.muted}/>
  </Pressable>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.cream },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingTop: 24, paddingBottom: 34 },
  logo: { width: 250, height: 188, alignSelf: 'center', marginBottom: 6 },
  card: { backgroundColor: 'rgba(255,253,248,0.96)', borderWidth: 1, borderColor: colors.line, borderRadius: 28, padding: 20, gap: 15, shadowColor: colors.shadow, shadowOpacity: .1, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line, marginHorizontal: -4 },
  tab: { flex: 1, minHeight: 45, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  tabText: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  tabTextActive: { color: colors.ink, fontWeight: '800' },
  tabLine: { position: 'absolute', bottom: -1, left: 15, right: 15, height: 2, borderRadius: 2, backgroundColor: colors.gold },
  intro: { alignItems: 'center', paddingTop: 3, gap: 5 },
  heading: { color: colors.ink, fontSize: 25, lineHeight: 31, textAlign: 'center', fontWeight: '700', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  description: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  notice: { color: '#397552', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  roleList: { gap: 11 },
  roleCard: { minHeight: 82, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', gap: 13 },
  roleCardSelected: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  roleIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.softGold, alignItems: 'center', justifyContent: 'center' },
  roleIconSelected: { backgroundColor: 'rgba(255,255,255,.14)' },
  roleTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  roleTitleSelected: { color: '#FFFDF8' },
  roleSubtitle: { color: colors.muted, fontSize: 12, marginTop: 3 },
  roleSubtitleSelected: { color: '#E9DEC7' },
  socialSection: { gap: 10 },
  socialDivider: { flexDirection: 'row', alignItems: 'center', gap: 11, marginVertical: 1 },
  socialDividerText: { color: colors.muted, fontSize: 12 },
  googleButton: { minHeight: 52, borderWidth: 1, borderColor: '#747775', borderRadius: 14, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 18 },
  googleLogo: { width: 20, height: 20 },
  googleButtonText: { color: '#1F1F1F', fontSize: 14, fontWeight: '600' },
  biometricButton: { minHeight: 52, borderWidth: 1, borderColor: colors.goldLight, borderRadius: 26, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 18 },
  biometricButtonText: { color: colors.brandDark, fontSize: 14, fontWeight: '800' },
  socialDisabled: { opacity: .55 },
  securityRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 2 },
  securityLine: { flex: 1, height: 1, backgroundColor: colors.line },
  securityText: { color: colors.muted, fontSize: 11 },
  terms: { color: '#918879', fontSize: 11, lineHeight: 16, textAlign: 'center', paddingHorizontal: 10 },
  ringLarge: { position: 'absolute', width: 330, height: 330, borderRadius: 170, borderWidth: 54, borderColor: 'rgba(199,166,96,0.08)', top: -130, right: -150 },
  ringSmall: { position: 'absolute', width: 190, height: 190, borderRadius: 100, borderWidth: 30, borderColor: 'rgba(185,154,91,0.055)', bottom: -78, left: -95 },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(28,27,24,.48)' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: colors.paper, paddingHorizontal: 15, paddingTop: 9, paddingBottom: 24, gap: 12 },
  sheetHandle: { width: 35, height: 4, borderRadius: 2, backgroundColor: '#D2C8B7', alignSelf: 'center', marginBottom: 5 },
  sheetTitle: { color: colors.ink, fontSize: 21, fontWeight: '700', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  sheetDescription: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  sheetDevices: { gap: 9 },
  limitDevice: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 10 },
  limitDeviceSelected: { borderColor: colors.gold, backgroundColor: '#FFFCF6' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#9D968A', alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: colors.brand },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
  limitIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.softGold, alignItems: 'center', justifyContent: 'center' },
  limitName: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  limitActivity: { color: colors.muted, fontSize: 9, marginTop: 4 }
});
