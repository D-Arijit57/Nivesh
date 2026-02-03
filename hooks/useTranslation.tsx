/**
 * i18n React Hook
 * 
 * Provides translation functionality in React components.
 * 
 * @module hooks/useTranslation
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  t as translate,
  Locale,
  TranslationKey,
  TranslationParams,
  i18nConfig,
  detectLocale,
  setLocale as persistLocale,
  formatDate,
  formatTime,
  formatDateTime,
  formatRelativeTime,
  getLocaleDisplayName,
  localeDisplayNames,
} from '@/lib/i18n';

// ===========================================
// Types
// ===========================================

interface I18nContextValue {
  /** Current locale */
  locale: Locale;
  /** Translation function */
  t: (key: TranslationKey, params?: TranslationParams) => string;
  /** Change locale */
  setLocale: (locale: Locale) => void;
  /** Format date */
  formatDate: (date: Date | string | number) => string;
  /** Format time */
  formatTime: (date: Date | string | number) => string;
  /** Format date and time */
  formatDateTime: (date: Date | string | number) => string;
  /** Format relative time */
  formatRelative: (date: Date | string | number) => string;
  /** Get locale display name */
  getLocaleName: (locale: Locale) => string;
  /** Available locales */
  locales: typeof localeDisplayNames;
  /** Is loading (hydration) */
  isLoading: boolean;
}

// ===========================================
// Context
// ===========================================

const I18nContext = createContext<I18nContextValue | null>(null);

// ===========================================
// Provider
// ===========================================

interface I18nProviderProps {
  children: React.ReactNode;
  /** Initial locale (server-side) */
  initialLocale?: Locale;
}

/**
 * I18nProvider - Provides internationalization context to app
 * 
 * @example
 * ```tsx
 * // app/layout.tsx
 * import { I18nProvider } from '@/hooks/useTranslation';
 * 
 * export default function RootLayout({ children }) {
 *   return (
 *     <I18nProvider>
 *       {children}
 *     </I18nProvider>
 *   );
 * }
 * ```
 */
export const I18nProvider: React.FC<I18nProviderProps> = ({
  children,
  initialLocale,
}) => {
  const [locale, setLocaleState] = useState<Locale>(
    initialLocale || i18nConfig.defaultLocale
  );
  const [isLoading, setIsLoading] = useState(true);
  
  // Detect locale on mount (client-side only)
  useEffect(() => {
    const detectedLocale = detectLocale();
    setLocaleState(detectedLocale);
    setIsLoading(false);
  }, []);
  
  // Set locale handler
  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    persistLocale(newLocale);
    
    // Update HTML lang attribute
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLocale === 'hi' ? 'hi-IN' : 'en-IN';
    }
  }, []);
  
  // Memoized translation function
  const t = useCallback(
    (key: TranslationKey, params?: TranslationParams) => {
      return translate(key, locale, params);
    },
    [locale]
  );
  
  // Memoized date formatters
  const formatDateMemo = useCallback(
    (date: Date | string | number) => formatDate(date, locale),
    [locale]
  );
  
  const formatTimeMemo = useCallback(
    (date: Date | string | number) => formatTime(date, locale),
    [locale]
  );
  
  const formatDateTimeMemo = useCallback(
    (date: Date | string | number) => formatDateTime(date, locale),
    [locale]
  );
  
  const formatRelativeMemo = useCallback(
    (date: Date | string | number) => formatRelativeTime(date, locale),
    [locale]
  );
  
  const getLocaleName = useCallback(
    (targetLocale: Locale) => getLocaleDisplayName(targetLocale, locale),
    [locale]
  );
  
  // Context value
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      t,
      setLocale,
      formatDate: formatDateMemo,
      formatTime: formatTimeMemo,
      formatDateTime: formatDateTimeMemo,
      formatRelative: formatRelativeMemo,
      getLocaleName,
      locales: localeDisplayNames,
      isLoading,
    }),
    [
      locale,
      t,
      setLocale,
      formatDateMemo,
      formatTimeMemo,
      formatDateTimeMemo,
      formatRelativeMemo,
      getLocaleName,
      isLoading,
    ]
  );
  
  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
};

// ===========================================
// Hook
// ===========================================

/**
 * useTranslation - Hook to access i18n context
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { t, locale, setLocale, formatDate } = useTranslation();
 *   
 *   return (
 *     <div>
 *       <h1>{t('welcome')}</h1>
 *       <p>{t('greeting', { name: 'John' })}</p>
 *       <p>{formatDate(new Date())}</p>
 *       <select 
 *         value={locale} 
 *         onChange={(e) => setLocale(e.target.value as Locale)}
 *       >
 *         <option value="en">English</option>
 *         <option value="hi">हिंदी</option>
 *       </select>
 *     </div>
 *   );
 * }
 * ```
 */
export function useTranslation(): I18nContextValue {
  const context = useContext(I18nContext);
  
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  
  return context;
}

// ===========================================
// Language Switcher Component
// ===========================================

interface LanguageSwitcherProps {
  /** Additional class names */
  className?: string;
  /** Show as dropdown or buttons */
  variant?: 'dropdown' | 'buttons';
}

/**
 * LanguageSwitcher - Component to switch between languages
 */
export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  className,
  variant = 'dropdown',
}) => {
  const { locale, setLocale, locales, t } = useTranslation();
  
  if (variant === 'buttons') {
    return (
      <div className={`flex gap-2 ${className || ''}`} role="group" aria-label="Language selection">
        {(Object.keys(locales) as Locale[]).map((loc) => (
          <button
            key={loc}
            onClick={() => setLocale(loc)}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors
              ${locale === loc 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
              }`}
            aria-pressed={locale === loc}
            lang={loc}
          >
            {locales[loc].native}
          </button>
        ))}
      </div>
    );
  }
  
  return (
    <div className={className}>
      <label htmlFor="language-select" className="sr-only">
        {t('settings_language')}
      </label>
      <select
        id="language-select"
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md 
          bg-white dark:bg-gray-800 dark:border-gray-600
          focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label={t('settings_language')}
      >
        {(Object.keys(locales) as Locale[]).map((loc) => (
          <option key={loc} value={loc} lang={loc}>
            {locales[loc].native} ({locales[loc].english})
          </option>
        ))}
      </select>
    </div>
  );
};

export default useTranslation;
