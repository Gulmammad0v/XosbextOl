import type { AppLanguage } from './i18n';

const localeByLanguage: Record<AppLanguage, string> = {
  az: 'az-AZ',
  en: 'en-US',
  ru: 'ru-RU',
};

export function appLocale(language: AppLanguage) {
  return localeByLanguage[language];
}

export function formatDate(value: Date | string | number, language: AppLanguage, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat(appLocale(language), options).format(new Date(value));
}

export function formatTime(value: Date | string | number, language: AppLanguage) {
  return new Intl.DateTimeFormat(appLocale(language), { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export function formatCurrency(value: number | string, language: AppLanguage) {
  return new Intl.NumberFormat(appLocale(language), {
    style: 'currency',
    currency: 'AZN',
    minimumFractionDigits: Number(value) % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}
