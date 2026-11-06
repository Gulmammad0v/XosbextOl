import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { api } from '@/api';
import { useAuth } from '@/auth';
import { changeAppLanguage, getAppLanguage, type AppLanguage } from '@/i18n';
import { LanguageSelector } from '@/language-selector';
import { colors } from '@/theme';
import { Screen } from '@/ui';

export default function LanguageScreen() {
  const { user, setProfile } = useAuth();
  const { t } = useTranslation();
  const [language, setLanguage] = useState<AppLanguage>(getAppLanguage());
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const select = async (next: AppLanguage) => {
    if (busy || next === language) return;
    const previous = language;
    setLanguage(next);
    setBusy(true);
    try {
      await changeAppLanguage(next);
      setProfile(await api.updateLanguage(next));
    } catch {
      setLanguage(previous);
      await changeAppLanguage(previous);
      Alert.alert(t('common.error'), t('language.syncError'));
    } finally {
      setBusy(false);
    }
  };

  return <Screen title={t('language.title')} subtitle={t('language.subtitle')} back>
    <LanguageSelector value={language} onChange={next => void select(next)}/>
    <View style={styles.info}>
      <Ionicons name="information-circle-outline" size={18} color={colors.brand}/>
      <Text style={styles.infoText}>{t('language.accountInfo')}</Text>
    </View>
    <View style={styles.supportRow}>
      <Text style={styles.question}>{t('language.translationQuestion')}</Text>
      <Pressable accessibilityRole="button"><Text style={styles.support}>{t('language.support')} ›</Text></Pressable>
    </View>
    {busy && <Text style={styles.saving}>{t('common.saving')}</Text>}
  </Screen>;
}

const styles = StyleSheet.create({
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 12, borderRadius: 13, backgroundColor: colors.softGold },
  infoText: { flex: 1, color: colors.ink, fontSize: 11, lineHeight: 16 },
  supportRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 3 },
  question: { color: colors.muted, fontSize: 11 },
  support: { color: colors.brandDark, fontSize: 11, fontWeight: '700' },
  saving: { color: colors.muted, fontSize: 11, textAlign: 'center' },
});
