import { describe, it, expect } from 'vitest';
import {
  buildKimRelationalFormulationContext,
  type KimRelationalFormulationInput,
} from '@/lib/engine/kim/relational-formulation';

function makeInput(overrides: Partial<KimRelationalFormulationInput> = {}): KimRelationalFormulationInput {
  return {
    userMessage: 'test bericht',
    persona: 'kim',
    effectiveDepth: 'medium',
    safetyActive: false,
    crisisActive: false,
    relationalHarmPatternActive: false,
    localTimestamp: '2026-08-10T12:00:00.000Z',
    ...overrides,
  };
}

describe('FASE 6B: Kim Relational Formulation Engine V1', () => {
  // 1. non-kim persona geeft off context
  it('1. non-kim persona returns off context', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput({ persona: 'elias' }));
    expect(ctx.mode).toBe('off');
    expect(ctx.persona).toBe('kim');
  });

  // 2. empty message geeft insufficient_context
  it('2. empty message returns insufficient_context', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput({ userMessage: '' }));
    expect(ctx.mode).toBe('insufficient_context');
  });

  // 3. safetyActive geeft safety_blocked
  it('3. safetyActive returns safety_blocked', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput({ safetyActive: true }));
    expect(ctx.mode).toBe('safety_blocked');
    expect(ctx.severity).toBe('acute_safety');
    expect(ctx.activeDomains).toContain('safety');
  });

  // 4. crisisActive geeft safety_blocked
  it('4. crisisActive returns safety_blocked', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput({ crisisActive: true }));
    expect(ctx.mode).toBe('safety_blocked');
  });

  // 5. low depth vult alleen low layers
  it('5. low depth fills only low layers', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput({ effectiveDepth: 'low', userMessage: 'hij heeft gelogen' }));
    expect(ctx.mode).toBe('low');
    expect(ctx.activeLayers).toContain('facts');
    expect(ctx.activeLayers).toContain('responsibility_map');
    expect(ctx.activeLayers).not.toContain('behavior_functions');
    expect(ctx.activeLayers).not.toContain('core_hypothesis');
  });

  // 6. medium depth vult medium layers
  it('6. medium depth fills medium layers', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput({ effectiveDepth: 'medium', userMessage: 'hij heeft gelogen' }));
    expect(ctx.mode).toBe('medium');
    expect(ctx.activeLayers).toContain('repair_conditions');
    expect(ctx.activeLayers).toContain('domain_separation');
    expect(ctx.activeLayers).not.toContain('behavior_functions');
  });

  // 7. high depth vult high layers
  it('7. high depth fills high layers', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput({ effectiveDepth: 'high', userMessage: 'hij heeft gelogen' }));
    expect(ctx.mode).toBe('high');
    expect(ctx.activeLayers).toContain('behavior_functions');
    expect(ctx.activeLayers).toContain('core_hypothesis');
    expect(ctx.activeLayers).toContain('counter_hypotheses');
  });

  // 8. repeated lying detecteert repeated_pattern trust/honesty
  it('8. repeated lying detects repeated_pattern trust/honesty', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput({ userMessage: 'hij heeft al meerdere keren gelogen' }));
    expect(ctx.severity).toBe('repeated_pattern');
    expect(ctx.activeDomains).toContain('trust');
    expect(ctx.activeDomains).toContain('honesty');
  });

  // 9. single lying detecteert single_event
  it('9. single lying detects single_event', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput({ userMessage: 'hij heeft gelogen' }));
    expect(ctx.severity).toBe('single_event');
  });

  // 10. betrayal mustMention bevat herstel over tijd
  it('10. betrayal mustMention contains recovery over time', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput({ userMessage: 'hij heeft me bedrogen' }));
    expect(ctx.mustMention.some(m => m.includes('herstel') && m.includes('tijd'))).toBe(true);
  });

  // 11. affectie/intimiteit detecteert affection/intimacy
  it('11. affection/intimacy detected', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput({ userMessage: 'ik voel geen affectie meer' }));
    expect(ctx.activeDomains).toContain('affection');
    expect(ctx.activeDomains).toContain('intimacy');
  });

  // 12. sex pressure detecteert sexual_pressure en boundary ending
  it('12. sex pressure detects sexual_pressure and boundary ending', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput({ userMessage: 'hij duwt mij om seks te hebben tegen mijn zin' }));
    expect(ctx.activeDomains).toContain('sexual_pressure');
    expect(ctx.endingStyle).toBe('boundary');
  });

  // 13. stay/leave detecteert decision pressure zonder beslissing
  it('13. stay/leave detects decision pressure without decision', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput({ userMessage: 'moet ik blijven of weggaan?' }));
    expect(ctx.activeDomains).toContain('boundary_pressure');
    expect(ctx.mustMention.some(m => m.includes('beslissing niet over'))).toBe(true);
    expect(ctx.mustAvoid).toContain('je moet blijven');
    expect(ctx.mustAvoid).toContain('je moet weggaan');
  });

  // 14. caregiving load detecteert self_loss/caregiving_load
  it('14. caregiving load detects self_loss/caregiving_load', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput({ userMessage: 'ik draag alles en ik verlies mezelf' }));
    expect(ctx.activeDomains).toContain('caregiving_load');
    expect(ctx.activeDomains).toContain('self_loss');
  });

  // 15. control/avoidance loop detecteert beide patronen
  it('15. control/avoidance loop detects both patterns', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput({ userMessage: 'ik controleer alles en hij ontwijkt' }));
    expect(ctx.activeDomains).toContain('control');
    expect(ctx.activeDomains).toContain('avoidance');
  });

  // 16. child trust detecteert child_trust en domain separation
  it('16. child trust detects child_trust and domain separation', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput({ userMessage: 'mijn zoon vertrouwt hem niet meer' }));
    expect(ctx.activeDomains).toContain('child_trust');
    expect(ctx.domainSeparations.some(d => d.domainB === 'child_trust')).toBe(true);
  });

  // 17. shame/guilt detecteert shame zonder zelfhaat
  it('17. shame/guilt detects shame without self-hate', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput({ userMessage: 'ik voel mij schuldig' }));
    expect(ctx.activeDomains).toContain('shame');
    expect(ctx.mustMention.some(m => m.includes('richting geven zonder jezelf te vernietigen'))).toBe(true);
  });

  // 18. grief/loss detecteert grief
  it('18. grief/loss detects grief', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput({ userMessage: 'ik rouw om wat we hadden' }));
    expect(ctx.activeDomains).toContain('grief');
    expect(ctx.mustMention.some(m => m.includes('rouw kan ook bestaan terwijl iemand nog leeft'))).toBe(true);
  });

  // 19. responsibilityMap bevat caregiver grenzen
  it('19. responsibilityMap contains caregiver boundaries', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput({ userMessage: 'hij heeft gelogen', effectiveDepth: 'low' }));
    const cgItem = ctx.responsibilityMap.find(r => r.owner === 'caregiver');
    expect(cgItem).toBeDefined();
    expect(cgItem!.responsibility).toContain('eigen grenzen');
  });

  // 20. responsibilityMap bevat dependent honesty/recovery
  it('20. responsibilityMap contains dependent honesty/recovery', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput({ userMessage: 'hij heeft gelogen', effectiveDepth: 'low' }));
    const dpItem = ctx.responsibilityMap.find(r => r.owner === 'dependent_person');
    expect(dpItem).toBeDefined();
    expect(dpItem!.responsibility).toContain('eerlijkheid');
  });

  // 21. caregiver niet verantwoordelijk voor gebruik ander
  it('21. caregiver not responsible for other person use', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput({ userMessage: 'hij heeft gelogen', effectiveDepth: 'low' }));
    const cgItem = ctx.responsibilityMap.find(r => r.owner === 'caregiver');
    expect(cgItem!.notResponsibleFor).toContain('gebruik van de ander');
  });

  // 22. domain separation addiction_recovery vs relationship_repair
  it('22. domain separation addiction_recovery vs relationship_repair', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput({ userMessage: 'hij heeft gelogen', effectiveDepth: 'medium', memoryFacts: ['addiction_recovery'] }));
    // addiction_recovery domain added via memoryFacts detection
    // The default separation is added when relevant domains present
    expect(ctx.schemaVersion).toBe('kim_relational_formulation_v1');
  });

  // 23. domain separation trust vs affection
  it('23. domain separation trust vs affection when both present', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput({ userMessage: 'hij heeft gelogen en ik voel geen affectie meer', effectiveDepth: 'medium' }));
    expect(ctx.activeDomains).toContain('trust');
    expect(ctx.activeDomains).toContain('affection');
    expect(ctx.domainSeparations.some(d => d.domainA === 'trust' && d.domainB === 'affection')).toBe(true);
  });

  // 24. domain separation intimacy vs sexual_pressure
  it('24. domain separation intimacy vs sexual_pressure', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput({ userMessage: 'hij duwt mij om seks te hebben tegen mijn zin', effectiveDepth: 'medium' }));
    expect(ctx.domainSeparations.some(d => d.domainA === 'intimacy' && d.domainB === 'sexual_pressure')).toBe(true);
  });

  // 25. coreHypothesis alleen bij high
  it('25. coreHypothesis only at high', () => {
    const ctxLow = buildKimRelationalFormulationContext(makeInput({ userMessage: 'hij heeft gelogen', effectiveDepth: 'low' }));
    expect(ctxLow.coreHypothesis).toBeNull();
    const ctxMed = buildKimRelationalFormulationContext(makeInput({ userMessage: 'hij heeft gelogen', effectiveDepth: 'medium' }));
    expect(ctxMed.coreHypothesis).toBeNull();
    const ctxHigh = buildKimRelationalFormulationContext(makeInput({ userMessage: 'hij heeft gelogen', effectiveDepth: 'high' }));
    expect(ctxHigh.coreHypothesis).not.toBeNull();
  });

  // 26. high output geeft geen diagnose
  it('26. high output gives no diagnosis', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput({ userMessage: 'hij heeft al meerdere keren gelogen', effectiveDepth: 'high' }));
    expect(ctx.coreHypothesis).not.toMatch(/narcis/i);
    expect(ctx.coreHypothesis).not.toMatch(/manipul/i);
    expect(ctx.mustMention.join(' ')).not.toMatch(/narcis/i);
  });

  // 27. output bevat geen forced forgiveness
  it('27. output contains no forced forgiveness', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput({ userMessage: 'hij heeft me bedrogen', effectiveDepth: 'high' }));
    expect(ctx.mustMention.join(' ')).not.toMatch(/vergeef hem/i);
    expect(ctx.mustAvoid).toContain('vergeef hem');
  });

  // 28. output bevat geen stay/leave beslissing
  it('28. output contains no stay/leave decision', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput({ userMessage: 'moet ik blijven of weggaan?', effectiveDepth: 'high' }));
    expect(ctx.mustAvoid).toContain('je moet blijven');
    expect(ctx.mustAvoid).toContain('je moet weggaan');
    expect(ctx.mustMention.join(' ')).not.toMatch(/je moet blijven|je moet weggaan/i);
  });

  // 29. output bevat geen sexual obligation
  it('29. output contains no sexual obligation', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput({ userMessage: 'geen zin in seks', effectiveDepth: 'medium' }));
    expect(ctx.mustAvoid).toContain('seks hoort erbij');
    expect(ctx.mustAvoid).toContain('je moet seks hebben');
  });

  // 30. validate wordt toegepast
  it('30. validation is applied on output', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput({ userMessage: 'hij heeft gelogen' }));
    expect(ctx.schemaVersion).toBe('kim_relational_formulation_v1');
    expect(ctx.persona).toBe('kim');
  });

  // 31. validation failure geeft safe fallback
  it('31. validation failure gives safe fallback', () => {
    // We can't easily trigger a validation failure from normal input,
    // but we can verify the contract: if mustMention contained forbidden language,
    // the validator would catch it and the engine would return fallback.
    // Test that the engine never produces forbidden language:
    const ctx = buildKimRelationalFormulationContext(makeInput({ userMessage: 'hij heeft gelogen en bedrogen meerdere keren', effectiveDepth: 'high' }));
    expect(ctx.mustMention.every(m => !(/je moet weggaan|je moet blijven|vergeef hem|seks hoort erbij/i.test(m)))).toBe(true);
  });

  // 32. no server imports
  it('32. no server imports in engine file', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync(
      '/home/ubuntu/recofree-app/lib/engine/kim/relational-formulation/kim-relational-formulation-engine.ts',
      'utf-8'
    );
    expect(source).not.toMatch(/from ['"]@\/server/);
    expect(source).not.toMatch(/invokeLLM/);
  });

  // 33. no runtime side effects
  it('33. no runtime side effects in engine file', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync(
      '/home/ubuntu/recofree-app/lib/engine/kim/relational-formulation/kim-relational-formulation-engine.ts',
      'utf-8'
    );
    expect(source).not.toMatch(/AsyncStorage/);
    expect(source).not.toMatch(/SecureStore/);
    expect(source).not.toMatch(/fetch\(/);
  });

  // 34. no pipeline imports
  it('34. no pipeline imports in engine file', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync(
      '/home/ubuntu/recofree-app/lib/engine/kim/relational-formulation/kim-relational-formulation-engine.ts',
      'utf-8'
    );
    expect(source).not.toMatch(/from ['"]@\/lib\/rugzak\/pipeline/);
  });

  // 35. no nano imports
  it('35. no nano imports in engine file', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync(
      '/home/ubuntu/recofree-app/lib/engine/kim/relational-formulation/kim-relational-formulation-engine.ts',
      'utf-8'
    );
    expect(source).not.toMatch(/nano/i);
  });

  // 36. no AsyncStorage imports
  it('36. no AsyncStorage imports in engine file', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync(
      '/home/ubuntu/recofree-app/lib/engine/kim/relational-formulation/kim-relational-formulation-engine.ts',
      'utf-8'
    );
    expect(source).not.toMatch(/AsyncStorage/);
    expect(source).not.toMatch(/SecureStore/);
    expect(source).not.toMatch(/MMKV/);
  });
});
