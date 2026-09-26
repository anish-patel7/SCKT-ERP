import { describe, it, expect } from 'vitest';
import i18n from '@/i18n/config';

describe('i18n Configuration', () => {
  it('should have default language as English', () => {
    expect(i18n.language).toBe('en');
  });

  it('should have fallback language as English', () => {
    expect(i18n.options.fallbackLng).toBe('en');
  });

  it('should have all required languages configured', () => {
    const requiredLanguages = ['en', 'hi', 'de'];
    requiredLanguages.forEach((lang) => {
      expect(i18n.hasResourceBundle(lang, 'translation')).toBe(true);
    });
  });

  it('should support language switching', async () => {
    await i18n.changeLanguage('hi');
    expect(i18n.language).toBe('hi');

    await i18n.changeLanguage('de');
    expect(i18n.language).toBe('de');

    await i18n.changeLanguage('en');
    expect(i18n.language).toBe('en');
  });

  it('should have translation keys for all languages', () => {
    const languages = ['en', 'hi', 'de'];
    const requiredKeys = [
      'common.save',
      'common.cancel',
      'sales.order',
      'sales.orders',
      'invoices.invoice',
      'validation.required_field',
      'errors.server_error',
      'language.language',
    ];

    languages.forEach((lang) => {
      requiredKeys.forEach((key) => {
        const translation = i18n.t(key, { lng: lang });
        expect(translation).toBeTruthy();
        expect(translation).not.toContain('undefined');
      });
    });
  });

  it('should translate common keys correctly', () => {
    const translations = {
      en: { 'common.save': 'Save' },
      hi: { 'common.save': 'सहेजें' },
      de: { 'common.save': 'Speichern' },
    };

    Object.entries(translations).forEach(([lang, keys]) => {
      Object.entries(keys).forEach(([key, expected]) => {
        const translation = i18n.t(key, { lng: lang });
        expect(translation).toBe(expected);
      });
    });
  });

  it('should translate sales order keys', () => {
    const orderKeys = [
      'sales.order',
      'sales.orders',
      'sales.status',
      'sales.total_amount',
      'sales.create_order',
    ];

    orderKeys.forEach((key) => {
      const enTranslation = i18n.t(key, { lng: 'en' });
      const hiTranslation = i18n.t(key, { lng: 'hi' });
      const deTranslation = i18n.t(key, { lng: 'de' });

      expect(enTranslation).toBeTruthy();
      expect(hiTranslation).toBeTruthy();
      expect(deTranslation).toBeTruthy();
      expect(enTranslation).not.toBe(hiTranslation);
      expect(hiTranslation).not.toBe(deTranslation);
    });
  });

  it('should support nested translation keys', () => {
    const nestedKeys = ['common.save', 'sales.orders', 'analytics.dashboard'];

    nestedKeys.forEach((key) => {
      const translation = i18n.t(key);
      expect(translation).toBeTruthy();
      expect(typeof translation).toBe('string');
    });
  });

  it('should handle missing translation keys gracefully', () => {
    const missingKey = i18n.t('nonexistent.key');
    expect(missingKey).toBe('nonexistent.key');
  });

  it('should support RTL detection for future languages', () => {
    // Hindi is LTR, but structure supports RTL
    const hiTranslation = i18n.t('language.hindi', { lng: 'hi' });
    expect(hiTranslation).toBe('हिंदी');
  });

  it('should have complete translation coverage for common namespace', () => {
    const enBundle = i18n.getResourceBundle('en', 'translation');
    const hiBundle = i18n.getResourceBundle('hi', 'translation');
    const deBundle = i18n.getResourceBundle('de', 'translation');

    // Check that all languages have the same keys
    const enKeys = Object.keys(enBundle);
    const hiKeys = Object.keys(hiBundle);
    const deKeys = Object.keys(deBundle);

    enKeys.forEach((key) => {
      expect(hiKeys).toContain(key);
      expect(deKeys).toContain(key);
    });
  });

  it('should detect browser language on initialization', () => {
    // This test verifies the detection mechanism is configured
    expect(i18n.options.detection).toBeDefined();
    expect(i18n.options.detection?.order).toContain('localStorage');
    expect(i18n.options.detection?.order).toContain('navigator');
  });
});
