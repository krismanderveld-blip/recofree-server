import { describe, expect, it } from 'vitest';
import { buildCrisisResourceUrl } from '@/lib/crisis/resource-link';

describe('crisis resource links', () => {
  it('opens UK SHOUT as an Android SMS draft addressed to 85258', () => {
    expect(buildCrisisResourceUrl('SHOUT to 85258', true, 'android')).toBe(
      'sms:85258?body=SHOUT',
    );
  });

  it('uses the iOS SMS body separator', () => {
    expect(buildCrisisResourceUrl('SHOUT to 85258', true, 'ios')).toBe(
      'sms:85258&body=SHOUT',
    );
  });

  it('preserves website and telephone behavior', () => {
    expect(buildCrisisResourceUrl('988lifeline.org', true, 'android')).toBe(
      'https://988lifeline.org',
    );
    expect(buildCrisisResourceUrl('0800-0113', false, 'android')).toBe('tel:08000113');
  });
});
