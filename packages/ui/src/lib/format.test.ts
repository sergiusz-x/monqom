import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatNumber,
  getLocale,
  getTimezone,
} from './format';
import * as formatModule from './format';

describe('format.ts', () => {
  beforeEach(() => {
    // Reset workspace settings
    // @ts-ignore
    delete window.__WORKSPACE_SETTINGS__;
    // Reset document language
    if (document.documentElement) {
      document.documentElement.lang = '';
    }
    // Reset navigator language
    Object.defineProperty(navigator, 'language', {
      value: undefined,
      configurable: true,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getLocale', () => {
    test('returns navigator.language when no workspace settings', () => {
      // @ts-ignore
      delete window.__WORKSPACE_SETTINGS__;
      document.documentElement.lang = '';
      Object.defineProperty(navigator, 'language', {
        value: 'fr-FR',
        configurable: true,
      });
      expect(getLocale()).toBe('fr-FR');
    });

    test('returns document.documentElement.lang when available', () => {
      // @ts-ignore
      delete window.__WORKSPACE_SETTINGS__;
      document.documentElement.lang = 'de-DE';
      Object.defineProperty(navigator, 'language', {
        value: 'fr-FR',
        configurable: true,
      });
      expect(getLocale()).toBe('de-DE');
    });

    test('returns workspace settings locale when available', () => {
      // @ts-ignore
      window.__WORKSPACE_SETTINGS__ = { locale: 'es-ES' };
      document.documentElement.lang = 'de-DE';
      Object.defineProperty(navigator, 'language', {
        value: 'fr-FR',
        configurable: true,
      });
      expect(getLocale()).toBe('es-ES');
    });

    test('falls back to en-US', () => {
      // @ts-ignore
      delete window.__WORKSPACE_SETTINGS__;
      document.documentElement.lang = '';
      Object.defineProperty(navigator, 'language', {
        value: undefined,
        configurable: true,
      });
      expect(getLocale()).toBe('en-US');
    });
  });

  describe('getTimezone', () => {
    test('returns workspace timezone when available', () => {
      // @ts-ignore
      window.__WORKSPACE_SETTINGS__ = { timezone: 'Asia/Tokyo' };
      expect(getTimezone()).toBe('Asia/Tokyo');
    });

    test('falls back to Intl.DateTimeFormat resolved timezone', () => {
      // @ts-ignore
      delete window.__WORKSPACE_SETTINGS__;
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      expect(getTimezone()).toBe(detected);
    });
  });

  describe('formatCurrency', () => {
    test('formats USD correctly for en-US', () => {
      expect(formatCurrency(1234.5, 'USD', 'en-US')).toBe('$1,234.50');
    });

    test('formats EUR correctly for de-DE', () => {
      expect(formatCurrency(1234.5, 'EUR', 'de-DE')).toBe('1.234,50 €');
    });

    test('uses getLocale when locale not provided', () => {
      const getLocaleMock = vi
        .spyOn(formatModule, 'getLocale')
        .mockReturnValue('ja-JP');
      expect(formatCurrency(1234.5, 'JPY')).toBe('¥1,235');
      getLocaleMock.mockRestore();
    });
  });

  describe('formatNumber', () => {
    test('formats with thousands separator for en-US', () => {
      expect(
        formatNumber(12345.67, { minimumFractionDigits: 2, maximumFractionDigits: 2 }, 'en-US')
      ).toBe('12,345.67');
    });

    test('formats with no decimal places', () => {
      expect(
        formatNumber(12345, { minimumFractionDigits: 0, maximumFractionDigits: 0 }, 'en-US')
      ).toBe('12,345');
    });
  });

  describe('formatDate', () => {
    test('formats date with options for en-US', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      expect(
        formatDate(date, { year: 'numeric', month: 'long', day: 'numeric' }, 'en-US')
      ).toBe('January 15, 2024');
    });

    test('uses workspace timezone when not overridden', () => {
      // @ts-ignore
      window.__WORKSPACE_SETTINGS__ = { timezone: 'UTC' };
      const date = new Date('2024-01-15T10:30:00Z'); // 10:30 UTC
      expect(
        formatDate(date, { day: '2-digit', month: '2-digit', year: 'numeric' }, 'en-US')
      ).toBe('01/15/2024');
    });

    test('allows overriding timezone in options', () => {
      // @ts-ignore
      window.__WORKSPACE_SETTINGS__ = { timezone: 'UTC' };
      const date = new Date('2024-01-15T10:30:00Z');
      const options = {
        timeZone: 'Asia/Tokyo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      };
      expect(formatDate(date, options, 'en-US')).toBe('01/15/2024');
    });
  });
});
