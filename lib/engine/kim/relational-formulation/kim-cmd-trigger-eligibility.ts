/**
 * FASE 8I: Kim CMD-Aware Trigger Eligibility Helper
 * Evaluates whether CMD memory alone is sufficient to trigger Kim formulation
 * when the user input does not contain explicit regex triggers.
 */
import type { KimMemoryBridge } from '@/lib/engine/shared/clinical-memory-distillation/clinical-memory-distillation-types';
import type { ClinicalMemoryDomain } from '@/lib/engine/shared/clinical-memory-distillation/clinical-memory-distillation-types';

// Kim-relevant domains (Elias-only domains excluded)
const KIM_RELEVANT_DOMAINS: ClinicalMemoryDomain[] = [
  'trust', 'lying', 'betrayal', 'boundary_pressure', 'self_loss',
  'caregiving_load', 'control', 'emotional_overload', 'grief',
  'intimacy', 'affection', 'sexual_pressure', 'communication',
  'guilt', 'shame', 'loneliness', 'abandonment',
];

// Elias-only domains that must never trigger Kim
const ELIAS_ONLY_DOMAINS: ClinicalMemoryDomain[] = [
  'craving', 'relapse_risk', 'post_relapse', 'body_state', 'sleep',
];

export interface KimCMDTriggerResult {
  shouldTrigger: boolean;
  triggerStrength: 'none' | 'weak' | 'medium' | 'strong';
  triggerDomains: ClinicalMemoryDomain[];
  evidenceKinds: string[];
  mustMention: string[];
  mustAvoid: string[];
  warnings: string[];
}

export function evaluateKimCMDTriggerEligibility(input: {
  persona: string;
  cmdMemory?: KimMemoryBridge | null;
}): KimCMDTriggerResult {
  const empty: KimCMDTriggerResult = {
    shouldTrigger: false, triggerStrength: 'none',
    triggerDomains: [], evidenceKinds: [], mustMention: [], mustAvoid: [], warnings: [],
  };

  // Rule A: persona must be kim
  if (input.persona !== 'kim') return empty;

  // Rule B: cmdMemory must exist
  if (!input.cmdMemory) return empty;

  const mem = input.cmdMemory;
  const triggerDomains = new Set<ClinicalMemoryDomain>();
  const evidenceKinds: string[] = [];
  const mustMention: string[] = [];
  const mustAvoid: string[] = [];
  const warnings: string[] = [];
  let strength: 'none' | 'weak' | 'medium' | 'strong' = 'none';

  // Check for Elias-only data (should warn, not trigger)
  const hasEliasOnlyData = (mem as any).recoveryChains?.length > 0 ||
    (mem as any).vspAnchors?.length > 0 ||
    (mem as any).sobrietySignals?.length > 0 ||
    (mem as any).relapsePlanSignals?.length > 0;
  if (hasEliasOnlyData) {
    warnings.push('elias_only_data_found_in_kim_memory');
  }

  // Condition 1: Strong — relationalPatterns
  if (mem.relationalPatterns.length > 0) {
    for (const rp of mem.relationalPatterns) {
      const hasKimDomain = rp.activeDomains.some(d => KIM_RELEVANT_DOMAINS.includes(d));
      if (hasKimDomain && (rp.harmRepeated || rp.boundaryPressure || rp.activeDomains.some(d =>
        ['trust', 'lying', 'betrayal', 'boundary_pressure', 'self_loss', 'caregiving_load', 'control'].includes(d)
      ))) {
        strength = 'strong';
        rp.activeDomains.filter(d => KIM_RELEVANT_DOMAINS.includes(d)).forEach(d => triggerDomains.add(d));
        evidenceKinds.push('relational_pattern');
      }
    }
  }

  // Condition 2: ERP anchors
  if (mem.erpAnchors.length > 0 && strength !== 'strong') {
    for (const erp of mem.erpAnchors) {
      if (['eigen_regie', 'boundary_pressure', 'self_loss', 'caregiving_load', 'control', 'trust', 'betrayal'].includes(erp.domain as string)) {
        strength = strength === 'none' ? 'medium' : strength;
        triggerDomains.add(erp.domain);
        evidenceKinds.push('erp_anchor');
      }
    }
  }

  // Condition 3: Risk markers
  if (mem.riskMarkers.length > 0) {
    for (const rm of mem.riskMarkers) {
      if (KIM_RELEVANT_DOMAINS.includes(rm.domain) && (rm.severity === 'medium' || rm.severity === 'high' || rm.severity === 'acute')) {
        if (strength === 'none') strength = 'medium';
        if (rm.severity === 'high' || rm.severity === 'acute') strength = 'strong';
        triggerDomains.add(rm.domain);
        evidenceKinds.push('risk_marker');
      }
    }
  }

  // Condition 4: Pattern accumulation (2+ medium signals)
  if (strength === 'none') {
    let signalCount = 0;
    let hasNonProjection = false;

    if (mem.relationalPatterns.length > 0) { signalCount++; hasNonProjection = true; }
    if (mem.riskMarkers.filter(r => KIM_RELEVANT_DOMAINS.includes(r.domain)).length > 0) { signalCount++; hasNonProjection = true; }
    if (mem.formulationReadyHypotheses.filter(h => KIM_RELEVANT_DOMAINS.includes(h.domain)).length > 0) { signalCount++; hasNonProjection = true; }
    if (mem.backpackAnchors.filter(b => KIM_RELEVANT_DOMAINS.includes(b.domain)).length > 0) { signalCount++; hasNonProjection = true; }
    if (mem.protectiveFactors.length > 0) signalCount++;
    if (mem.projectionMarkers.length > 0) signalCount++;

    if (signalCount >= 2 && hasNonProjection) {
      strength = 'medium';
      // Add domains from all sources
      for (const h of mem.formulationReadyHypotheses) {
        if (KIM_RELEVANT_DOMAINS.includes(h.domain)) triggerDomains.add(h.domain);
      }
      for (const b of mem.backpackAnchors) {
        if (KIM_RELEVANT_DOMAINS.includes(b.domain)) triggerDomains.add(b.domain);
      }
      evidenceKinds.push('pattern_accumulation');
    }
  }

  // BLOCK: projection-only or protective-only cannot trigger
  if (strength !== 'none' && evidenceKinds.length === 0) {
    strength = 'none';
  }
  if (triggerDomains.size === 0 && strength !== 'none') {
    strength = 'none';
  }

  // Build mustMention based on domains
  const domains = Array.from(triggerDomains);
  if (domains.some(d => ['self_loss', 'caregiving_load'].includes(d))) {
    mustMention.push('Benoem dat haar dag/stemming opnieuw rond de ander begint te draaien.');
    mustMention.push('Bescherm eigen regie zonder verbinding meteen af te breken.');
  }
  if (domains.some(d => ['boundary_pressure', 'guilt'].includes(d))) {
    mustMention.push('Benoem dat schuld na een grens niet automatisch betekent dat de grens fout is.');
    mustMention.push('Help haar de grens klein en uitvoerbaar houden.');
  }
  if (domains.some(d => ['trust', 'lying', 'betrayal'].includes(d))) {
    mustMention.push('Benoem herhaald vertrouwensletsel zonder de ander te demoniseren.');
    mustMention.push('Maak verschil tussen begrijpen en dragen.');
  }
  if (domains.includes('control')) {
    mustMention.push('Benoem controle als begrijpelijke poging om onveiligheid te verminderen, maar ook als uitputtend patroon.');
    mustMention.push('Verplaats focus naar wat zij vandaag zelf kan kiezen.');
  }

  // Projection-based mustMention (supportive only)
  if (mem.projectionMarkers.some(p => p.projectionType === 'future_hope')) {
    mustMention.push('Erken hoop als hoop, niet als garantie.');
    mustMention.push('Koppel hoop aan voorwaarden voor veiligheid, eerlijkheid en herstel.');
  }
  if (mem.projectionMarkers.some(p => p.projectionType === 'future_fear')) {
    mustMention.push('Erken angst als angst, niet als voorspelling.');
    mustMention.push('Breng haar terug naar eigen regie in het huidige moment.');
  }

  // Always add mustAvoid when CMD-trigger active
  if (strength !== 'none') {
    mustAvoid.push('Behandel hypotheses niet als feiten.');
    mustAvoid.push('Noem CMD memory niet expliciet.');
    mustAvoid.push('Gebruik geen diagnostische labels.');
    mustAvoid.push('Kies geen kant tegen de persoon met afhankelijkheid.');
    mustAvoid.push('Duw geen relatiebeslissing.');
    mustAvoid.push('Geef geen Elias/afkickadvies.');
    mustAvoid.push('Gebruik geen VSP- of relapse-taal voor Kim.');
    mustAvoid.push('Maak hoop geen garantie.');
    mustAvoid.push('Maak angst geen voorspelling.');
  }

  return {
    shouldTrigger: strength !== 'none',
    triggerStrength: strength,
    triggerDomains: domains,
    evidenceKinds,
    mustMention,
    mustAvoid,
    warnings,
  };
}
