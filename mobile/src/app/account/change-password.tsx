import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '@/api';
import { useAuth } from '@/auth';
import { Button, Card, Field, Screen, run } from '@/ui';
import { colors } from '@/theme';

export default function ChangePasswordScreen() {
  const { t } = useTranslation();
  const { user, refreshProfile } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const hasPassword = user?.hasPassword ?? true;

  const passwordsMatch = newPassword === confirmPassword;
  const valid = (!hasPassword || (currentPassword.length > 0 && currentPassword.length <= 128))
    && newPassword.length >= 8
    && newPassword.length <= 128
    && confirmPassword.length >= 8
    && passwordsMatch
    && (!hasPassword || currentPassword !== newPassword);

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const success = await run(
        async () => {
          await api.changePassword(hasPassword ? currentPassword : undefined, newPassword, confirmPassword);
          await refreshProfile();
        },
        t('account.password.updated'),
      );
      if (success) router.back();
    } finally {
      setBusy(false);
    }
  };

  return <Screen
    title={t('account.password.change')}
    subtitle={t('account.password.subtitle')}
    back
    footer={<Button title={busy ? t('account.password.changing') : t('account.password.change')} onPress={() => void save()} disabled={!valid || busy}/>}>
    <Card style={styles.form}>
      {hasPassword ? <>
      <Field
        label={t('account.password.current')}
        value={currentPassword}
        onChangeText={setCurrentPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        maxLength={128}
        editable={!busy}
        placeholder={t('account.password.currentPlaceholder')}
      />
      <View style={styles.divider}/>
      </> : null}
      <Field
        label={t('auth.newPassword')}
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        passwordRules="minlength: 8; maxlength: 128;"
        maxLength={128}
        editable={!busy}
        placeholder={t('auth.passwordHint')}
        error={newPassword.length > 0 && newPassword.length < 8 ? t('account.password.minLength') : undefined}
      />
      <Field
        label={t('account.password.repeat')}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        maxLength={128}
        editable={!busy}
        placeholder={t('account.password.repeatPlaceholder')}
        error={confirmPassword.length > 0 && !passwordsMatch ? t('account.password.mismatch') : undefined}
        onSubmitEditing={() => void save()}
      />
      {hasPassword && newPassword.length >= 8 && currentPassword === newPassword
        ? <Text style={styles.error}>{t('account.password.mustDiffer')}</Text>
        : null}
    </Card>
    <Text style={styles.help}>{t('account.password.minLength')}</Text>
  </Screen>;
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginVertical: 2 },
  help: { color: colors.muted, fontSize: 11, lineHeight: 16, paddingHorizontal: 4 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18 },
});
