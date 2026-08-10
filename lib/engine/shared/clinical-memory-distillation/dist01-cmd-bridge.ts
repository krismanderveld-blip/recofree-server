/**
 * DIST01-to-CMD Bridge — FASE 8D
 *
 * Pure adapter that maps existing DIST01 output to CMD contract types.
 * Does NOT import or modify existing DIST01 runtime files.
 * Uses structural typing / compatible input shapes only.
 *
 * No AsyncStorage, no server, no pipeline, no prompt, no side effects.
 * No ProjectionMarker creation (exclusive to projections.dat).
 * Projections are exclusive to projections.dat builder.
 */
import type {
  ClinicalMemoryPersona,
  ClinicalMemoryDomain,
  ClinicalMemoryUsePermission,
  ClinicalMemoryCertainty,
  MemoryEvidenceItem,
  MemoryFact,
  MemoryHypothesis,
  RecurrentPattern,
  RiskMarker,
  ProtectiveFactor,
  RecoveryChain,
  RelationalPattern,
} from './clinical-memory-distillation-types';
import {
  mapConfidenceToClinicalMemoryCertainty,
  truncateAnchorText,
} from './clinical-memory-distillation-mappers';

// ─── Input Types (structural, not importing DIST01 runtime) ────────────────

export interface Dist01BridgeEntityInput {
  id?: string;
  type?: string;
  label?: string;
  text?: string;
  relation?: string;
  confidence?: 'low' | 'medium' | 'high' | string;
  firstMentionedAt?: string;
  lastMentionedAt?: string;
  mentionCount?: number;
  sourceText?: string;
  userAuthored?: boolean;
}

export interface Dist01BridgeSignalInput {
  id?: string;
  type?: string;
  label?: string;
  text?: string;
  category?: string;
  confidence?: 'low' | 'medium' | 'high' | string;
  valence?: 'positive' | 'negative' | 'neutral' | string;
  mentionCount?: number;
  reinforcementCount?: number;
  firstMentionedAt?: string;
  lastMentionedAt?: string;
  sourceText?: string;
  userAuthored?: boolean;
}

export interface Dist01BridgeContextInput {
  id?: string;
  type?: string;
  label?: string;
  text?: string;
  confidence?: 'low' | 'medium' | 'high' | string;
  firstMentionedAt?: string;
  lastMentionedAt?: string;
  sourceText?: string;
  userAuthored?: boolean;
}

export interface Dist01CmdBridgeInput {
  persona: ClinicalMemoryPersona;
  entities: Dist01BridgeEntityInput[];
  signals: Dist01BridgeSignalInput[];
  contexts: Dist01BridgeContextInput[];
  nowLocal: string;
}

export interface Dist01CmdBridgeOutput {
  memoryFacts: MemoryFact[];
  memoryHypotheses: MemoryHypothesis[];
  recurrentPatterns: RecurrentPattern[];
  riskMarkers: RiskMarker[];
  protectiveFactors: ProtectiveFactor[];
  evidenceItems: MemoryEvidenceItem[];
  skippedItems: { item: unknown; reason: string }[];
  warnings: string[];
}

const MAX_TEXT_LENGTH = 100;

// ─── 5. createDist01EvidenceItem ──────────────────────────────────────────
export function createDist01EvidenceItem(input: {
  id?: string;
  sourceField: 'entity' | 'signal' | 'context';
  text?: string;
  timestampLocal?: string;
  confidence?: 'low' | 'medium' | 'high' | string;
  persona: ClinicalMemoryPersona;
  isUserAuthored?: boolean;
}): MemoryEvidenceItem | null {
  const text = input.text?.trim();
  if (!text) return null;
  const conf = input.confidence === 'high' ? 'high' : input.confidence === 'medium' ? 'medium' : 'low';
  return {
    id: input.id || `ev_dist01_${input.sourceField}_${text.slice(0, 12).replace(/\s/g, '_')}`,
    sourceLayer: 'distillation_dat',
    sourceField: input.sourceField,
    text: truncateAnchorText(text, MAX_TEXT_LENGTH) || text.slice(0, MAX_TEXT_LENGTH),
    timestampLocal: input.timestampLocal,
    confidence: conf,
    persona: input.persona,
    isUserAuthored: input.isUserAuthored ?? false,
  };
}

// ─── 6. classifyDist01Domain ──────────────────────────────────────────────
export function classifyDist01Domain(input: {
  type?: string;
  label?: string;
  text?: string;
  category?: string;
}): ClinicalMemoryDomain {
  const combined = [input.type, input.label, input.text, input.category]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/relapse|herval|terugval|teruggevallen/.test(combined)) return 'relapse_risk';
  if (/self.?hat|zelfhaat|hopeless|hopeloos/.test(combined)) return 'self_hatred';
  if (/shame|schaamte|schaam/.test(combined)) return 'shame';
  if (/craving|substance|alcohol|drink|gebruik|middel|drug|cocain|hero[ïi]n/.test(combined)) return 'craving';
  if (/avoid|vermijd|verstop|hide|geheim/.test(combined)) return 'avoidance';
  if (/sleep|slaa?p|insomnia/.test(combined)) return 'sleep';
  if (/body|lichaam|panic|paniek/.test(combined)) return 'body_state';
  if (/stress|overload|overspoeld|overwhelm/.test(combined)) return 'emotional_overload';
  if (/lonel|alleen|eenzaam|verlat|abandon/.test(combined)) return 'loneliness';
  if (/lying|lieg|leugen/.test(combined)) return 'lying';
  if (/betray|bedrog|verraad/.test(combined)) return 'betrayal';
  if (/trust|vertrouw/.test(combined)) return 'trust';
  if (/boundary|grens|grenzen/.test(combined)) return 'boundary_pressure';
  if (/support|help|steun/.test(combined)) return 'support';
  if (/structur|routine|dag|day/.test(combined)) return 'day_structure';
  if (/motiv|ambival/.test(combined)) return 'motivation';
  if (/grief|rouw|verlies|loss/.test(combined)) return 'grief';
  if (/control|controle/.test(combined)) return 'control';
  if (/intimacy|intim|affection|affectie|sex/.test(combined)) return 'intimacy';
  if (/child|kind/.test(combined)) return 'child_trust';
  if (/sobriety|nuchter|clean/.test(combined)) return 'sobriety';
  return 'unknown';
}

// ─── 7. inferDist01UsePermissions ─────────────────────────────────────────
export function inferDist01UsePermissions(input: {
  confidence?: 'low' | 'medium' | 'high' | string;
  category?: string;
  isRisk?: boolean;
  isProtective?: boolean;
  hasEvidence?: boolean;
}): ClinicalMemoryUsePermission[] {
  const perms: ClinicalMemoryUsePermission[] = [];

  if (input.isRisk) {
    perms.push('may_use_in_formulation', 'may_use_for_safety');
  } else if (input.isProtective) {
    perms.push('may_use_in_formulation', 'may_use_for_greeting');
  } else if (input.confidence === 'high' && input.hasEvidence) {
    perms.push('may_use_in_formulation');
  } else if (input.confidence === 'low' || input.confidence === 'medium') {
    perms.push('may_use_only_as_hypothesis', 'may_not_use_as_fact', 'may_use_in_formulation');
  } else {
    perms.push('may_not_use_in_gpt');
  }

  if (perms.length === 0) perms.push('may_not_use_in_gpt');
  return perms;
}

// ─── 8. shouldSkipDist01Item ──────────────────────────────────────────────
export function shouldSkipDist01Item(input: {
  persona?: string;
  text?: string;
  label?: string;
  type?: string;
  confidence?: string;
  expectedPersona: ClinicalMemoryPersona;
}): { skip: boolean; reason?: string } {
  if (!input.persona && !input.expectedPersona) return { skip: true, reason: 'no_persona' };
  if (input.persona && input.persona !== input.expectedPersona) return { skip: true, reason: 'cross_persona_mismatch' };
  const text = input.text || input.label || '';
  if (!text.trim()) return { skip: true, reason: 'no_usable_text' };
  if (text.length > 500 && !input.type) return { skip: true, reason: 'text_too_long_no_type' };
  if (!input.confidence && !input.type && !input.label) return { skip: true, reason: 'insufficient_data' };
  return { skip: false };
}

// ─── 2. mapDist01EntityToMemory ───────────────────────────────────────────
export function mapDist01EntityToMemory(input: {
  entity: Dist01BridgeEntityInput;
  persona: ClinicalMemoryPersona;
  nowLocal: string;
}): MemoryFact | MemoryHypothesis | null {
  const { entity, persona, nowLocal } = input;
  const text = entity.label || entity.text || '';
  if (!text.trim()) return null;

  const evidence = createDist01EvidenceItem({
    id: entity.id ? `ev_${entity.id}` : undefined,
    sourceField: 'entity',
    text: entity.sourceText || text,
    timestampLocal: entity.lastMentionedAt || entity.firstMentionedAt,
    confidence: entity.confidence,
    persona,
    isUserAuthored: entity.userAuthored,
  });
  if (!evidence) return null;

  const domain = classifyDist01Domain({ type: entity.type, label: entity.label, text: entity.text });
  const conf = (entity.confidence === 'high' || entity.confidence === 'medium' || entity.confidence === 'low') ? entity.confidence : undefined;

  if (conf === 'high' && (entity.type === 'person' || entity.type === 'relation')) {
    const fact: MemoryFact = {
      id: entity.id || `fact_entity_${text.slice(0, 15).replace(/\s/g, '_')}`,
      persona,
      domain,
      text: truncateAnchorText(text, MAX_TEXT_LENGTH) || text.slice(0, MAX_TEXT_LENGTH),
      sourceLayer: 'distillation_dat',
      certainty: 'high_confidence_inference',
      freshness: 'unknown',
      evidence: [evidence],
      usePermissions: inferDist01UsePermissions({ confidence: 'high', hasEvidence: true }),
      createdAtLocal: entity.firstMentionedAt || nowLocal,
      updatedAtLocal: entity.lastMentionedAt || nowLocal,
    };
    return fact;
  }

  const hypothesis: MemoryHypothesis = {
    id: entity.id || `hyp_entity_${text.slice(0, 15).replace(/\s/g, '_')}`,
    persona,
    domain,
    hypothesis: truncateAnchorText(text, MAX_TEXT_LENGTH) || text.slice(0, MAX_TEXT_LENGTH),
    sourceLayer: 'distillation_dat',
    certainty: mapConfidenceToClinicalMemoryCertainty(conf, false),
    evidence: [evidence],
    usePermissions: inferDist01UsePermissions({ confidence: conf, hasEvidence: true }),
    needsUserConfirmation: true,
    createdAtLocal: entity.firstMentionedAt || nowLocal,
    updatedAtLocal: entity.lastMentionedAt || nowLocal,
  };
  return hypothesis;
}

// ─── 3. mapDist01SignalToCMD ──────────────────────────────────────────────
export function mapDist01SignalToCMD(input: {
  signal: Dist01BridgeSignalInput;
  persona: ClinicalMemoryPersona;
  nowLocal: string;
}): {
  memoryFact?: MemoryFact;
  memoryHypothesis?: MemoryHypothesis;
  recurrentPattern?: RecurrentPattern;
  riskMarker?: RiskMarker;
  protectiveFactor?: ProtectiveFactor;
} {
  const { signal, persona, nowLocal } = input;
  const text = signal.label || signal.text || '';
  if (!text.trim()) return {};

  const evidence = createDist01EvidenceItem({
    id: signal.id ? `ev_${signal.id}` : undefined,
    sourceField: 'signal',
    text: signal.sourceText || text,
    timestampLocal: signal.lastMentionedAt || signal.firstMentionedAt,
    confidence: signal.confidence,
    persona,
    isUserAuthored: signal.userAuthored,
  });
  if (!evidence) return {};

  const domain = classifyDist01Domain({ type: signal.type, label: signal.label, text: signal.text, category: signal.category });
  const conf = (signal.confidence === 'high' || signal.confidence === 'medium' || signal.confidence === 'low') ? signal.confidence : undefined;
  const isRisk = signal.category === 'risk' || signal.type === 'risk_pattern_detected' || signal.valence === 'negative';
  const isProtective = signal.category === 'protective' || signal.type === 'protective_pattern_detected' || signal.valence === 'positive';
  const mentions = (signal.mentionCount ?? 0) + (signal.reinforcementCount ?? 0);

  // Risk signal
  if (isRisk && conf === 'high') {
    return {
      riskMarker: {
        id: signal.id || `risk_${text.slice(0, 15).replace(/\s/g, '_')}`,
        persona,
        domain,
        risk: truncateAnchorText(text, MAX_TEXT_LENGTH) || text.slice(0, MAX_TEXT_LENGTH),
        severity: mentions >= 5 ? 'high' : mentions >= 2 ? 'medium' : 'low',
        trend: 'unknown',
        evidence: [evidence],
        usePermissions: inferDist01UsePermissions({ confidence: 'high', isRisk: true, hasEvidence: true }),
      },
    };
  }

  // Protective signal
  if (isProtective && conf === 'high') {
    return {
      protectiveFactor: {
        id: signal.id || `prot_${text.slice(0, 15).replace(/\s/g, '_')}`,
        persona,
        domain,
        factor: truncateAnchorText(text, MAX_TEXT_LENGTH) || text.slice(0, MAX_TEXT_LENGTH),
        strength: mentions >= 5 ? 'high' : mentions >= 2 ? 'medium' : 'low',
        evidence: [evidence],
        usePermissions: inferDist01UsePermissions({ confidence: 'high', isProtective: true, hasEvidence: true }),
      },
    };
  }

  // Recurrent pattern (trigger/pattern with mentions >= 2)
  if ((signal.type === 'trigger' || signal.type === 'pattern' || signal.category === 'trigger') && mentions >= 2) {
    return {
      recurrentPattern: {
        id: signal.id || `recur_${text.slice(0, 15).replace(/\s/g, '_')}`,
        persona,
        domain,
        pattern: truncateAnchorText(text, MAX_TEXT_LENGTH) || text.slice(0, MAX_TEXT_LENGTH),
        frequency: mentions,
        trend: 'unknown',
        sourceLayers: ['distillation_dat'],
        evidence: [evidence],
        certainty: mapConfidenceToClinicalMemoryCertainty(conf, false),
        firstSeenLocal: signal.firstMentionedAt,
        lastSeenLocal: signal.lastMentionedAt,
        usePermissions: inferDist01UsePermissions({ confidence: conf, hasEvidence: true }),
      },
    };
  }

  // Low/medium risk => hypothesis
  if (isRisk && (conf === 'low' || conf === 'medium')) {
    return {
      memoryHypothesis: {
        id: signal.id || `hyp_sig_${text.slice(0, 15).replace(/\s/g, '_')}`,
        persona,
        domain,
        hypothesis: truncateAnchorText(text, MAX_TEXT_LENGTH) || text.slice(0, MAX_TEXT_LENGTH),
        sourceLayer: 'distillation_dat',
        certainty: mapConfidenceToClinicalMemoryCertainty(conf, false),
        evidence: [evidence],
        usePermissions: inferDist01UsePermissions({ confidence: conf, hasEvidence: true }),
        needsUserConfirmation: true,
        createdAtLocal: signal.firstMentionedAt || nowLocal,
        updatedAtLocal: signal.lastMentionedAt || nowLocal,
      },
    };
  }

  // Low/medium protective => hypothesis
  if (isProtective && (conf === 'low' || conf === 'medium')) {
    return {
      memoryHypothesis: {
        id: signal.id || `hyp_prot_${text.slice(0, 15).replace(/\s/g, '_')}`,
        persona,
        domain,
        hypothesis: truncateAnchorText(text, MAX_TEXT_LENGTH) || text.slice(0, MAX_TEXT_LENGTH),
        sourceLayer: 'distillation_dat',
        certainty: mapConfidenceToClinicalMemoryCertainty(conf, false),
        evidence: [evidence],
        usePermissions: inferDist01UsePermissions({ confidence: conf, hasEvidence: true }),
        needsUserConfirmation: true,
        createdAtLocal: signal.firstMentionedAt || nowLocal,
        updatedAtLocal: signal.lastMentionedAt || nowLocal,
      },
    };
  }

  // Default: hypothesis
  return {
    memoryHypothesis: {
      id: signal.id || `hyp_sig_${text.slice(0, 15).replace(/\s/g, '_')}`,
      persona,
      domain,
      hypothesis: truncateAnchorText(text, MAX_TEXT_LENGTH) || text.slice(0, MAX_TEXT_LENGTH),
      sourceLayer: 'distillation_dat',
      certainty: mapConfidenceToClinicalMemoryCertainty(conf, false),
      evidence: [evidence],
      usePermissions: inferDist01UsePermissions({ confidence: conf, hasEvidence: true }),
      needsUserConfirmation: true,
      createdAtLocal: signal.firstMentionedAt || nowLocal,
      updatedAtLocal: signal.lastMentionedAt || nowLocal,
    },
  };
}

// ─── 4. mapDist01ContextToCMD ─────────────────────────────────────────────
export function mapDist01ContextToCMD(input: {
  context: Dist01BridgeContextInput;
  persona: ClinicalMemoryPersona;
  nowLocal: string;
}): { memoryFact?: MemoryFact; memoryHypothesis?: MemoryHypothesis; protectiveFactor?: ProtectiveFactor } {
  const { context, persona, nowLocal } = input;
  const text = context.label || context.text || '';
  if (!text.trim()) return {};

  const evidence = createDist01EvidenceItem({
    id: context.id ? `ev_${context.id}` : undefined,
    sourceField: 'context',
    text: context.sourceText || text,
    timestampLocal: context.lastMentionedAt || context.firstMentionedAt,
    confidence: context.confidence,
    persona,
    isUserAuthored: context.userAuthored,
  });
  if (!evidence) return {};

  const domain = classifyDist01Domain({ type: context.type, label: context.label, text: context.text });
  const conf = (context.confidence === 'high' || context.confidence === 'medium' || context.confidence === 'low') ? context.confidence : undefined;

  // life_event high confidence => MemoryFact
  if (context.type === 'life_event' && conf === 'high') {
    return {
      memoryFact: {
        id: context.id || `fact_ctx_${text.slice(0, 15).replace(/\s/g, '_')}`,
        persona,
        domain,
        text: truncateAnchorText(text, MAX_TEXT_LENGTH) || text.slice(0, MAX_TEXT_LENGTH),
        sourceLayer: 'distillation_dat',
        certainty: 'high_confidence_inference',
        freshness: 'unknown',
        evidence: [evidence],
        usePermissions: inferDist01UsePermissions({ confidence: 'high', hasEvidence: true }),
        createdAtLocal: context.firstMentionedAt || nowLocal,
        updatedAtLocal: context.lastMentionedAt || nowLocal,
      },
    };
  }

  // goal/value high confidence => ProtectiveFactor
  if ((context.type === 'goal' || context.type === 'value') && conf === 'high') {
    return {
      protectiveFactor: {
        id: context.id || `prot_ctx_${text.slice(0, 15).replace(/\s/g, '_')}`,
        persona,
        domain: domain === 'unknown' ? 'protective_factor' : domain,
        factor: truncateAnchorText(text, MAX_TEXT_LENGTH) || text.slice(0, MAX_TEXT_LENGTH),
        strength: 'medium',
        evidence: [evidence],
        usePermissions: inferDist01UsePermissions({ confidence: 'high', isProtective: true, hasEvidence: true }),
      },
    };
  }

  // fear context => MemoryHypothesis (NEVER ProjectionMarker)
  // low/medium confidence => MemoryHypothesis
  return {
    memoryHypothesis: {
      id: context.id || `hyp_ctx_${text.slice(0, 15).replace(/\s/g, '_')}`,
      persona,
      domain,
      hypothesis: truncateAnchorText(text, MAX_TEXT_LENGTH) || text.slice(0, MAX_TEXT_LENGTH),
      sourceLayer: 'distillation_dat',
      certainty: mapConfidenceToClinicalMemoryCertainty(conf, false),
      evidence: [evidence],
      usePermissions: inferDist01UsePermissions({ confidence: conf, hasEvidence: true }),
      needsUserConfirmation: true,
      createdAtLocal: context.firstMentionedAt || nowLocal,
      updatedAtLocal: context.lastMentionedAt || nowLocal,
    },
  };
}

// ─── 9. buildRecoveryChainCandidatesFromDist01 ────────────────────────────
export function buildRecoveryChainCandidatesFromDist01(input: {
  persona: ClinicalMemoryPersona;
  signals: Dist01BridgeSignalInput[];
  nowLocal: string;
}): RecoveryChain[] {
  if (input.persona !== 'elias') return [];

  const domainSignals = input.signals.map(s => ({
    domain: classifyDist01Domain({ type: s.type, label: s.label, text: s.text, category: s.category }),
    signal: s,
  }));

  const hasTrigger = domainSignals.some(d => ['craving', 'relapse_risk', 'emotional_overload', 'loneliness'].includes(d.domain));
  const hasCraving = domainSignals.some(d => d.domain === 'craving');
  const hasShame = domainSignals.some(d => ['shame', 'self_hatred'].includes(d.domain));
  const hasAvoidance = domainSignals.some(d => d.domain === 'avoidance');
  const hasSupport = domainSignals.some(d => d.domain === 'support');
  const hasBodyState = domainSignals.some(d => ['body_state', 'sleep'].includes(d.domain));

  const chainLinks: string[] = [];
  if (hasTrigger) chainLinks.push('trigger');
  if (hasCraving) chainLinks.push('craving');
  if (hasShame) chainLinks.push('shame');
  if (hasAvoidance) chainLinks.push('avoidance');
  if (hasSupport) chainLinks.push('support');
  if (hasBodyState) chainLinks.push('body_state');

  if (chainLinks.length < 3) return [];

  const evidence: MemoryEvidenceItem[] = domainSignals
    .filter(d => chainLinks.includes(d.domain) || (d.domain === 'craving' && chainLinks.includes('craving')))
    .slice(0, 5)
    .map(d => createDist01EvidenceItem({
      sourceField: 'signal',
      text: d.signal.label || d.signal.text || '',
      timestampLocal: d.signal.lastMentionedAt,
      confidence: d.signal.confidence,
      persona: input.persona,
    }))
    .filter((e): e is MemoryEvidenceItem => e !== null);

  if (evidence.length < 2) return [];

  return [{
    id: `recovery_chain_dist01_${input.persona}`,
    persona: 'elias',
    chain: chainLinks,
    trigger: hasTrigger ? (domainSignals.find(d => ['craving', 'relapse_risk', 'emotional_overload', 'loneliness'].includes(d.domain))?.signal.label || undefined) : undefined,
    bodyState: hasBodyState ? (domainSignals.find(d => ['body_state', 'sleep'].includes(d.domain))?.signal.label || undefined) : undefined,
    emotion: hasShame ? (domainSignals.find(d => ['shame', 'self_hatred'].includes(d.domain))?.signal.label || undefined) : undefined,
    cravingMovement: hasCraving ? (domainSignals.find(d => d.domain === 'craving')?.signal.label || undefined) : undefined,
    avoidanceOrUse: hasAvoidance ? (domainSignals.find(d => d.domain === 'avoidance')?.signal.label || undefined) : undefined,
    shameAftermath: hasShame ? 'detected' : undefined,
    recoveryAction: hasSupport ? (domainSignals.find(d => d.domain === 'support')?.signal.label || undefined) : undefined,
    evidence,
    certainty: 'medium_confidence_inference' as ClinicalMemoryCertainty,
    usePermissions: ['may_use_in_formulation', 'may_use_only_as_hypothesis', 'may_not_use_as_fact'] as ClinicalMemoryUsePermission[],
  }];
}

// ─── 10. buildRelationalPatternCandidatesFromDist01 ───────────────────────
export function buildRelationalPatternCandidatesFromDist01(input: {
  persona: ClinicalMemoryPersona;
  signals: Dist01BridgeSignalInput[];
  nowLocal: string;
}): RelationalPattern[] {
  if (input.persona !== 'kim') return [];

  const domainSignals = input.signals.map(s => ({
    domain: classifyDist01Domain({ type: s.type, label: s.label, text: s.text, category: s.category }),
    signal: s,
  }));

  const relationalDomains: ClinicalMemoryDomain[] = ['trust', 'lying', 'betrayal', 'boundary_pressure', 'control', 'intimacy', 'grief', 'child_trust'];
  const matchedDomains = [...new Set(domainSignals.filter(d => relationalDomains.includes(d.domain)).map(d => d.domain))];

  if (matchedDomains.length < 3) return [];

  const evidence: MemoryEvidenceItem[] = domainSignals
    .filter(d => relationalDomains.includes(d.domain))
    .slice(0, 5)
    .map(d => createDist01EvidenceItem({
      sourceField: 'signal',
      text: d.signal.label || d.signal.text || '',
      timestampLocal: d.signal.lastMentionedAt,
      confidence: d.signal.confidence,
      persona: input.persona,
    }))
    .filter((e): e is MemoryEvidenceItem => e !== null);

  if (evidence.length < 2) return [];

  const hasRepeatedHarm = domainSignals.some(d =>
    relationalDomains.includes(d.domain) && ((d.signal.mentionCount ?? 0) + (d.signal.reinforcementCount ?? 0)) >= 3
  );

  return [{
    id: `relational_pattern_dist01_${input.persona}`,
    persona: 'kim',
    pattern: matchedDomains as string[],
    activeDomains: matchedDomains,
    harmRepeated: hasRepeatedHarm,
    boundaryPressure: matchedDomains.includes('boundary_pressure'),
    repairPossibleConditions: [],
    evidence,
    certainty: 'medium_confidence_inference' as ClinicalMemoryCertainty,
    usePermissions: ['may_use_in_formulation', 'may_use_only_as_hypothesis', 'may_not_use_as_fact'] as ClinicalMemoryUsePermission[],
  }];
}

// ─── 11. buildDist01CMDContextParts ───────────────────────────────────────
export function buildDist01CMDContextParts(input: Dist01CmdBridgeInput): {
  memoryFacts: MemoryFact[];
  memoryHypotheses: MemoryHypothesis[];
  recurrentPatterns: RecurrentPattern[];
  riskMarkers: RiskMarker[];
  protectiveFactors: ProtectiveFactor[];
  recoveryChains: RecoveryChain[];
  relationalPatterns: RelationalPattern[];
} {
  const output = buildCMDFromDist01(input);
  const recoveryChains = buildRecoveryChainCandidatesFromDist01({ persona: input.persona, signals: input.signals, nowLocal: input.nowLocal });
  const relationalPatterns = buildRelationalPatternCandidatesFromDist01({ persona: input.persona, signals: input.signals, nowLocal: input.nowLocal });

  return {
    memoryFacts: output.memoryFacts,
    memoryHypotheses: output.memoryHypotheses,
    recurrentPatterns: output.recurrentPatterns,
    riskMarkers: output.riskMarkers,
    protectiveFactors: output.protectiveFactors,
    recoveryChains,
    relationalPatterns,
  };
}

// ─── 1. buildCMDFromDist01 (main orchestrator) ────────────────────────────
export function buildCMDFromDist01(input: Dist01CmdBridgeInput): Dist01CmdBridgeOutput {
  const { persona, entities, signals, contexts, nowLocal } = input;
  const output: Dist01CmdBridgeOutput = {
    memoryFacts: [],
    memoryHypotheses: [],
    recurrentPatterns: [],
    riskMarkers: [],
    protectiveFactors: [],
    evidenceItems: [],
    skippedItems: [],
    warnings: [],
  };

  // Process entities
  for (const entity of entities) {
    const skipCheck = shouldSkipDist01Item({ persona: persona, text: entity.label || entity.text, label: entity.label, type: entity.type, confidence: entity.confidence, expectedPersona: persona });
    if (skipCheck.skip) {
      output.skippedItems.push({ item: entity, reason: skipCheck.reason || 'unknown' });
      continue;
    }
    const result = mapDist01EntityToMemory({ entity, persona, nowLocal });
    if (!result) { output.skippedItems.push({ item: entity, reason: 'mapping_returned_null' }); continue; }
    if ('text' in result && 'freshness' in result) {
      output.memoryFacts.push(result as MemoryFact);
      output.evidenceItems.push(...(result as MemoryFact).evidence);
    } else {
      output.memoryHypotheses.push(result as MemoryHypothesis);
      output.evidenceItems.push(...(result as MemoryHypothesis).evidence);
    }
  }

  // Process signals
  for (const signal of signals) {
    const skipCheck = shouldSkipDist01Item({ persona: persona, text: signal.label || signal.text, label: signal.label, type: signal.type, confidence: signal.confidence, expectedPersona: persona });
    if (skipCheck.skip) {
      output.skippedItems.push({ item: signal, reason: skipCheck.reason || 'unknown' });
      continue;
    }
    const result = mapDist01SignalToCMD({ signal, persona, nowLocal });
    if (result.riskMarker) { output.riskMarkers.push(result.riskMarker); output.evidenceItems.push(...result.riskMarker.evidence); }
    if (result.protectiveFactor) { output.protectiveFactors.push(result.protectiveFactor); output.evidenceItems.push(...result.protectiveFactor.evidence); }
    if (result.recurrentPattern) { output.recurrentPatterns.push(result.recurrentPattern); output.evidenceItems.push(...result.recurrentPattern.evidence); }
    if (result.memoryFact) { output.memoryFacts.push(result.memoryFact); output.evidenceItems.push(...result.memoryFact.evidence); }
    if (result.memoryHypothesis) { output.memoryHypotheses.push(result.memoryHypothesis); output.evidenceItems.push(...result.memoryHypothesis.evidence); }
    if (!result.riskMarker && !result.protectiveFactor && !result.recurrentPattern && !result.memoryFact && !result.memoryHypothesis) {
      output.skippedItems.push({ item: signal, reason: 'no_mapping_produced' });
    }
  }

  // Process contexts
  for (const ctx of contexts) {
    const skipCheck = shouldSkipDist01Item({ persona: persona, text: ctx.label || ctx.text, label: ctx.label, type: ctx.type, confidence: ctx.confidence, expectedPersona: persona });
    if (skipCheck.skip) {
      output.skippedItems.push({ item: ctx, reason: skipCheck.reason || 'unknown' });
      continue;
    }
    const result = mapDist01ContextToCMD({ context: ctx, persona, nowLocal });
    if (result.memoryFact) { output.memoryFacts.push(result.memoryFact); output.evidenceItems.push(...result.memoryFact.evidence); }
    if (result.protectiveFactor) { output.protectiveFactors.push(result.protectiveFactor); output.evidenceItems.push(...result.protectiveFactor.evidence); }
    if (result.memoryHypothesis) { output.memoryHypotheses.push(result.memoryHypothesis); output.evidenceItems.push(...result.memoryHypothesis.evidence); }
    if (!result.memoryFact && !result.protectiveFactor && !result.memoryHypothesis) {
      output.skippedItems.push({ item: ctx, reason: 'no_mapping_produced' });
    }
  }

  return output;
}
