/**
 * i18n Completeness Test
 *
 * Ensures all three locale files (nl, fr, en) have the same set of keys.
 * When a new key is added to one locale, this test will fail until
 * the key is added to all other locales.
 */
import { describe, it, expect } from 'vitest';
import nl from '../lib/i18n/locales/nl.json';
import fr from '../lib/i18n/locales/fr.json';
import en from '../lib/i18n/locales/en.json';

describe('i18n completeness', () => {
  const nlKeys = Object.keys(nl).sort();
  const frKeys = Object.keys(fr).sort();
  const enKeys = Object.keys(en).sort();

  it('all locales have the same number of keys', () => {
    expect(frKeys.length).toBe(nlKeys.length);
    expect(enKeys.length).toBe(nlKeys.length);
  });

  it('fr.json has all keys from nl.json', () => {
    const missingInFr = nlKeys.filter((k) => !frKeys.includes(k));
    expect(missingInFr).toEqual([]);
  });

  it('en.json has all keys from nl.json', () => {
    const missingInEn = nlKeys.filter((k) => !enKeys.includes(k));
    expect(missingInEn).toEqual([]);
  });

  it('nl.json has all keys from fr.json (no orphan fr keys)', () => {
    const orphanFr = frKeys.filter((k) => !nlKeys.includes(k));
    expect(orphanFr).toEqual([]);
  });

  it('nl.json has all keys from en.json (no orphan en keys)', () => {
    const orphanEn = enKeys.filter((k) => !nlKeys.includes(k));
    expect(orphanEn).toEqual([]);
  });

  it('no empty string values in nl.json', () => {
    const flat = nl as unknown as Record<string, unknown>;
    const emptyNl = nlKeys.filter((k) => flat[k] === '');
    expect(emptyNl).toEqual([]);
  });

  it('no empty string values in fr.json', () => {
    const flat = fr as unknown as Record<string, unknown>;
    const emptyFr = frKeys.filter((k) => flat[k] === '');
    expect(emptyFr).toEqual([]);
  });

  it('no empty string values in en.json', () => {
    const flat = en as unknown as Record<string, unknown>;
    const emptyEn = enKeys.filter((k) => flat[k] === '');
    expect(emptyEn).toEqual([]);
  });
});
