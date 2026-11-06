/* eslint-disable import/no-named-as-default-member */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n, { type TOptions } from 'i18next';
import { initReactI18next } from 'react-i18next';
import az from './locales/az.json';
import en from './locales/en.json';
import ru from './locales/ru.json';

export type AppLanguage = 'az' | 'en' | 'ru';

const LANGUAGE_STORAGE_KEY = '@xosbextol/language';
const supportedLanguages: readonly AppLanguage[] = ['az', 'en', 'ru'];
let explicitLanguageChoice = false;
let initialization: Promise<void> | undefined;

function normalizeLanguage(value: string | null | undefined): AppLanguage | undefined {
  const language = value?.toLowerCase().split(/[-_]/)[0];
  return supportedLanguages.find(candidate => candidate === language);
}

export function initializeI18n() {
  if (!initialization) {
    initialization = (async () => {
      let stored: AppLanguage | undefined;
      try { stored = normalizeLanguage(await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)); }
      catch { /* Device storage can be temporarily unavailable. */ }
      explicitLanguageChoice = !!stored;
      const device = normalizeLanguage(getLocales()[0]?.languageCode);
      await i18n.use(initReactI18next).init({
        resources: { az: { translation: az }, en: { translation: en }, ru: { translation: ru } },
        lng: stored || device || 'az',
        fallbackLng: 'az',
        supportedLngs: supportedLanguages,
        interpolation: { escapeValue: false },
        returnNull: false,
      });
    })();
  }
  return initialization;
}

export function hasLanguageChoice() {
  return explicitLanguageChoice;
}

export function getAppLanguage(): AppLanguage {
  return normalizeLanguage(i18n.resolvedLanguage || i18n.language) || 'az';
}

export async function changeAppLanguage(language: AppLanguage, persist = true) {
  await i18n.changeLanguage(language);
  if (persist) {
    explicitLanguageChoice = true;
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }
}

export function translate(key: string, options?: TOptions) {
  return String(i18n.t(key, options));
}

export default i18n;
