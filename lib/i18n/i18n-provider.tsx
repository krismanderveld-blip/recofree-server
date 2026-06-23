import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import enStrings from './locales/en.json';
import nlStrings from './locales/nl.json';
import frStrings from './locales/fr.json';

// ─── Types ──────────────────────────────────────────────────────
export type SupportedLanguage = 'nl' | 'en' | 'fr';
export type SupportedCountry = 'NL' | 'BE' | 'FR' | 'UK' | 'US';

type TranslationStrings = Record<string, string>;

const LANGUAGE_MAP: Record<SupportedLanguage, TranslationStrings> = {
  en: enStrings,
  nl: nlStrings,
  fr: frStrings,
};

// ─── Storage Keys ───────────────────────────────────────────────
const LANGUAGE_STORAGE_KEY = '@recofree_language';
const COUNTRY_STORAGE_KEY = '@recofree_country';

// ─── Context ────────────────────────────────────────────────────
interface I18nContextValue {
  language: SupportedLanguage;
  /** Alias for language — used by pipeline/server to pass locale */
  locale: SupportedLanguage;
  country: SupportedCountry | null;
  setLanguage: (lang: SupportedLanguage) => void;
  setLocale: (lang: SupportedLanguage) => void;
  setCountry: (country: SupportedCountry) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  isReady: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────────────
interface I18nProviderProps {
  children: React.ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [language, setLanguageState] = useState<SupportedLanguage>('nl');
  const [country, setCountryState] = useState<SupportedCountry | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Load persisted language + country on mount
  useEffect(() => {
    (async () => {
      try {
        const [storedLang, storedCountry] = await Promise.all([
          AsyncStorage.getItem(LANGUAGE_STORAGE_KEY),
          AsyncStorage.getItem(COUNTRY_STORAGE_KEY),
        ]);
        if (storedLang && (storedLang === 'nl' || storedLang === 'en' || storedLang === 'fr')) {
          setLanguageState(storedLang);
          setGlobalLanguage(storedLang);
        }
        if (storedCountry && ['NL', 'BE', 'FR', 'UK', 'US'].includes(storedCountry)) {
          setCountryState(storedCountry as SupportedCountry);
        }
      } catch (e) {
        // Silently fall back to defaults
      }
      setIsReady(true);
    })();
  }, []);

  const setLanguage = useCallback((lang: SupportedLanguage) => {
    setLanguageState(lang);
    setGlobalLanguage(lang);
    AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang).catch(() => {});
  }, []);

  const setCountry = useCallback((c: SupportedCountry) => {
    setCountryState(c);
    AsyncStorage.setItem(COUNTRY_STORAGE_KEY, c).catch(() => {});
  }, []);

  /**
   * Translation function.
   * - Looks up key in current language map
   * - Falls back to NL (primary language) if key not found in target language
   * - Falls back to key itself if not found anywhere
   * - Supports simple {param} interpolation
   */
  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const strings = LANGUAGE_MAP[language];
      let value = strings[key] ?? LANGUAGE_MAP.nl[key] ?? key;

      // Simple parameter interpolation: {paramName}
      if (params) {
        for (const [paramKey, paramValue] of Object.entries(params)) {
          value = value.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
        }
      }

      return value;
    },
    [language],
  );

  return (
    <I18nContext.Provider value={{ language, locale: language, country, setLanguage, setLocale: setLanguage, setCountry, t, isReady }}>
      {children}
    </I18nContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────
export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return ctx;
}

/**
 * Standalone t() for use outside React components (e.g., in utility functions).
 * Falls back to NL strings. Does NOT react to language changes.
 * Use only when React context is unavailable.
 */
let _currentLanguage: SupportedLanguage = 'nl';

export function setGlobalLanguage(lang: SupportedLanguage) {
  _currentLanguage = lang;
}

export function tStatic(key: string, params?: Record<string, string | number>): string {
  const strings = LANGUAGE_MAP[_currentLanguage];
  let value = strings[key] ?? LANGUAGE_MAP.nl[key] ?? key;

  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      value = value.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
    }
  }

  return value;
}
