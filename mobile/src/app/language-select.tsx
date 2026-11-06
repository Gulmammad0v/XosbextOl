import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getLocales } from 'expo-localization';
import { useTranslation } from 'react-i18next';
import { Button } from '@/ui';
import { colors } from '@/theme';
import { changeAppLanguage, getAppLanguage, type AppLanguage } from '@/i18n';
import { LanguageSelector } from '@/language-selector';

function deviceLanguage(): AppLanguage | undefined {
  const language = getLocales()[0]?.languageCode?.toLowerCase();
  return language === 'az' || language === 'en' || language === 'ru' ? language : undefined;
}

export default function LanguageOnboardingScreen() {
  const { t } = useTranslation();
  const [language, setLanguage] = useState<AppLanguage>(getAppLanguage());
  const detectedLanguage = deviceLanguage();

  const select = async (next: AppLanguage) => {
    setLanguage(next);
    await changeAppLanguage(next);
  };

  const continueToApp = async () => {
    await changeAppLanguage(language);
    router.replace('/login');
  };

  return <SafeAreaView style={styles.safe}>
    <View style={styles.content}>
      <View style={styles.hero}>
        <View style={styles.globe}><Ionicons name="globe-outline" size={30} color={colors.brandDark}/></View>
        <Text style={styles.title}>{t('language.onboardingTitle')}</Text>
        <Text style={styles.subtitle}>{t('language.onboardingSubtitle')}</Text>
      </View>
      <LanguageSelector value={language} onChange={next => void select(next)} deviceLanguage={detectedLanguage}/>
      <View style={styles.spacer}/>
      <Button title={t('common.continue')} onPress={() => void continueToApp()}/>
      <Text style={styles.note}>{t('language.changeLater')}</Text>
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  content: { flex: 1, paddingHorizontal: 18, paddingTop: 42, paddingBottom: 16 },
  hero: { alignItems: 'center', marginBottom: 26 },
  globe: { width: 66, height: 66, borderRadius: 33, backgroundColor: colors.goldLight, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { color: colors.ink, fontSize: 28, lineHeight: 34, fontWeight: '700', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  subtitle: { marginTop: 4, color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  spacer: { flex: 1, minHeight: 28 },
  note: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 10 },
});
