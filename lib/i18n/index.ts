/**
 * Internationalization (i18n) Module
 * 
 * Provides translation support for Hindi and English
 * with date/time and number formatting for Indian locale.
 * 
 * @module lib/i18n
 */

import { enTranslations } from './locales/en';
import { hiTranslations } from './locales/hi';

// ===========================================
// Types
// ===========================================

export type Locale = 'en' | 'hi';

export type TranslationKey = keyof typeof enTranslations;

export type TranslationParams = Record<string, string | number>;

export interface I18nConfig {
  defaultLocale: Locale;
  supportedLocales: Locale[];
  fallbackLocale: Locale;
}

// ===========================================
// Configuration
// ===========================================

export const i18nConfig: I18nConfig = {
  defaultLocale: 'en',
  supportedLocales: ['en', 'hi'],
  fallbackLocale: 'en',
};

// ===========================================
// Translations Map
// ===========================================

const translations: Record<Locale, typeof enTranslations> = {
  en: enTranslations,
  hi: hiTranslations,
};

// ===========================================
// Translation Functions
// ===========================================

/**
 * Get translated string for a key
 * 
 * @param key - Translation key
 * @param locale - Target locale
 * @param params - Optional interpolation parameters
 * @returns Translated string
 * 
 * @example
 * ```ts
 * t('welcome', 'en'); // "Welcome"
 * t('welcome', 'hi'); // "स्वागत है"
 * t('greeting', 'en', { name: 'John' }); // "Hello, John!"
 * ```
 */
export function t(
  key: TranslationKey,
  locale: Locale = i18nConfig.defaultLocale,
  params?: TranslationParams
): string {
  let translation: string = translations[locale]?.[key] 
    || translations[i18nConfig.fallbackLocale][key] 
    || key;
  
  if (!params) return translation;
  
  // Interpolate parameters
  for (const [paramKey, value] of Object.entries(params)) {
    translation = translation.replace(new RegExp(`{${paramKey}}`, 'g'), String(value));
  }
  
  return translation;
}

/**
 * Get all translations for current locale
 */
export function getTranslations(locale: Locale = i18nConfig.defaultLocale) {
  return translations[locale] || translations[i18nConfig.fallbackLocale];
}

/**
 * Check if a locale is supported
 */
export function isValidLocale(locale: string): locale is Locale {
  return i18nConfig.supportedLocales.includes(locale as Locale);
}

/**
 * Get locale from browser/user preference
 */
export function detectLocale(): Locale {
  if (typeof window === 'undefined') {
    return i18nConfig.defaultLocale;
  }
  
  // Check localStorage
  const stored = localStorage.getItem('locale');
  if (stored && isValidLocale(stored)) {
    return stored;
  }
  
  // Check browser language
  const browserLang = navigator.language.split('-')[0];
  if (isValidLocale(browserLang)) {
    return browserLang;
  }
  
  return i18nConfig.defaultLocale;
}

/**
 * Set user's preferred locale
 */
export function setLocale(locale: Locale): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('locale', locale);
    // Optionally reload to apply changes
    // window.location.reload();
  }
}

// ===========================================
// Date/Time Formatting
// ===========================================

const dateFormatters: Record<Locale, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }),
  hi: new Intl.DateTimeFormat('hi-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }),
};

const timeFormatters: Record<Locale, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }),
  hi: new Intl.DateTimeFormat('hi-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }),
};

const dateTimeFormatters: Record<Locale, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }),
  hi: new Intl.DateTimeFormat('hi-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }),
};

/**
 * Format date for display
 * 
 * @example
 * ```ts
 * formatDate(new Date(), 'en'); // "25 Dec 2024"
 * formatDate(new Date(), 'hi'); // "25 दिस॰ 2024"
 * ```
 */
export function formatDate(
  date: Date | string | number,
  locale: Locale = i18nConfig.defaultLocale
): string {
  const dateObj = date instanceof Date ? date : new Date(date);
  return dateFormatters[locale].format(dateObj);
}

/**
 * Format time for display
 */
export function formatTime(
  date: Date | string | number,
  locale: Locale = i18nConfig.defaultLocale
): string {
  const dateObj = date instanceof Date ? date : new Date(date);
  return timeFormatters[locale].format(dateObj);
}

/**
 * Format date and time for display
 */
export function formatDateTime(
  date: Date | string | number,
  locale: Locale = i18nConfig.defaultLocale
): string {
  const dateObj = date instanceof Date ? date : new Date(date);
  return dateTimeFormatters[locale].format(dateObj);
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(
  date: Date | string | number,
  locale: Locale = i18nConfig.defaultLocale
): string {
  const dateObj = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  const rtf = new Intl.RelativeTimeFormat(locale === 'hi' ? 'hi-IN' : 'en-IN', {
    numeric: 'auto',
  });
  
  if (diffSecs < 60) {
    return rtf.format(-diffSecs, 'second');
  } else if (diffMins < 60) {
    return rtf.format(-diffMins, 'minute');
  } else if (diffHours < 24) {
    return rtf.format(-diffHours, 'hour');
  } else if (diffDays < 30) {
    return rtf.format(-diffDays, 'day');
  } else {
    return formatDate(dateObj, locale);
  }
}

// ===========================================
// Locale Display Names
// ===========================================

export const localeDisplayNames: Record<Locale, { native: string; english: string }> = {
  en: { native: 'English', english: 'English' },
  hi: { native: 'हिंदी', english: 'Hindi' },
};

/**
 * Get display name for a locale
 */
export function getLocaleDisplayName(
  locale: Locale,
  displayLocale: Locale = i18nConfig.defaultLocale
): string {
  return displayLocale === locale 
    ? localeDisplayNames[locale].native 
    : localeDisplayNames[locale].english;
}

// ===========================================
// Re-exports
// ===========================================

export { enTranslations, hiTranslations };
