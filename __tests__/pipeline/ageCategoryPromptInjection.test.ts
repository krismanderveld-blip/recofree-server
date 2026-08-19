/**
 * FASE 3: ageCategory prompt injection tests.
 * Verifies:
 * - resolveAgeCategory returns correct categories
 * - buildAgeCategoryPromptBlock produces correct prompt block
 * - raw birthDate never appears in prompt
 * - unknown_adult is safe default
 * - Kim/Elias both receive ageCategory
 */
import { describe, it, expect } from 'vitest';
import { buildClientSystemPrompt } from '@/lib/ai/prompt/client-system-prompt-builder';
import {
  resolveAgeCategory,
  buildAgeCategoryPromptBlock,
} from '../../lib/engine/shared/age-category-foundation';

describe('FASE 3: ageCategory prompt injection', () => {
  it('resolves adult_18_24 for age 22', () => {
    const persons = [{ name: 'User', age: '22' }];
    expect(resolveAgeCategory(persons, 'User')).toBe('adult_18_24');
  });

  it('resolves adult_25_39 for age 35', () => {
    const persons = [{ name: 'User', age: '35' }];
    expect(resolveAgeCategory(persons, 'User')).toBe('adult_25_39');
  });

  it('resolves adult_40_plus for age 45', () => {
    const persons = [{ name: 'User', age: '45' }];
    expect(resolveAgeCategory(persons, 'User')).toBe('adult_40_plus');
  });

  it('returns unknown_adult when no persons', () => {
    expect(resolveAgeCategory(undefined, 'User')).toBe('unknown_adult');
    expect(resolveAgeCategory([], 'User')).toBe('unknown_adult');
  });

  it('returns unknown_adult when user not found in persons', () => {
    const persons = [{ name: 'Jules', age: '5' }];
    expect(resolveAgeCategory(persons, 'User')).toBe('unknown_adult');
  });

  it('returns unknown_adult for age < 18', () => {
    const persons = [{ name: 'User', age: '16' }];
    expect(resolveAgeCategory(persons, 'User')).toBe('unknown_adult');
  });

  it('returns unknown_adult for non-numeric age', () => {
    const persons = [{ name: 'User', age: 'onbekend' }];
    expect(resolveAgeCategory(persons, 'User')).toBe('unknown_adult');
  });

  it('returns unknown_adult when userName is undefined', () => {
    expect(resolveAgeCategory([{ name: 'User', age: '30' }], undefined)).toBe('unknown_adult');
  });

  it('buildAgeCategoryPromptBlock produces correct format', () => {
    const block = buildAgeCategoryPromptBlock('adult_25_39');
    expect(block).toContain('[AGE / COMMUNICATION CONTEXT]');
    expect(block).toContain('ageCategory: adult_25_39');
    expect(block).toContain('Normal adult recovery');
    expect(block).toContain('Do not stereotype');
  });

  it('raw birthDate never appears in prompt block', () => {
    const block = buildAgeCategoryPromptBlock('adult_40_plus');
    expect(block).not.toContain('birthDate');
    expect(block).not.toContain('geboortedatum');
    expect(block).not.toContain('1980');
    expect(block).not.toContain('dateOfBirth');
  });

  it('unknown_adult does not crash and produces safe block', () => {
    const block = buildAgeCategoryPromptBlock('unknown_adult');
    expect(block).toContain('ageCategory: unknown_adult');
    expect(block).toContain('Safe adult default');
  });

  it('ageCategory is not used as hard template', () => {
    const block = buildAgeCategoryPromptBlock('adult_18_24');
    expect(block).toContain('communication-depth signal');
    expect(block).not.toContain('MUST');
    expect(block).not.toContain('ALWAYS');
  });

  it('Elias follow-up prompt contains ageCategory via buildClientSystemPrompt', () => {

    const result = buildClientSystemPrompt({
      persona: 'elias',
      crisisLevel: 0,
      safetyLevel: 'none',
      ageCategory: 'adult_25_39',
    });
    expect(result.systemPrompt).toContain('[AGE / COMMUNICATION CONTEXT]');
    expect(result.systemPrompt).toContain('ageCategory: adult_25_39');
  });

  it('Kim follow-up prompt contains ageCategory via buildClientSystemPrompt', () => {

    const result = buildClientSystemPrompt({
      persona: 'kim',
      crisisLevel: 0,
      safetyLevel: 'none',
      ageCategory: 'adult_40_plus',
    });
    expect(result.systemPrompt).toContain('[AGE / COMMUNICATION CONTEXT]');
    expect(result.systemPrompt).toContain('ageCategory: adult_40_plus');
  });

  it('prompt without ageCategory does not contain age block', () => {

    const result = buildClientSystemPrompt({
      persona: 'elias',
      crisisLevel: 0,
      safetyLevel: 'none',
    });
    expect(result.systemPrompt).not.toContain('[AGE / COMMUNICATION CONTEXT]');
  });
});
