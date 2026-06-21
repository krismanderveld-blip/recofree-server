/**
 * Session Greeting V3 — Synthesis Candidate Builder (Redesigned)
 *
 * Builds a list of eligible synthesis sources with relevance scores.
 * 
 * REDESIGN PRINCIPLES:
 * 1. Most recent source = heaviest weight (timestamp-based recency bonus)
 * 2. Every VSP zone has a reference pattern (not just ROOD/PAARS/ORANJE)
 * 3. Zone modifies source weights: GEEL suppresses positive, boosts negative
 * 4. Sources are scored on: base relevance × zone modifier × recency rank bonus
 *
 * Source types:
 * - TODAY_MOOD: sliders filled today → mood metric interpretation
 * - RECENT_DIARY: diary < 3 days → safe anchor text
 * - RECENT_GRATITUDE: gratitude < 3 days → safe anchor text
 * - BACKPACK_RECENT_UPDATE: backpack < 24h → generic acknowledgment
 * - ACTIVE_HOPE_OR_FEAR: active projection with decay >= 0.60
 * - SCHEMA_ROTATION: every 4th session, cycle through schemas
 * - LAST_SESSION_SUMMARY: logs.dat open loops or digest
 */

import type {
  GreetingFreshnessResult,
  GreetingUserDatSnapshot,
  GreetingStateDatSnapshot,
  GreetingProjectionsDatSnapshot,
  GreetingDiaryMetadata,
  GreetingGratitudeMetadata,
  GreetingLogsDatSnapshot,
} from './sessionGreeting.types';
import type {
  GreetingSynthesisCandidate,
  MoodMetricSelection,
} from './sessionGreetingV3.types';
import {
  V3_ACTIVE_PROJECTION_DECAY_THRESHOLD,
  V3_SCHEMA_ROTATION_INTERVAL,
} from './sessionGreetingV3.types';
import { selectMostEmotionallyRelevantMoodMetric, buildMoodSafeAnchor } from './selectMoodMetric';
import { resolveSchemaRotationAnchor } from './resolveSchemaRotationAnchor';

export interface BuildSynthesisCandidatesInput {
  userDat: GreetingUserDatSnapshot | null;
  stateDat: GreetingStateDatSnapshot | null;
  projectionsDat: GreetingProjectionsDatSnapshot | null;
  logsDat: GreetingLogsDatSnapshot | null;
  diaryMetadata: GreetingDiaryMetadata | null;
  gratitudeMetadata: GreetingGratitudeMetadata | null;
  freshness: GreetingFreshnessResult;
}

export interface BuildSynthesisCandidatesResult {
  candidates: GreetingSynthesisCandidate[];
  moodMetric: MoodMetricSelection | null;
}

// ─── Zone Reference Patterns ─────────────────────────────────────────────────

type SourceValence = 'positive' | 'negative' | 'neutral';

interface ZoneModifiers {
  positiveMultiplier: number;   // applied to positive-valence sources
  negativeMultiplier: number;   // applied to negative-valence sources
  neutralMultiplier: number;    // applied to neutral-valence sources
}

/**
 * Each zone defines how source weights are modified.
 * GROEN: balanced, positive welcome
 * GEEL: suppress positive, boost negative/uncertain — something is brewing
 * ORANJE/ROOD/PAARS: handled by CRISIS_OVERRIDE, but if reached here, strongly suppress positive
 */
const ZONE_MODIFIERS: Record<string, ZoneModifiers> = {
  GROEN: { positiveMultiplier: 1.0, negativeMultiplier: 1.0, neutralMultiplier: 1.0 },
  GEEL: { positiveMultiplier: 0.55, negativeMultiplier: 1.25, neutralMultiplier: 1.0 },
  ORANJE: { positiveMultiplier: 0.35, negativeMultiplier: 1.40, neutralMultiplier: 0.90 },
  ROOD: { positiveMultiplier: 0.20, negativeMultiplier: 1.50, neutralMultiplier: 0.80 },
  PAARS: { positiveMultiplier: 0.20, negativeMultiplier: 1.50, neutralMultiplier: 0.80 },
};

function getZoneModifiers(vspZone: string | undefined): ZoneModifiers {
  const zone = (vspZone ?? 'GROEN').toUpperCase();
  return ZONE_MODIFIERS[zone] ?? ZONE_MODIFIERS['GROEN'];
}

// ─── Main Builder ────────────────────────────────────────────────────────────

export function buildGreetingSynthesisCandidates(
  input: BuildSynthesisCandidatesInput,
): BuildSynthesisCandidatesResult {
  const { userDat, stateDat, projectionsDat, logsDat, diaryMetadata, gratitudeMetadata, freshness } = input;
  const candidates: GreetingSynthesisCandidate[] = [];
  const vspZone = stateDat?.vspZone;
  const zoneMods = getZoneModifiers(vspZone);

  // Collect timestamps for recency ranking
  const sourceTimestamps: { sourceType: string; timestamp: number }[] = [];

  // ─── 1. TODAY_MOOD ──────────────────────────────────────────────────────────
  const moodMetric = selectMostEmotionallyRelevantMoodMetric(stateDat, freshness.slidersFilledToday);

  if (moodMetric) {
    const baseRelevance = computeMoodRelevance(moodMetric);
    const valence = getMoodValence(moodMetric);
    const zoneAdjusted = applyZoneModifier(baseRelevance, valence, zoneMods);
    candidates.push({
      sourceType: 'TODAY_MOOD',
      eligible: true,
      relevanceScore: zoneAdjusted,
      reason: `Mood metric: ${moodMetric.metricName}=${moodMetric.value} (${moodMetric.interpretation}) [zone=${vspZone ?? 'GROEN'}]`,
      safeAnchor: buildMoodSafeAnchor(moodMetric),
    });
    // Sliders filled today → timestamp is "now" (most recent possible)
    if (stateDat?.moodLastUpdatedAt) {
      sourceTimestamps.push({ sourceType: 'TODAY_MOOD', timestamp: new Date(stateDat.moodLastUpdatedAt).getTime() });
    }
  } else {
    candidates.push({
      sourceType: 'TODAY_MOOD',
      eligible: false,
      relevanceScore: 0,
      reason: freshness.slidersFilledToday ? 'Sliders filled but no notable metric' : 'Sliders not filled today',
      safeAnchor: '',
    });
  }

  // ─── 2. RECENT_DIARY ────────────────────────────────────────────────────────
  if (freshness.diaryRecentUnder3Days && diaryMetadata?.latestSafeAnchor) {
    const diaryAge = freshness.latestDiaryAgeInDays ?? 3;
    // V3.2: Cap diary base relevance at 0.85 so it never outscores LAST_SESSION_SUMMARY (0.93-0.96).
    // Diary is supplementary context; the actual conversation content is the primary continuity source.
    const baseRelevance = Math.min(computeRecencyRelevance(diaryAge, 3), 0.85);
    // Diary is contextual — determine valence from content hints
    const valence = inferDiaryValence(diaryMetadata.latestSafeAnchor);
    const zoneAdjusted = applyZoneModifier(baseRelevance, valence, zoneMods);
    candidates.push({
      sourceType: 'RECENT_DIARY',
      eligible: true,
      relevanceScore: zoneAdjusted,
      reason: `Diary ${diaryAge.toFixed(1)} days old, valence=${valence} [zone=${vspZone ?? 'GROEN'}]`,
      safeAnchor: diaryMetadata.latestSafeAnchor,
    });
    if (diaryMetadata.latestEntryCreatedAt) {
      sourceTimestamps.push({ sourceType: 'RECENT_DIARY', timestamp: new Date(diaryMetadata.latestEntryCreatedAt).getTime() });
    }
  } else {
    candidates.push({
      sourceType: 'RECENT_DIARY',
      eligible: false,
      relevanceScore: 0,
      reason: 'No recent diary under 3 days',
      safeAnchor: '',
    });
  }

  // ─── 3. RECENT_GRATITUDE ────────────────────────────────────────────────────
  if (freshness.gratitudeRecentUnder3Days && gratitudeMetadata?.latestSafeAnchor) {
    const gratAge = freshness.latestGratitudeAgeInDays ?? 3;
    const baseRelevance = computeRecencyRelevance(gratAge, 3) * 0.85;
    // Gratitude is always positive valence
    const zoneAdjusted = applyZoneModifier(baseRelevance, 'positive', zoneMods);
    candidates.push({
      sourceType: 'RECENT_GRATITUDE',
      eligible: true,
      relevanceScore: zoneAdjusted,
      reason: `Gratitude ${gratAge.toFixed(1)} days old [zone=${vspZone ?? 'GROEN'}, suppressed=${zoneMods.positiveMultiplier < 1.0}]`,
      safeAnchor: gratitudeMetadata.latestSafeAnchor,
    });
    if (gratitudeMetadata.latestEntryCreatedAt) {
      sourceTimestamps.push({ sourceType: 'RECENT_GRATITUDE', timestamp: new Date(gratitudeMetadata.latestEntryCreatedAt).getTime() });
    }
  } else {
    candidates.push({
      sourceType: 'RECENT_GRATITUDE',
      eligible: false,
      relevanceScore: 0,
      reason: 'No recent gratitude under 3 days',
      safeAnchor: '',
    });
  }

  // ─── 4. BACKPACK_RECENT_UPDATE ("indien gewijzigd": analyzedAt > previousAnalyzedAt) ───
  if (freshness.backpackAnalysisChanged && userDat?.backpackAnalysisContent) {
    const ba = userDat.backpackAnalysisContent;
    // Build full content anchor — NO truncation
    const parts: string[] = [];
    if (ba.schemas.length > 0) parts.push(`Schema's: ${ba.schemas.map(s => `${s.name} (${(s.confidence * 100).toFixed(0)}%)`).join(', ')}`);
    if (ba.modi.length > 0) parts.push(`Modi: ${ba.modi.map(m => `${m.name} (${(m.confidence * 100).toFixed(0)}%)`).join(', ')}`);
    if (ba.triggers.length > 0) parts.push(`Triggers: ${ba.triggers.join(', ')}`);
    if (ba.coreBeliefs.length > 0) parts.push(`Kernovertuigingen: ${ba.coreBeliefs.join(', ')}`);
    if (ba.copingPatterns.length > 0) parts.push(`Copingpatronen: ${ba.copingPatterns.join(', ')}`);
    const fullContent = parts.join('\n');

    candidates.push({
      sourceType: 'BACKPACK_RECENT_UPDATE',
      eligible: true,
      relevanceScore: 0.85, // High relevance — new analysis is always important
      reason: 'Backpack analysis changed (analyzedAt > previousAnalyzedAt)',
      safeAnchor: fullContent,
    });
    if (userDat.backpackLastUpdatedAt) {
      sourceTimestamps.push({ sourceType: 'BACKPACK_RECENT_UPDATE', timestamp: new Date(userDat.backpackLastUpdatedAt).getTime() });
    }
  } else {
    candidates.push({
      sourceType: 'BACKPACK_RECENT_UPDATE',
      eligible: false,
      relevanceScore: 0,
      reason: 'Backpack analysis not changed since last session',
      safeAnchor: '',
    });
  }

  // ─── 5. ACTIVE_HOPE_OR_FEAR ─────────────────────────────────────────────────
  const fears = projectionsDat?.fears ?? [];
  const activeFear = fears
    .filter(f => f.decayScore >= V3_ACTIVE_PROJECTION_DECAY_THRESHOLD)
    .sort((a, b) => b.decayScore - a.decayScore)[0] ?? null;

  if (activeFear) {
    const baseRelevance = Math.min(activeFear.decayScore, 0.90);
    // Fears are negative valence → boosted in GEEL+
    const zoneAdjusted = applyZoneModifier(baseRelevance, 'negative', zoneMods);
    candidates.push({
      sourceType: 'ACTIVE_HOPE_OR_FEAR',
      eligible: true,
      relevanceScore: zoneAdjusted,
      reason: `Active fear: "${activeFear.label}" (decay=${activeFear.decayScore}) [zone=${vspZone ?? 'GROEN'}]`,
      safeAnchor: activeFear.label,
    });
    sourceTimestamps.push({ sourceType: 'ACTIVE_HOPE_OR_FEAR', timestamp: new Date(activeFear.lastReinforcedAt).getTime() });
  } else {
    candidates.push({
      sourceType: 'ACTIVE_HOPE_OR_FEAR',
      eligible: false,
      relevanceScore: 0,
      reason: 'No active fear/hope above threshold',
      safeAnchor: '',
    });
  }

  // ─── 6. SCHEMA_ROTATION ─────────────────────────────────────────────────────
  const sessionNumber = userDat?.sessionStats.currentSessionNumber ?? 0;
  const schemaResult = resolveSchemaRotationAnchor({
    currentSessionNumber: sessionNumber,
    schemaTendencies: userDat?.schemaTendencies ?? [],
    rotationState: userDat?.sessionStats.schemaRotationState,
  });

  if (schemaResult.selectedSchema) {
    // Schema rotation is neutral — not boosted or suppressed by zone
    candidates.push({
      sourceType: 'SCHEMA_ROTATION',
      eligible: true,
      relevanceScore: 0.65,
      reason: schemaResult.reason,
      safeAnchor: `thema rond ${schemaResult.selectedSchema.schemaName}`,
    });
  } else {
    candidates.push({
      sourceType: 'SCHEMA_ROTATION',
      eligible: false,
      relevanceScore: 0,
      reason: schemaResult.reason,
      safeAnchor: '',
    });
  }

  // ─── 7. LAST_SESSION_SUMMARY (from logs.dat — last 3 sessions for continuity) ──
  // PRIORITY FIX: Session continuity is the MOST important context for greeting.
  // Recent conversation content (what we actually talked about) must outweigh diary entries.
  if (logsDat && (logsDat.lastSessionOpenLoops.length > 0 || logsDat.latestLogDigest || (logsDat.recentSessionDigests && logsDat.recentSessionDigests.length > 0))) {
    const hasOpenLoops = logsDat.lastSessionOpenLoops.length > 0;
    const hasRecent = logsDat.recentSessionDigests && logsDat.recentSessionDigests.length > 0;
    // V3.2: Raised base scores — session content is PRIMARY context, always above diary (which maxes at ~0.85-1.0)
    const baseRelevance = hasOpenLoops ? 0.96 : hasRecent ? 0.93 : 0.85;
    const zoneAdjusted = applyZoneModifier(baseRelevance, 'neutral', zoneMods);

    // Build rich safeAnchor with last 3 session narratives
    let safeAnchor = '';
    if (hasRecent) {
      const digests = logsDat.recentSessionDigests!;
      const parts = digests.map((d, i) => {
        const label = i === 0 ? 'Laatste sessie' : i === 1 ? 'Sessie daarvoor' : 'Eerdere sessie';
        const topics = d.topics.length > 0 ? ` (thema's: ${d.topics.join(', ')})` : '';
        const open = d.openEndpoints.length > 0 ? ` [open: ${d.openEndpoints.join(', ')}]` : '';
        return `${label}: ${d.narrative}${topics}${open}`;
      });
      safeAnchor = parts.join('\n');
    } else if (hasOpenLoops) {
      safeAnchor = `Vorige sessie: ${logsDat.lastSessionOpenLoops.slice(0, 2).join(', ')}`;
    } else {
      safeAnchor = logsDat.latestLogDigest ?? '';
    }

    candidates.push({
      sourceType: 'LAST_SESSION_SUMMARY',
      eligible: true,
      relevanceScore: zoneAdjusted,
      reason: hasRecent
        ? `${logsDat.recentSessionDigests!.length} recent sessions available for continuity`
        : hasOpenLoops
          ? `${logsDat.lastSessionOpenLoops.length} open loops from last session`
          : 'Last session digest available',
      safeAnchor,
    });
    // V3.2: Add timestamp for recency bonus — use endedAt from most recent session digest
    if (hasRecent && logsDat.recentSessionDigests![0].endedAt) {
      sourceTimestamps.push({ sourceType: 'LAST_SESSION_SUMMARY', timestamp: new Date(logsDat.recentSessionDigests![0].endedAt).getTime() });
    }
  } else {
    candidates.push({
      sourceType: 'LAST_SESSION_SUMMARY',
      eligible: false,
      relevanceScore: 0,
      reason: 'No last session data available',
      safeAnchor: '',
    });
  }

  // ─── 8. RECURRING_PATTERN (cross-session theme from logs.dat) ────────────────
  if (logsDat?.recurringPatternAnchor && logsDat.recurringPatternConfidence && logsDat.recurringPatternConfidence >= 0.4) {
    const baseRelevance = Math.min(logsDat.recurringPatternConfidence * 0.90, 0.85);
    // Recurring patterns are neutral — they are observational, not emotional
    const zoneAdjusted = applyZoneModifier(baseRelevance, 'neutral', zoneMods);
    candidates.push({
      sourceType: 'RECURRING_PATTERN',
      eligible: true,
      relevanceScore: zoneAdjusted,
      reason: `Recurring pattern detected (confidence=${logsDat.recurringPatternConfidence.toFixed(2)})`,
      safeAnchor: logsDat.recurringPatternAnchor,
    });
  } else {
    candidates.push({
      sourceType: 'RECURRING_PATTERN',
      eligible: false,
      relevanceScore: 0,
      reason: 'No recurring pattern detected or insufficient confidence',
      safeAnchor: '',
    });
  }

  // ─── Apply Recency Rank Bonus ───────────────────────────────────────────────
  // Sort timestamps descending (most recent first)
  // Most recent eligible source gets +0.15, second +0.08, third +0.03
  const RECENCY_BONUSES = [0.15, 0.08, 0.03];
  if (sourceTimestamps.length > 0) {
    const sorted = [...sourceTimestamps].sort((a, b) => b.timestamp - a.timestamp);
    for (let i = 0; i < Math.min(sorted.length, RECENCY_BONUSES.length); i++) {
      const bonus = RECENCY_BONUSES[i];
      const candidate = candidates.find(c => c.sourceType === sorted[i].sourceType && c.eligible);
      if (candidate) {
        candidate.relevanceScore = Math.min(candidate.relevanceScore + bonus, 1.0);
        candidate.reason += ` +recency_rank_${i + 1}(+${bonus})`;
      }
    }
  }

  return { candidates, moodMetric };
}

// ─── Scoring Helpers ──────────────────────────────────────────────────────────

/**
 * Computes relevance based on recency (0 = max age, 1 = just now).
 * Linear decay from 1.0 to 0.3 over the maxAge window.
 */
function computeRecencyRelevance(ageInUnits: number, maxAgeInUnits: number): number {
  if (ageInUnits <= 0) return 1.0;
  if (ageInUnits >= maxAgeInUnits) return 0.3;
  return 1.0 - (ageInUnits / maxAgeInUnits) * 0.7;
}

/**
 * Computes mood relevance based on interpretation.
 */
function computeMoodRelevance(metric: MoodMetricSelection): number {
  switch (metric.interpretation) {
    case 'high_alarm': return 0.95;
    case 'elevated': return 0.80;
    case 'positive': return 0.70;
    case 'neutral': return 0.50;
    default: return 0.40;
  }
}

/**
 * Determines the valence of a mood metric for zone weighting.
 */
function getMoodValence(metric: MoodMetricSelection): SourceValence {
  if (metric.interpretation === 'positive') return 'positive';
  if (metric.interpretation === 'high_alarm' || metric.interpretation === 'elevated') return 'negative';
  return 'neutral';
}

/**
 * Infers diary entry valence from content keywords.
 * This is a simple heuristic — negative/uncertain words → negative valence.
 */
function inferDiaryValence(safeAnchor: string): SourceValence {
  const lower = safeAnchor.toLowerCase();
  const negativeIndicators = [
    'onzeker', 'bang', 'angst', 'moeilijk', 'zwaar', 'verdrietig', 'eenzaam',
    'moe', 'gefrustreerd', 'boos', 'pijn', 'stress', 'spanning', 'terugval',
    'craving', 'verlangen', 'twijfel', 'wanhoop', 'somber', 'slecht',
    'uncertain', 'afraid', 'anxious', 'difficult', 'heavy', 'sad', 'lonely',
    'tired', 'frustrated', 'angry', 'pain', 'stressed', 'relapse', 'doubt',
  ];
  const positiveIndicators = [
    'blij', 'trots', 'dankbaar', 'rustig', 'goed', 'fijn', 'positief',
    'happy', 'proud', 'grateful', 'calm', 'good', 'nice', 'positive',
    'sterk', 'kracht', 'strong', 'progress', 'vooruitgang',
  ];

  const hasNegative = negativeIndicators.some(word => lower.includes(word));
  const hasPositive = positiveIndicators.some(word => lower.includes(word));

  if (hasNegative && !hasPositive) return 'negative';
  if (hasPositive && !hasNegative) return 'positive';
  if (hasNegative && hasPositive) return 'neutral'; // mixed
  return 'neutral'; // no clear signal
}

/**
 * Applies zone modifier to a base relevance score based on source valence.
 */
function applyZoneModifier(baseRelevance: number, valence: SourceValence, mods: ZoneModifiers): number {
  switch (valence) {
    case 'positive': return baseRelevance * mods.positiveMultiplier;
    case 'negative': return baseRelevance * mods.negativeMultiplier;
    case 'neutral': return baseRelevance * mods.neutralMultiplier;
  }
}
