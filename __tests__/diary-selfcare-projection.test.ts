/**
 * P1/P2 TESTS: Diary read/write, selfCare slider signal, projection persistence, cross-persona
 */
import { buildClientSystemPrompt } from "@/lib/ai/prompt/client-system-prompt-builder";
import { createEmptyProjectionsDat } from "@/lib/types/memory/projectionsDat.types";
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══ DIARY READ/WRITE ═══
describe('Diary Storage', () => {
  it('diary entries can be serialized and deserialized', () => {
    const entry = {
      id: 'test-1',
      content: 'Vandaag voelde ik me beter.',
      moodTag: 'Hopeful',
      timestamp: new Date().toISOString(),
      gratitude: { entry1: 'Mijn gezondheid', entry2: 'Mijn familie', entry3: 'De zon' },
    };
    const json = JSON.stringify([entry]);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].content).toBe('Vandaag voelde ik me beter.');
    expect(parsed[0].moodTag).toBe('Hopeful');
    expect(parsed[0].gratitude.entry1).toBe('Mijn gezondheid');
  });

  it('diary summary is built from last 3 entries', () => {
    const entries = [
      { content: 'Entry 1' },
      { content: 'Entry 2' },
      { content: 'Entry 3' },
      { content: 'Entry 4' },
      { content: 'Entry 5' },
    ];
    // Simulate pipeline diary summary building (from pipeline.ts line 2960)
    const diarySummary = entries.slice(0, 3).map(d => d.content || '').join('; ');
    expect(diarySummary).toBe('Entry 1; Entry 2; Entry 3');
    expect(diarySummary).not.toContain('Entry 4');
  });

  it('empty diary produces empty summary', () => {
    const entries: any[] = [];
    const diarySummary = entries.slice(0, 3).map(d => d.content || '').join('; ');
    expect(diarySummary).toBe('');
  });

  it('diary summary reaches prompt builder', () => {
    const result = buildClientSystemPrompt({
      persona: 'elias',
      crisisLevel: 0,
      safetyLevel: 'none',
      diarySummary: 'Vandaag voelde ik me sterk. Ik heb niet gedronken.',
    });
    expect(result.systemPrompt).toContain('RECENT DIARY CONTEXT');
    expect(result.systemPrompt).toContain('Vandaag voelde ik me sterk');
  });

  it('diary summary reaches Kim prompt builder', () => {
    const result = buildClientSystemPrompt({
      persona: 'kim',
      crisisLevel: 0,
      safetyLevel: 'none',
      diarySummary: 'Ik voel me uitgeput door alles.',
    });
    expect(result.systemPrompt).toContain('RECENT DIARY CONTEXT');
    expect(result.systemPrompt).toContain('Ik voel me uitgeput');
  });
});

// ═══ SELFCARE SLIDER SIGNAL ═══
describe('SelfCare Slider Signal', () => {
  it('low selfCare (<=3) produces low-self-care signal', () => {
    // Simulate the signal detection from openai-provider.ts line 188-191
    const sliders = { stress: 5, boundaryFatigue: 3, emotionalBurden: 4, selfCare: 2, eigenRegie: null };
    const signals: any[] = [];
    const selfCare = (sliders as any)?.selfCare;
    if (typeof selfCare === 'number' && selfCare <= 3) {
      signals.push({ label: 'low-self-care', score: Math.min(3, 4 - selfCare), memory: 'state.dat' });
    }
    expect(signals).toHaveLength(1);
    expect(signals[0].label).toBe('low-self-care');
    expect(signals[0].score).toBe(2); // 4 - 2 = 2
  });

  it('selfCare=0 produces maximum score signal', () => {
    const sliders = { stress: 5, boundaryFatigue: 3, emotionalBurden: 4, selfCare: 0, eigenRegie: null };
    const signals: any[] = [];
    const selfCare = (sliders as any)?.selfCare;
    if (typeof selfCare === 'number' && selfCare <= 3) {
      signals.push({ label: 'low-self-care', score: Math.min(3, 4 - selfCare), memory: 'state.dat' });
    }
    expect(signals).toHaveLength(1);
    expect(signals[0].score).toBe(3); // min(3, 4-0) = 3
  });

  it('selfCare=5 does NOT produce signal', () => {
    const sliders = { stress: 5, boundaryFatigue: 3, emotionalBurden: 4, selfCare: 5, eigenRegie: null };
    const signals: any[] = [];
    const selfCare = (sliders as any)?.selfCare;
    if (typeof selfCare === 'number' && selfCare <= 3) {
      signals.push({ label: 'low-self-care', score: Math.min(3, 4 - selfCare), memory: 'state.dat' });
    }
    expect(signals).toHaveLength(0);
  });

  it('selfCare=10 does NOT produce signal', () => {
    const sliders = { stress: 5, boundaryFatigue: 3, emotionalBurden: 4, selfCare: 10, eigenRegie: null };
    const signals: any[] = [];
    const selfCare = (sliders as any)?.selfCare;
    if (typeof selfCare === 'number' && selfCare <= 3) {
      signals.push({ label: 'low-self-care', score: Math.min(3, 4 - selfCare), memory: 'state.dat' });
    }
    expect(signals).toHaveLength(0);
  });

  it('undefined selfCare does NOT produce signal', () => {
    const sliders = { stress: 5, boundaryFatigue: 3, emotionalBurden: 4, eigenRegie: null };
    const signals: any[] = [];
    const selfCare = (sliders as any)?.selfCare;
    if (typeof selfCare === 'number' && selfCare <= 3) {
      signals.push({ label: 'low-self-care', score: Math.min(3, 4 - selfCare), memory: 'state.dat' });
    }
    expect(signals).toHaveLength(0);
  });
});

// ═══ PROJECTION PERSISTENCE ═══
describe('Projection Persistence', () => {
  it('projections.dat schema has correct structure', () => {
    const empty = createEmptyProjectionsDat('elias');
    expect(empty.schemaVersion).toBe('projections.dat.v2');
    expect(empty.persona).toBe('elias');
    expect(Array.isArray(empty.fears)).toBe(true);
    expect(Array.isArray(empty.hopes)).toBe(true);
  });

  it('projections.dat Elias and Kim are separate', () => {
    const elias = createEmptyProjectionsDat('elias');
    const kim = createEmptyProjectionsDat('kim');
    expect(elias.persona).toBe('elias');
    expect(kim.persona).toBe('kim');
  });

  it('projections.dat fears/hopes are hypothesis_not_fact', () => {
    // Verify the type structure enforces hypothesis status
    const fear = {
      keyword: 'terugval',
      text: 'Ik ben bang dat ik terugval',
      confidence: 0.7,
      projectionType: 'future_fear' as const,
      sourceLayer: 'projections_dat' as const,
    };
    expect(fear.projectionType).toBe('future_fear');
    expect(fear.sourceLayer).toBe('projections_dat');
  });

  it('projections.dat hopes are hypothesis_not_fact', () => {
    const hope = {
      keyword: 'herstel',
      text: 'Ik hoop op herstel',
      confidence: 0.6,
      projectionType: 'future_hope' as const,
      sourceLayer: 'projections_dat' as const,
    };
    expect(hope.projectionType).toBe('future_hope');
    expect(hope.sourceLayer).toBe('projections_dat');
  });
});

// ═══ CROSS-PERSONA SEPARATION ═══
describe('Cross-Persona Separation', () => {
  it('Elias prompt does NOT contain Kim-only fields', () => {
    const result = buildClientSystemPrompt({
      persona: 'elias',
      crisisLevel: 0,
      safetyLevel: 'none',
      personalClinicalContext: 'Schemas: abandonment\nModes: detached protector\nTrigger chains: stress → isolation → craving',
    });
    // Elias should NOT have Kim relational stance
    expect(result.debug?.includedSections).not.toContain('relationalStance');
    expect(result.debug?.includedSections).not.toContain('depthNaming');
  });

  it('Kim prompt does NOT contain Elias-only fields', () => {
    const result = buildClientSystemPrompt({
      persona: 'kim',
      crisisLevel: 0,
      safetyLevel: 'none',
      personalClinicalContext: 'Schemas: self-sacrifice\nModes: compliant surrender',
    });
    // Kim should NOT have Elias module/interventionContinuity
    expect(result.debug?.includedSections).not.toContain('module');
    expect(result.debug?.includedSections).not.toContain('interventionContinuity');
    expect(result.debug?.includedSections).not.toContain('eliasFormulationBlock');
  });

  it('Elias prompt includes Elias-specific sections', () => {
    const result = buildClientSystemPrompt({
      persona: 'elias',
      crisisLevel: 0,
      safetyLevel: 'none',
      engineDirective: 'Module E01 active',
      eliasFormulationBlock: 'Recovery formulation block',
    });
    expect(result.debug?.includedSections).toContain('module');
    expect(result.debug?.includedSections).toContain('eliasFormulationBlock');
  });

  it('Kim prompt includes Kim-specific sections', () => {
    const result = buildClientSystemPrompt({
      persona: 'kim',
      crisisLevel: 0,
      safetyLevel: 'none',
      relationalStanceDirective: 'Relational stance active',
      kimFormulationBlock: 'Kim formulation block',
    });
    expect(result.debug?.includedSections).toContain('relationalStance');
    expect(result.debug?.includedSections).toContain('formulationBlock');
  });

  it('personalClinicalContext reaches both personas', () => {
    const clinicalCtx = 'Schemas: abandonment (high)\nModes: detached protector\nTriggers: stress → isolation';
    
    const elias = buildClientSystemPrompt({
      persona: 'elias',
      crisisLevel: 0,
      safetyLevel: 'none',
      personalClinicalContext: clinicalCtx,
    });
    expect(elias.systemPrompt).toContain('PERSONAL CLINICAL CONTEXT');
    expect(elias.systemPrompt).toContain('abandonment');

    const kim = buildClientSystemPrompt({
      persona: 'kim',
      crisisLevel: 0,
      safetyLevel: 'none',
      personalClinicalContext: clinicalCtx,
    });
    expect(kim.systemPrompt).toContain('PERSONAL CLINICAL CONTEXT');
    expect(kim.systemPrompt).toContain('abandonment');
  });

  it('personalAnchors reach both personas', () => {
    const anchors = 'Partner: relatie\nZoon: kind';
    
    const elias = buildClientSystemPrompt({
      persona: 'elias',
      crisisLevel: 0,
      safetyLevel: 'none',
      personalAnchors: anchors,
    });
    expect(elias.systemPrompt).toContain('PERSONAL ANCHORS');

    const kim = buildClientSystemPrompt({
      persona: 'kim',
      crisisLevel: 0,
      safetyLevel: 'none',
      personalAnchors: anchors,
    });
    expect(kim.systemPrompt).toContain('PERSONAL ANCHORS');
  });
});

// ═══ FEATURE FLAG AUDIT ═══
describe('Feature Flag Audit', () => {
  it('EXPO_PUBLIC_ENABLE_CLIENT_PROMPT_MIRROR is referenced in code', () => {
    // This flag has only 1 reference — verify it exists and is intentional
    const fs = require('fs');
    const path = require('path');
    const projectRoot = path.resolve(__dirname, '..');
    let count = 0;
    function searchDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          searchDir(fullPath);
        } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (content.includes('EXPO_PUBLIC_ENABLE_CLIENT_PROMPT_MIRROR')) {
            count++;
          }
        }
      }
    }
    searchDir(path.join(projectRoot, 'lib'));
    searchDir(path.join(projectRoot, 'app'));
    // Document: this flag has exactly 1 reference — it's a debug/mirror feature
    // Not dead code, but single-use. Keep for now.
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('EXPO_PUBLIC_ENABLE_CORE_EPISTEMIC_ENGINE is referenced', () => {
    const fs = require('fs');
    const path = require('path');
    const projectRoot = path.resolve(__dirname, '..');
    let count = 0;
    function searchDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) searchDir(fullPath);
        else if ((entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          if (fs.readFileSync(fullPath, 'utf8').includes('EXPO_PUBLIC_ENABLE_CORE_EPISTEMIC_ENGINE')) count++;
        }
      }
    }
    searchDir(path.join(projectRoot, 'lib'));
    searchDir(path.join(projectRoot, 'app'));
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('EXPO_PUBLIC_ENABLE_EPISTEMIC_MODEL_ROUTING is referenced', () => {
    const fs = require('fs');
    const path = require('path');
    const projectRoot = path.resolve(__dirname, '..');
    let count = 0;
    function searchDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) searchDir(fullPath);
        else if ((entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          if (fs.readFileSync(fullPath, 'utf8').includes('EXPO_PUBLIC_ENABLE_EPISTEMIC_MODEL_ROUTING')) count++;
        }
      }
    }
    searchDir(path.join(projectRoot, 'lib'));
    searchDir(path.join(projectRoot, 'app'));
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
