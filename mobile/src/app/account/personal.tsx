import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { api } from '@/api';
import { useAuth } from '@/auth';
import { Button, Card, Field, Screen, run } from '@/ui';
import { colors } from '@/theme';

function phoneDigits(value?: string) {
  const digits = (value || '').replace(/\D/g, '');
  return (digits.startsWith('994') ? digits.slice(3) : digits).slice(0, 9);
}

function formatPhone(value: string) {
  const digits = phoneDigits(value);
  return [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)].filter(Boolean).join(' ');
}

export default function PersonalInformationScreen() {
  const { t } = useTranslation();
  const { user, setProfile } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(phoneDigits(user?.phone));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  if (!user) return null;

  const normalizedName = fullName.trim().replace(/\s+/g, ' ');
  const initialName = (user.fullName || '').trim().replace(/\s+/g, ' ');
  const initialPhone = phoneDigits(user.phone);
  const nameChanged = normalizedName !== initialName;
  const phoneChanged = phone !== initialPhone;
  const changeCount = Number(nameChanged) + Number(phoneChanged);
  const validPhone = phone.length === 9 || (!initialPhone && phone.length === 0);
  const valid = normalizedName.length > 1 && validPhone;
  const initials = (normalizedName || user.email).split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('');

  const save = async () => {
    setBusy(true);
    try {
      const success = await run(async () => {
        const profile = await api.updateMe({ fullName: normalizedName, language: user.language, phone: phone ? `+994${phone}` : undefined });
        setProfile(profile);
      });
      if (success) {
        setSaved(true);
        setTimeout(() => router.back(), 850);
      }
    } finally {
      setBusy(false);
    }
  };

  return <Screen
    title={t('account.personal.title')}
    subtitle={t('account.personal.subtitle')}
    back
    footer={<View style={styles.footerContent}>
      {saved ? <Text style={styles.savedText}>{t('account.personal.updated')}</Text> : changeCount > 0 ? <Text style={styles.changeText}>{t('account.personal.unsavedChanges', { count: changeCount })}</Text> : null}
      <Button title={busy ? t('common.saving') : t('common.save')} onPress={() => void save()} disabled={busy || saved || !valid || changeCount === 0}/>
    </View>}
  >
    <View style={styles.identity}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
      <Text style={styles.name}>{normalizedName || user.fullName}</Text>
      {user.role === 'VENUE_OWNER' && <View style={styles.role}><Text style={styles.roleText}>{t('profile.owner')}</Text></View>}
    </View>

    <Card style={styles.formCard}>
      <Field label={t('account.personal.fullName')} value={fullName} onChangeText={setFullName} autoCapitalize="words" autoComplete="name" maxLength={150}/>
      {user.role === 'VENUE_OWNER' && nameChanged && <View style={styles.reviewNote}>
        <Ionicons name="information-circle-outline" size={15} color={colors.brandDark}/>
        <Text style={styles.reviewNoteText}>{t('account.personal.ownerReviewNotice')}</Text>
      </View>}
      <Field label={t('auth.email')} value={user.email} editable={false}/>
      <Text style={styles.help}>{t('account.personal.emailHelp')}</Text>
      <View style={styles.phoneField}>
        <Text style={styles.label}>{t('auth.phone')}</Text>
        <View style={styles.phoneShell}>
          <View style={styles.prefix}><Text style={styles.prefixText}>+994</Text></View>
          <TextInput
            value={formatPhone(phone)}
            onChangeText={value => setPhone(phoneDigits(value))}
            keyboardType="number-pad"
            inputMode="numeric"
            autoComplete="tel"
            maxLength={12}
            placeholder="50 123 45 67"
            placeholderTextColor="#9F9688"
            style={styles.phoneInput}
          />
          {phone.length === 9 && <Ionicons name="checkmark-circle-outline" size={20} color={colors.success}/>} 
        </View>
      </View>
      <Text style={styles.help}>{t('account.personal.phoneHelp')}</Text>
    </Card>

    <Pressable accessibilityRole="button" accessibilityLabel={t('account.password.change')} onPress={() => router.push('/account/change-password' as any)} style={({ pressed }) => [styles.passwordRow, pressed && { opacity: .7 }]}>
      <View><Text style={styles.passwordLabel}>{t('auth.password')}</Text><Text style={styles.passwordDots}>••••••••</Text></View>
      <Text style={styles.changePassword}>{t('common.change')} ›</Text>
    </Pressable>
  </Screen>;
}

const styles = StyleSheet.create({
  identity: { alignItems: 'center', gap: 5, paddingVertical: 4 },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFE2BF', borderWidth: 1.5, borderColor: colors.gold },
  avatarText: { color: colors.ink, fontSize: 24, fontWeight: '700', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  name: { color: colors.ink, fontSize: 17, fontWeight: '800', marginTop: 3, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  role: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: colors.softGold },
  roleText: { color: colors.brandDark, fontSize: 10, fontWeight: '600' },
  formCard: { gap: 7 },
  help: { color: colors.muted, fontSize: 9, lineHeight: 13, marginTop: -2 },
  reviewNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, padding: 9, borderRadius: 10, backgroundColor: colors.softGold },
  reviewNoteText: { flex: 1, color: colors.brandDark, fontSize: 10, lineHeight: 14 },
  phoneField: { gap: 6 },
  label: { color: colors.muted, fontSize: 11, fontWeight: '500' },
  phoneShell: { minHeight: 44, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.paper, paddingRight: 12 },
  prefix: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, backgroundColor: colors.softGold, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.line },
  prefixText: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  phoneInput: { flex: 1, minHeight: 42, paddingHorizontal: 12, paddingVertical: 0, color: colors.ink, fontSize: 14 },
  passwordRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderRadius: 17, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  passwordLabel: { color: colors.muted, fontSize: 10 },
  passwordDots: { color: colors.ink, fontSize: 16, letterSpacing: 4, marginTop: 2 },
  changePassword: { color: colors.brandDark, fontSize: 11, fontWeight: '700' },
  footerContent: { gap: 7 },
  changeText: { color: colors.brandDark, fontSize: 9, textAlign: 'center' },
  savedText: { color: colors.success, fontSize: 11, fontWeight: '700', textAlign: 'center' },
});
