import { describe, expect, it } from 'vitest';
import {
  buildNanoSystemPrompt,
  getNanoThemeVocabulary,
  resolveNanoModuleClient,
} from '@/lib/pipeline/nano-interpret-routing';

describe('client-side nano routing', () => {
  it('keeps Elias module resolution deterministic on the client', () => {
    expect(resolveNanoModuleClient(['craving'], 'elias')).toMatchObject({
      resolvedModule: 'E01', matchedTheme: 'craving', themes: ['craving'],
    });
    expect(resolveNanoModuleClient(['structural_loneliness'], 'elias').resolvedModule).toBe('M05');
  });

  it('keeps Kim module resolution persona-safe on the client', () => {
    expect(resolveNanoModuleClient(['broken_trust'], 'kim')).toMatchObject({
      resolvedModule: 'K04', matchedTheme: 'broken_trust',
    });
    expect(resolveNanoModuleClient(['craving'], 'kim').resolvedModule).toBeNull();
  });

  it('drops invented themes and builds a closed client vocabulary', () => {
    expect(resolveNanoModuleClient(['invented_theme'], 'elias').themes).toEqual([]);
    expect(getNanoThemeVocabulary('elias')).toContain('relapse_trigger');
    expect(getNanoThemeVocabulary('kim')).toContain('broken_trust');
    expect(buildNanoSystemPrompt('kim')).toContain('You do not make clinical decisions');
  });
});
