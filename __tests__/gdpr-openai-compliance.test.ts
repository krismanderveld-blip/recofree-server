/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RECOFREE — OPENAI API GDPR COMPLIANCE TESTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * These tests verify that the RecoFree OpenAI integration complies with:
 * - GDPR data minimization requirements
 * - OpenAI DPA (store: false)
 * - Architecture rule: OpenAI = language rendering only
 * - No hosted tools, web search, file search, image generation, or MCP
 * - Local post-check blocks unsafe responses
 *
 * @module gdpr-openai-compliance.test
 */

import { describe, it, expect } from 'vitest';

import {
  OPENAI_API_STORE,
  OPENAI_API_ROLE,
  OPENAI_ALLOW_THERAPEUTIC_DECISIONING,
  OPENAI_ALLOW_RISK_CLASSIFICATION,
  OPENAI_ALLOW_MODULE_ROUTING,
  OPENAI_ALLOW_LONG_TERM_MEMORY,
  OPENAI_ALLOW_USER_PROFILE_STORAGE,
  OPENAI_ALLOW_RAW_JOURNAL_UPLOAD,
  OPENAI_ALLOW_RAW_RUGZAK_UPLOAD,
  OPENAI_ALLOW_HOSTED_TOOLS,
  OPENAI_ALLOW_WEB_SEARCH,
  OPENAI_ALLOW_FILE_SEARCH,
  OPENAI_ALLOW_IMAGE_GENERATION,
  OPENAI_ALLOW_MCP_TOOLS,
  LANGUAGE_RENDERING_SYSTEM_PREFIX,
  GDPR_DPA_SIGNED,
  GDPR_COMPLIANCE_VERSION,
} from '../lib/ai/gdpr-config';

import {
  minimizeBackpack,
  minimizeUserDat,
  minimizeDiaryEntries,
  validatePayloadMinimization,
} from '../lib/ai/prompt-minimizer';

import {
  runPostCheck,
  getFallbackResponse,
  applyPostCheck,
} from '../lib/ai/response-post-check';

// ═══════════════════════════════════════════════════════════════════════════
// TEST 1: store: false is always set
// ═══════════════════════════════════════════════════════════════════════════

describe('GDPR OpenAI Compliance', () => {
  it('test_store_false_is_always_set', () => {
    expect(OPENAI_API_STORE).toBe(false);
    // The constant must be explicitly false, not undefined/null/0
    expect(typeof OPENAI_API_STORE).toBe('boolean');
    expect(OPENAI_API_STORE).toStrictEqual(false);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // TEST 2: No hosted tools enabled
  // ═══════════════════════════════════════════════════════════════════════

  it('test_no_hosted_tools_enabled', () => {
    expect(OPENAI_ALLOW_HOSTED_TOOLS).toBe(false);
    // Verify all sub-tools are also disabled
    expect(OPENAI_ALLOW_WEB_SEARCH).toBe(false);
    expect(OPENAI_ALLOW_FILE_SEARCH).toBe(false);
    expect(OPENAI_ALLOW_IMAGE_GENERATION).toBe(false);
    expect(OPENAI_ALLOW_MCP_TOOLS).toBe(false);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // TEST 3: Web search disabled
  // ═══════════════════════════════════════════════════════════════════════

  it('test_web_search_disabled', () => {
    expect(OPENAI_ALLOW_WEB_SEARCH).toBe(false);
    // Ensure the constant type is boolean (not truthy/falsy)
    expect(typeof OPENAI_ALLOW_WEB_SEARCH).toBe('boolean');
  });

  // ═══════════════════════════════════════════════════════════════════════
  // TEST 4: File search disabled
  // ═══════════════════════════════════════════════════════════════════════

  it('test_file_search_disabled', () => {
    expect(OPENAI_ALLOW_FILE_SEARCH).toBe(false);
    expect(typeof OPENAI_ALLOW_FILE_SEARCH).toBe('boolean');
  });

  // ═══════════════════════════════════════════════════════════════════════
  // TEST 5: Image generation disabled
  // ═══════════════════════════════════════════════════════════════════════

  it('test_image_generation_disabled', () => {
    expect(OPENAI_ALLOW_IMAGE_GENERATION).toBe(false);
    expect(typeof OPENAI_ALLOW_IMAGE_GENERATION).toBe('boolean');
  });

  // ═══════════════════════════════════════════════════════════════════════
  // TEST 6: MCP tools disabled
  // ═══════════════════════════════════════════════════════════════════════

  it('test_mcp_tools_disabled', () => {
    expect(OPENAI_ALLOW_MCP_TOOLS).toBe(false);
    expect(typeof OPENAI_ALLOW_MCP_TOOLS).toBe('boolean');
  });

  // ═══════════════════════════════════════════════════════════════════════
  // TEST 7: Raw journal rejected
  // ═══════════════════════════════════════════════════════════════════════

  it('test_raw_journal_rejected', () => {
    // GDPR constant must forbid raw journal upload
    expect(OPENAI_ALLOW_RAW_JOURNAL_UPLOAD).toBe(false);

    // Payload validation must reject diary entries with full content
    const payload = {
      diaryEntries: [
        { content: 'A'.repeat(200) }, // Over 100 chars = raw upload
        { content: 'B'.repeat(300) },
      ],
    };
    const result = validatePayloadMinimization(payload);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.includes('full_journal_history'))).toBe(true);

    // Minimized entries must be under 100 chars
    const minimized = minimizeDiaryEntries([
      { date: '2026-06-01', moodTag: 'sad', content: 'A very long journal entry that goes on and on about personal feelings and experiences that should never be sent in full to OpenAI because it contains sensitive therapeutic data' },
    ]);
    expect(minimized[0].preview.length).toBeLessThanOrEqual(100);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // TEST 8: Raw rugzak rejected
  // ═══════════════════════════════════════════════════════════════════════

  it('test_raw_rugzak_rejected', () => {
    // GDPR constant must forbid raw rugzak upload
    expect(OPENAI_ALLOW_RAW_RUGZAK_UPLOAD).toBe(false);

    // Payload validation must reject backpack with large sections
    const payload = {
      backpack: {
        sections: [
          { content: 'A'.repeat(600) },
          { content: 'B'.repeat(500) },
        ],
      },
    };
    const result = validatePayloadMinimization(payload);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.includes('full_rugzak_life_story'))).toBe(true);

    // Minimized backpack must not contain full sections
    const minimized = minimizeBackpack({
      name: 'TestUser',
      userType: 'elias',
      intakeContext: 'A'.repeat(800),
      sections: [
        { title: 'Life Story', content: 'A'.repeat(2000) },
      ],
    } as any);
    expect(minimized).not.toBeNull();
    expect(minimized!.contextSummary.length).toBeLessThanOrEqual(500);
    expect(minimized!.activeTriggers.length).toBeLessThanOrEqual(5);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // TEST 9: OpenAI cannot choose module
  // ═══════════════════════════════════════════════════════════════════════

  it('test_openai_cannot_choose_module', () => {
    // Architecture constant must forbid module routing
    expect(OPENAI_ALLOW_MODULE_ROUTING).toBe(false);

    // Post-check must reject responses that attempt module routing
    const responseWithRouting = "Based on my assessment, I'll switch you to module KST01 for better support.";
    const result = runPostCheck(responseWithRouting);
    expect(result.passed).toBe(false);
    expect(result.violations).toContain('contradicted_engine_output');

    // System prompt must explicitly forbid module choice
    expect(LANGUAGE_RENDERING_SYSTEM_PREFIX).toContain('Do not choose modules');
  });

  // ═══════════════════════════════════════════════════════════════════════
  // TEST 10: OpenAI cannot set risk level
  // ═══════════════════════════════════════════════════════════════════════

  it('test_openai_cannot_set_risk_level', () => {
    // Architecture constant must forbid risk classification
    expect(OPENAI_ALLOW_RISK_CLASSIFICATION).toBe(false);

    // System prompt must explicitly forbid risk classification
    expect(LANGUAGE_RENDERING_SYSTEM_PREFIX).toContain('Do not classify risk');

    // Architecture role must be language_rendering_only
    expect(OPENAI_API_ROLE).toBe('language_rendering_only');

    // Therapeutic decisioning must be forbidden
    expect(OPENAI_ALLOW_THERAPEUTIC_DECISIONING).toBe(false);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // TEST 11: OpenAI cannot add diagnosis
  // ═══════════════════════════════════════════════════════════════════════

  it('test_openai_cannot_add_diagnosis', () => {
    // System prompt must forbid diagnosis
    expect(LANGUAGE_RENDERING_SYSTEM_PREFIX).toContain('Do not diagnose');

    // Post-check must reject responses with diagnosis
    const diagnosisResponse = "Based on what you've shared, you have borderline personality disorder.";
    const result = runPostCheck(diagnosisResponse);
    expect(result.passed).toBe(false);
    expect(result.violations).toContain('added_diagnosis');

    // Dutch diagnosis must also be caught
    const dutchDiagnosis = "Je lijdt aan een depressieve stoornis volgens DSM-5.";
    const resultNL = runPostCheck(dutchDiagnosis);
    expect(resultNL.passed).toBe(false);
    expect(resultNL.violations).toContain('added_diagnosis');
  });

  // ═══════════════════════════════════════════════════════════════════════
  // TEST 12: Post-check blocks added advice
  // ═══════════════════════════════════════════════════════════════════════

  it('test_openai_output_postcheck_blocks_added_advice', () => {
    // Post-check must reject medical advice
    const medicalAdvice = "You should take medication for your condition. Studies show SSRIs are effective.";
    const result = runPostCheck(medicalAdvice);
    expect(result.passed).toBe(false);
    expect(result.violations).toContain('invented_medical_claims');

    // Post-check must reject risk minimization
    const minimizingResponse = "It's not that bad, everyone feels this way sometimes. Just think positive!";
    const resultMinimize = runPostCheck(minimizingResponse);
    expect(resultMinimize.passed).toBe(false);
    expect(resultMinimize.violations).toContain('minimized_risk');

    // Post-check must reject unauthorized escalation (when not crisis-authorized)
    const escalation = "You need to call 911 immediately and go to the ER.";
    const resultEscalation = runPostCheck(escalation, false);
    expect(resultEscalation.passed).toBe(false);
    expect(resultEscalation.violations).toContain('unauthorized_escalation');

    // Same escalation should PASS when crisis IS authorized
    const resultAuthorized = runPostCheck(escalation, true);
    expect(resultAuthorized.violations).not.toContain('unauthorized_escalation');

    // Safe response must pass
    const safeResponse = "Ik ben hier. Ik hoor wat je zegt. Wil je me vertellen hoe je je nu voelt?";
    const resultSafe = runPostCheck(safeResponse);
    expect(resultSafe.passed).toBe(true);
    expect(resultSafe.violations).toHaveLength(0);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // TEST 13: Fallback used when post-check fails
  // ═══════════════════════════════════════════════════════════════════════

  it('test_fallback_used_when_postcheck_fails', () => {
    // When post-check fails, applyPostCheck must return a fallback
    const unsafeResponse = "Je hebt borderline persoonlijkheid. Neem medicatie en stop je medicatie niet.";
    const result = applyPostCheck(unsafeResponse, 'elias', false, 0);

    // Must not return the unsafe response
    expect(result.text).not.toBe(unsafeResponse);
    expect(result.postCheckPassed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);

    // Must return a valid fallback
    expect(result.text.length).toBeGreaterThan(10);
    expect(result.text).not.toContain('borderline');
    expect(result.text).not.toContain('medicatie');

    // Fallback for Kim must also work
    const kimResult = applyPostCheck(unsafeResponse, 'kim', false, 0);
    expect(kimResult.postCheckPassed).toBe(false);
    expect(kimResult.text.length).toBeGreaterThan(10);

    // Safe response must pass through unchanged
    const safeResponse = "Ik ben hier voor je. Wat heb je nu nodig?";
    const safeResult = applyPostCheck(safeResponse, 'elias', false, 0);
    expect(safeResult.text).toBe(safeResponse);
    expect(safeResult.postCheckPassed).toBe(true);
    expect(safeResult.violations).toHaveLength(0);

    // Verify fallback responses exist for both personas
    const eliasFallback = getFallbackResponse('elias', 0);
    const kimFallback = getFallbackResponse('kim', 0);
    expect(eliasFallback.length).toBeGreaterThan(10);
    expect(kimFallback.length).toBeGreaterThan(10);
    expect(eliasFallback).not.toBe(kimFallback); // Different personas, different fallbacks
  });

  // ═══════════════════════════════════════════════════════════════════════
  // ADDITIONAL: DPA and compliance metadata
  // ═══════════════════════════════════════════════════════════════════════

  it('gdpr_dpa_and_compliance_metadata_present', () => {
    expect(GDPR_DPA_SIGNED).toBe(true);
    expect(GDPR_COMPLIANCE_VERSION).toBe('1.0.0');
    expect(OPENAI_ALLOW_LONG_TERM_MEMORY).toBe(false);
    expect(OPENAI_ALLOW_USER_PROFILE_STORAGE).toBe(false);
  });
});
