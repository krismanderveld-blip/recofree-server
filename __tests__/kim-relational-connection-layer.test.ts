/**
 * KIM RELATIONAL CONNECTION LAYER — Test Cases
 *
 * Tests for K03, K04, K05, K06, KDL01 relational stance patches.
 * K05 tests are the most thorough as it is the central connection module.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { detectK03State, routeK03Engine, resetK03SessionState } from '@/lib/engine/kim/k03-self-care';
import { detectK04EmotionalState, routeK04Engine } from '@/lib/engine/kim/k04-emotional-regulation';
import { routeK05Engine, createDefaultK05Progress } from '@/lib/engine/kim/k05-communication';
import type { K05EngineInput } from '@/lib/engine/kim/k05-communication';
import { detectK06State, routeK06Engine } from '@/lib/engine/kim/k06-self-care';
import { buildKDL01FullPromptBlock } from '@/lib/engine/kim/modules/kdl01/kdl01-prompt';

// ─── K03 Self-Care ──────────────────────────────────────────────────────

describe('K03 Self-Care — Relational Connection Layer', () => {
  beforeEach(() => resetK03SessionState());

  it('K03 Kim prompt contains relational connection layer', () => {
    const detection = detectK03State('ik ben moe en leeg', 2, 3, 4);
    const routing = routeK03Engine(detection, undefined, 'kim');
    expect(routing.promptBlock).toContain('RELATIONAL CONNECTION LAYER');
    expect(routing.promptBlock).toContain('Self-care is NOT emotional withdrawal');
    expect(routing.promptBlock).toContain('calmer contact possible later');
  });

  it('K03 Kim prompt forbids framing self-care as break', () => {
    const detection = detectK03State('ik kan niet meer', 1, 2, 3);
    const routing = routeK03Engine(detection, undefined, 'kim');
    expect(routing.promptBlock).toContain('just choose yourself now');
  });

  it('K03 Elias prompt does NOT contain relational connection layer', () => {
    const detection = detectK03State('ik ben moe', 2, 3, 4);
    const routing = routeK03Engine(detection, undefined, 'elias');
    expect(routing.promptBlock).not.toContain('RELATIONAL CONNECTION LAYER');
  });
});

// ─── K04 Emotional Regulation ──────────────────────────────────────────

describe('K04 Emotional Regulation — Relational Connection Layer', () => {
  it('K04 prompt contains relational connection layer', () => {
    const detection = detectK04EmotionalState('ik ben zo boos dat ik niet meer kan denken');
    if (detection.activated) {
      const routing = routeK04Engine(detection, undefined);
      expect(routing.promptBlock).toContain('RELATIONAL CONNECTION LAYER');
      expect(routing.promptBlock).toContain('prevent contact from being further damaged');
    }
  });

  it('K04 forbids confirming anger without bridge to calm', () => {
    const detection = detectK04EmotionalState('ik ben woedend op de ander en kan niet meer');
    if (detection.activated) {
      const routing = routeK04Engine(detection, undefined);
      expect(routing.promptBlock).toContain('confirming the user in anger without a bridge to calm');
    }
  });
});

// ─── K05 Communication — THOROUGH TESTS ────────────────────────────────

describe('K05 Communication — Central Connection Module', () => {
  const defaultInput: K05EngineInput = {
    message: 'ik wil een gesprek voeren over wat er gebeurd is',
    userType: 'kim',
    vspLevel: 'GROEN',
    crisisLevel: 0,
    frustrationScore: 3,
    eigenRegieScore: null,
    sessionMessageCount: 5,
  };
  const progress = createDefaultK05Progress();

  describe('Framework and I-language requirements', () => {
    it('K05 prompt contains mandatory framework', () => {
      const result = routeK05Engine(defaultInput, progress);
      if (result.promptBlock) {
        expect(result.promptBlock).toContain('MANDATORY FRAMEWORK');
        expect(result.promptBlock).toContain('Observation → Own Feeling → Own Need → Boundary → Invitation → Repair Path');
      }
    });

    it('K05 prompt requires I-language', () => {
      const result = routeK05Engine(defaultInput, progress);
      if (result.promptBlock) {
        expect(result.promptBlock).toContain('I-language');
        expect(result.promptBlock).toContain('never "you always / you never"');
      }
    });

    it('K05 prompt blocks blame language', () => {
      const result = routeK05Engine({ ...defaultInput, message: 'ik wil zeggen dat het niet eerlijk is' }, progress);
      if (result.promptBlock) {
        expect(result.promptBlock).toContain('Blame as communication tool');
      }
    });
  });

  describe('Repair path and invitation requirements', () => {
    it('K05 prompt requires invitation to calmer contact', () => {
      const result = routeK05Engine({ ...defaultInput, message: 'ik wil een grens stellen' }, progress);
      if (result.promptBlock) {
        expect(result.promptBlock).toContain('invitation to calmer contact');
      }
    });

    it('K05 prompt requires repair path unless safety active', () => {
      const result = routeK05Engine(defaultInput, progress);
      if (result.promptBlock) {
        expect(result.promptBlock).toContain('repair path');
      }
    });

    it('K05 template demonstrates I-language + boundary + invitation', () => {
      const result = routeK05Engine(defaultInput, progress);
      if (result.promptBlock) {
        expect(result.promptBlock).toContain('When this happens, I notice I shut down');
        expect(result.promptBlock).toContain('Can we come back to this when we are both calmer');
      }
    });
  });

  describe('Cross-module override rule', () => {
    it('K05 prompt contains cross-module override rule', () => {
      const result = routeK05Engine(defaultInput, progress);
      if (result.promptBlock) {
        expect(result.promptBlock).toContain('CROSS-MODULE OVERRIDE RULE');
        expect(result.promptBlock).toContain('override ANY other Kim module');
        expect(result.promptBlock).toContain('boundary without a repair path');
      }
    });

    it('K05 cross-module rule requires 4 elements in every boundary', () => {
      const result = routeK05Engine(defaultInput, progress);
      if (result.promptBlock) {
        expect(result.promptBlock).toContain('1. I-language');
        expect(result.promptBlock).toContain('2. A limit');
        expect(result.promptBlock).toContain('3. An invitation');
        expect(result.promptBlock).toContain('4. A repair path');
      }
    });
  });

  describe('Harm layer awareness', () => {
    it('K05 prompt contains harm layer awareness', () => {
      const result = routeK05Engine(defaultInput, progress);
      if (result.promptBlock) {
        expect(result.promptBlock).toContain('HARM LAYER AWARENESS');
        expect(result.promptBlock).toContain('does NOT force immediate connection');
        expect(result.promptBlock).toContain('repair conditions');
      }
    });

    it('K05 harm layer offers conditional communication template', () => {
      const result = routeK05Engine(defaultInput, progress);
      if (result.promptBlock) {
        expect(result.promptBlock).toContain('I am willing to talk, but only if honesty is more important than avoidance');
      }
    });
  });

  describe('Safety awareness', () => {
    it('K05 prompt contains safety awareness', () => {
      const result = routeK05Engine(defaultInput, progress);
      if (result.promptBlock) {
        expect(result.promptBlock).toContain('SAFETY AWARENESS');
        expect(result.promptBlock).toContain('does NOT offer connection or repair');
        expect(result.promptBlock).toContain('safety first');
      }
    });

    it('K05 safety provides pause sentence', () => {
      const result = routeK05Engine(defaultInput, progress);
      if (result.promptBlock) {
        expect(result.promptBlock).toContain('I am not safe right now. I need to step away');
      }
    });
  });

  describe('Forbidden communication patterns', () => {
    it('K05 blocks "you always/never" patterns', () => {
      const result = routeK05Engine(defaultInput, progress);
      if (result.promptBlock) {
        expect(result.promptBlock).toContain('"You always do this" / "You never listen"');
      }
    });

    it('K05 blocks ultimatums disguised as boundaries', () => {
      const result = routeK05Engine(defaultInput, progress);
      if (result.promptBlock) {
        expect(result.promptBlock).toContain('Ultimatums disguised as boundaries');
      }
    });

    it('K05 blocks silence as punishment', () => {
      const result = routeK05Engine(defaultInput, progress);
      if (result.promptBlock) {
        expect(result.promptBlock).toContain('Silence as punishment');
      }
    });

    it('K05 blocks emotional withdrawal as healthy distance', () => {
      const result = routeK05Engine(defaultInput, progress);
      if (result.promptBlock) {
        expect(result.promptBlock).toContain('Emotional withdrawal presented as "healthy distance"');
      }
    });
  });

  describe('K05 does not activate for Elias', () => {
    it('K05 returns no promptBlock for Elias user type', () => {
      const result = routeK05Engine({ ...defaultInput, userType: 'elias' }, progress);
      expect(result.promptBlock).toBeNull();
    });
  });
});

// ─── K06 Sustainable Support ──────────────────────────────────────────

describe('K06 Sustainable Support — Relational Connection Layer', () => {
  it('K06 prompt contains relational connection layer', () => {
    const detection = detectK06State('ik ben uitgeput van het zorgen');
    if (detection.activated) {
      const routing = routeK06Engine(detection, undefined);
      expect(routing.promptBlock).toContain('RELATIONAL CONNECTION LAYER');
      expect(routing.promptBlock).toContain('staying involved without self-destruction');
    }
  });

  it('K06 distinguishes love, rescue, control, support, self-loss', () => {
    const detection = detectK06State('ik doe alles voor de ander en ik besta niet meer');
    if (detection.activated) {
      const routing = routeK06Engine(detection, undefined);
      expect(routing.promptBlock).toContain('Love (healthy, present, boundaried)');
      expect(routing.promptBlock).toContain('Rescue (taking over, removing consequences)');
      expect(routing.promptBlock).toContain('Control');
      expect(routing.promptBlock).toContain('Self-loss');
    }
  });
});

// ─── KDL01 Detachment with Love ──────────────────────────────────────

describe('KDL01 Detachment with Love — Relational Stance', () => {
  const mockPayload = {
    moduleId: 'KDL01' as const,
    active: true,
    responseMode: 'LOVE_WITHOUT_SELF_ERASURE' as const,
    triggerSummary: 'test trigger',
    coreFrame: 'love_without_self_erasure' as const,
    forbiddenPhrases: ['let go', 'just detach'],
    tone: 'warm_steady_grounded_gently_firm' as const,
    routeNext: 'NO_MODULE' as const,
    compactPromptBlock: 'KDL01 ACTIVE: test',
  };

  it('KDL01 prompt contains detachment ≠ distance stance', () => {
    const block = buildKDL01FullPromptBlock(mockPayload);
    expect(block).toContain('DETACHMENT IS NOT DISTANCE');
    expect(block).toContain('releasing control, not necessarily releasing connection');
    expect(block).toContain('Let go of control, not automatically of contact');
  });

  it('KDL01 classifies detachment types', () => {
    const block = buildKDL01FullPromptBlock(mockPayload);
    expect(block).toContain('releasing control? (healthy');
    expect(block).toContain('healthy pause?');
    expect(block).toContain('avoidance? (unhealthy');
    expect(block).toContain('punishment? (unhealthy');
    expect(block).toContain('safety-distance?');
    expect(block).toContain('relational harm repair condition?');
  });

  it('KDL01 only advises distance under specific conditions', () => {
    const block = buildKDL01FullPromptBlock(mockPayload);
    expect(block).toContain('ONLY advise distance when');
    expect(block).toContain('Safety is active');
    expect(block).toContain('Relational harm pattern is active');
    expect(block).toContain('self-loss');
  });
});
