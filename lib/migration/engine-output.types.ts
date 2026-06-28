/**
 * ══════════════════════════════════════════════════════════════════════════
 * CANONICAL ENGINE OUTPUT (for shadow comparison)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * This defines the normalized output shape that both client and server
 * produce for comparison purposes. Not all fields are deterministic —
 * GPT response text is compared on safety/metadata only, not verbatim.
 *
 * Compare minimally:
 *   - riskLevel, crisisLevel, emotionalState
 *   - dominantModule, moduleActivations
 *   - zoneScore, zoneColor
 *   - liveIntent, intensityTrajectory, currentEmotion
 *   - responseDirection, regulationResult, moodTrend
 *   - relapseIntentDetected, projectionUpdates, newTriggers
 *   - loopDetected, showEmergency, selectedModel, status
 *   - clinicalAnnotation presence when clinicalModeActive
 */

// ─── Regulation Result (normalized) ───────────────────────────────────

export interface NormalizedRegulationResult {
  action: 'reflect' | 'slow_down' | 'regulate' | 'stabilize' | 'ground';
  zone: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED' | 'PURPLE';
  effectiveDepth: string;
  wasSoftened: boolean;
  wasSkipped: boolean;
  hasIntervention: boolean;
}

// ─── Projection Update ────────────────────────────────────────────────

export interface NormalizedProjectionUpdate {
  category: 'fears' | 'hopes' | 'goals' | 'triggers' | 'schemaTendencies';
  content: string;
  strength: number;
  isNew: boolean;
}

// ─── Module Activation ────────────────────────────────────────────────

export interface NormalizedModuleActivation {
  moduleId: string;
  confidence: number;
  mode: string;
}

// ─── Canonical Engine Output ──────────────────────────────────────────

/**
 * The canonical EngineOutput comparison object.
 * Both client and server normalize their output to this shape for shadow comparison.
 */
export interface CanonicalEngineOutput {
  // ── Risk & Safety ──
  /** Risk level: low, moderate, high, critical. */
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  /** Crisis level: 0 = none, 1 = elevated, 2 = active crisis. */
  crisisLevel: number;
  /** Whether emergency card should be shown. */
  showEmergency: boolean;
  /** Whether relapse intent was detected. */
  relapseIntentDetected: boolean;

  // ── Emotional State ──
  /** Emotional state: stable, vulnerable, depleted, crisis. */
  emotionalState: 'stable' | 'vulnerable' | 'depleted' | 'crisis';
  /** Current detected emotion from text. */
  currentEmotion: string;
  /** Mood trend: improving, stable, declining, volatile. */
  moodTrend: 'improving' | 'stable' | 'declining' | 'volatile';

  // ── Module Selection ──
  /** The dominant module selected for this response. */
  dominantModule: string;
  /** All active module activations. */
  moduleActivations: NormalizedModuleActivation[];
  /** Whether loop was detected (module repeated). */
  loopDetected: boolean;

  // ── Zone ──
  /** Zone score (0-100). */
  zoneScore: number;
  /** Zone color: GREEN, YELLOW, ORANGE, RED, PURPLE. */
  zoneColor: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED' | 'PURPLE';

  // ── Intent & Direction ──
  /** Live intent detected from user message. */
  liveIntent: 'venting' | 'reflecting' | 'seeking_action' | 'seeking_reassurance' | 'testing' | 'withdrawing' | 'crisis' | 'neutral';
  /** Intensity trajectory within session. */
  intensityTrajectory: 'rising' | 'stable' | 'falling';
  /** Response direction computed from zone + intent. */
  responseDirection: 'stabilize' | 'reflect' | 'direct' | 'contain' | 'crisis_override' | 'explore';

  // ── Regulation ──
  /** Regulation result (normalized). */
  regulationResult: NormalizedRegulationResult;

  // ── Projections & Triggers ──
  /** Projection updates to write back. */
  projectionUpdates: NormalizedProjectionUpdate[];
  /** New triggers detected. */
  newTriggers: string[];

  // ── GPT / Model ──
  /** Selected model for GPT call. */
  selectedModel: string;
  /** Pipeline status. */
  status: 'OK' | 'BLOCKED_PRECHAT_REQUIRED' | 'CRISIS_MODE';
  /** Whether clinical annotation is present (only when clinicalModeActive). */
  clinicalAnnotationPresent: boolean;
}

// ─── State Patches ────────────────────────────────────────────────────

/**
 * State patches returned by server for client to write locally.
 * Client validates schema, persona, sessionId/turnId before writing.
 */
export interface EngineStatePatches {
  /** Safety patches (applied first, blocking if critical). */
  safety?: {
    crisisLevel?: number;
    riskLevel?: string;
    showEmergency?: boolean;
    relapseIntentLog?: { confidence: number; markers: string[]; timestamp: string };
  };
  /** Session state patches. */
  sessionState?: {
    zoneScore?: number;
    zoneColor?: string;
    emotionalState?: string;
    dominantModule?: string;
    moduleActivations?: NormalizedModuleActivation[];
    regulationResult?: NormalizedRegulationResult;
  };
  /** Memory patches (non-blocking, retry on failure). */
  memory?: {
    triggerPatterns?: Array<{ trigger: string; frequency: number; lastSeen: string }>;
    moduleUsage?: Array<{ moduleId: string; count: number; lastUsed: string }>;
    projectionUpdates?: NormalizedProjectionUpdate[];
    vspInsight?: { framework: string; discrepancy: boolean };
    pastReferenceUse?: { referenced: boolean; context: string };
  };
  /** Logs patch. */
  logs?: {
    sessionEventSummary?: string;
    moduleActivationSummary?: string;
  };
  /** Greeting/cycle patch. */
  greetingCycle?: {
    lastSessionDate?: string;
    cycleTimestamp?: string;
    sessionStartedAtDeviceIso?: string;
  };
}

// ─── Full Engine Process Response ─────────────────────────────────────

/**
 * Complete response from /api/engine-process.
 */
export interface EngineProcessResponse {
  /** The AI-generated response text. */
  response: string;
  /** Normalized engine output for comparison. */
  engineOutput: CanonicalEngineOutput;
  /** State patches for client to write locally. */
  statePatches: EngineStatePatches;
  /** Session ID for idempotency. */
  sessionId: string;
  /** Turn ID for idempotency. */
  turnId: string;
  /** Token usage metadata. */
  tokenUsage?: { input: number; output: number; total: number };
  /** Latency in ms. */
  latencyMs?: number;
  /** Engine version hash for shadow comparison. */
  engineVersion: string;
}
