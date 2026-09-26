import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { useLanguagePreference } from './usePreferences';
import { useAuth } from './useAuth';

/**
 * Language preference manager
 * Handles language switching and preference persistence
 * Primary: Supabase user_preferences
 * Fallback: localStorage for offline mode
 */
export function useLanguage() {
  const { i18n, t } = useTranslation();
  const { user } = useAuth();
  const { language: preferredLanguage, setLanguage } = useLanguagePreference();

  const changeLanguage = (language: string) => {
    i18n.changeLanguage(language);
    // Keep localStorage in sync as fallback
    localStorage.setItem('preferred_language', language);
    // Update Supabase preference if authenticated
    if (user?.id) {
      setLanguage(language);
    }
  };

  const getLanguage = () => i18n.language;

  const getPreferredLanguage = () => {
    // Try Supabase preference first (if authenticated)
    if (preferredLanguage) {
      return preferredLanguage;
    }
    // Fall back to localStorage
    return localStorage.getItem('preferred_language') || 'en';
  };

  // Sync language preference on mount
  useEffect(() => {
    const preferred = getPreferredLanguage();
    if (preferred && i18n.language !== preferred) {
      i18n.changeLanguage(preferred);
    }
  }, [preferredLanguage, i18n.language]);

  // Sync localStorage to Supabase on first login
  useEffect(() => {
    if (user?.id) {
      const localLang = localStorage.getItem('preferred_language');
      if (localLang && localLang !== preferredLanguage) {
        setLanguage(localLang);
      }
    }
  }, [user?.id, preferredLanguage, setLanguage]);

  const isRTL = () => {
    // Arabic, Hebrew, and other RTL languages
    return ['ar', 'he'].includes(i18n.language);
  };

  return {
    language: i18n.language,
    changeLanguage,
    getLanguage,
    getPreferredLanguage,
    isRTL,
    t, // Export translation function
    i18n,
  };
}

/**
 * Hook for locale-specific formatting
 */
export function useLocaleFormatting() {
  const { i18n } = useTranslation();

  const formatCurrency = (value: number, currency: string = 'INR'): string => {
    return new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value: number): string => {
    return new Intl.NumberFormat(i18n.language).format(value);
  };

  const formatDate = (date: Date | string, format: 'short' | 'medium' | 'long' = 'medium'): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const dateFormatOptions: Intl.DateTimeFormatOptions = {
      short: { year: '2-digit', month: '2-digit', day: '2-digit' },
      medium: { year: 'numeric', month: 'short', day: 'numeric' },
      long: { year: 'numeric', month: 'long', day: 'numeric' },
    };

    return dateObj.toLocaleDateString(i18n.language, dateFormatOptions[format]);
  };

  const formatDateTime = (
    date: Date | string,
    format: 'short' | 'medium' | 'long' = 'medium'
  ): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const dateFormatOptions: Intl.DateTimeFormatOptions = {
      short: {
        year: '2-digit',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      },
      medium: {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      },
      long: {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      },
    };

    return dateObj.toLocaleDateString(i18n.language, dateFormatOptions[format]);
  };

  return {
    formatCurrency,
    formatNumber,
    formatDate,
    formatDateTime,
  };
}
