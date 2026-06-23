import { describe, it, expect } from 'vitest';
import { tStatic, setGlobalLanguage } from '@/lib/i18n/i18n-provider';

describe('tStatic emoji rendering', () => {
  it('returns actual emoji for vsp_section_editor.header.emoji in NL', () => {
    setGlobalLanguage('nl');
    const result = tStatic('vsp_section_editor.header.emoji');
    expect(result).toBe('🛡');
    expect(result).not.toContain('\\u');
    expect(result).not.toContain('u{');
  });

  it('returns actual emoji for vsp_section_editor.triggers.emoji', () => {
    setGlobalLanguage('nl');
    const result = tStatic('vsp_section_editor.triggers.emoji');
    expect(result).toBe('⚡');
  });

  it('returns actual emoji for vsp_section_editor.rules.emoji', () => {
    setGlobalLanguage('nl');
    const result = tStatic('vsp_section_editor.rules.emoji');
    expect(result).toBe('📋');
  });

  it('returns actual arrow for vsp_section_editor.rules.arrow_down', () => {
    setGlobalLanguage('nl');
    const result = tStatic('vsp_section_editor.rules.arrow_down');
    expect(result).toBe('▼');
  });

  it('returns actual emoji for zone_config.green.emoji', () => {
    setGlobalLanguage('nl');
    const result = tStatic('vsp_section_editor.zone_config.green.emoji');
    expect(result).toBe('🟢');
  });

  it('works in EN too', () => {
    setGlobalLanguage('en');
    const result = tStatic('vsp_section_editor.header.emoji');
    expect(result).toBe('🛡');
  });
});
