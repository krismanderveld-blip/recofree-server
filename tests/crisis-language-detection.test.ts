import { describe, it, expect } from 'vitest';
import { detectCrisisLanguage } from '../lib/crisis/resources';

describe('detectCrisisLanguage', () => {
  it('returns nl for empty string (default)', () => {
    expect(detectCrisisLanguage('')).toBe('nl');
  });

  it('returns nl for null/undefined (default)', () => {
    expect(detectCrisisLanguage(null)).toBe('nl');
    expect(detectCrisisLanguage(undefined)).toBe('nl');
  });

  it('returns nl for single Dutch word', () => {
    // Single word won't hit threshold of 2 markers, but ratio > 20% (1/1 = 100%)
    expect(detectCrisisLanguage('hulp')).toBe('nl');
  });

  it('returns en for short English message', () => {
    expect(detectCrisisLanguage('I feel terrible today')).toBe('en');
  });

  it('returns nl for short Dutch message', () => {
    expect(detectCrisisLanguage('ik voel me niet goed')).toBe('nl');
  });

  it('returns nl for mixed NL/EN with Dutch majority', () => {
    expect(detectCrisisLanguage('ik heb een relapse gehad en ik wil niet meer')).toBe('nl');
  });

  it('returns en for mixed NL/EN with English majority', () => {
    expect(detectCrisisLanguage('I had a relapse and I feel so bad about it')).toBe('en');
  });

  it('returns nl for crisis-related Dutch text', () => {
    expect(detectCrisisLanguage('ik wil dood ik kan niet meer')).toBe('nl');
  });

  it('returns en for whitespace-only input (default)', () => {
    expect(detectCrisisLanguage('   ')).toBe('nl');
  });
});
