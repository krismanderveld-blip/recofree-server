/**
 * Cross-Session Pattern Detection Engine
 *
 * Analyzes multiple session summaries from logs.dat to detect recurring themes.
 * Patterns are detected by:
 * 1. Topic frequency — topics appearing in 3+ sessions
 * 2. Emotional theme recurrence — same emotional label in 3+ sessions
 * 3. Temporal clustering — events correlating with day-of-week or time patterns
 * 4. Risk pattern repetition — same risk events recurring
 *
 * Output: a list of detected patterns with confidence and a safe anchor string
 * suitable for the greeting engine.
 *
 * Design: purely deterministic, no LLM call. Runs at greeting-init time.
 * Graceful: returns empty array if fewer than 3 sessions available.
 */

import type { SessionLogSummary } from '@/lib/types/memory/logsDat.types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RecurringPattern {
  patternType: 'topic' | 'emotional_theme' | 'temporal' | 'risk_event';
  label: string;
  confidence: number; // 0.0 - 1.0
  occurrenceCount: number;
  totalSessions: number;
  /** Human-readable safe anchor for the greeting prompt */
  safeAnchor: string;
  /** Optional: day-of-week if temporal pattern */
  dayOfWeek?: string;
}

export interface PatternDetectionResult {
  patterns: RecurringPattern[];
  /** The single best pattern to surface in the greeting (highest confidence) */
  bestPattern: RecurringPattern | null;
  /** Debug info */
  debugSummary: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Minimum sessions needed before pattern detection activates */
const MIN_SESSIONS_FOR_DETECTION = 3;

/** Minimum occurrence ratio (occurrences / total sessions) for a pattern to be valid */
const MIN_OCCURRENCE_RATIO = 0.3; // appears in at least 30% of sessions

/** Minimum absolute occurrences */
const MIN_ABSOLUTE_OCCURRENCES = 3;

/** Maximum patterns to return */
const MAX_PATTERNS = 5;

/** Day names for temporal detection */
const DAY_NAMES_NL = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

// ─── Main Detection Function ─────────────────────────────────────────────────

export function detectRecurringPatterns(sessions: SessionLogSummary[]): PatternDetectionResult {
  if (sessions.length < MIN_SESSIONS_FOR_DETECTION) {
    return {
      patterns: [],
      bestPattern: null,
      debugSummary: `Insufficient sessions (${sessions.length}/${MIN_SESSIONS_FOR_DETECTION})`,
    };
  }

  const totalSessions = sessions.length;
  const allPatterns: RecurringPattern[] = [];

  // 1. Topic frequency analysis
  const topicPatterns = detectTopicPatterns(sessions, totalSessions);
  allPatterns.push(...topicPatterns);

  // 2. Emotional theme recurrence
  const emotionalPatterns = detectEmotionalPatterns(sessions, totalSessions);
  allPatterns.push(...emotionalPatterns);

  // 3. Temporal clustering (day-of-week patterns)
  const temporalPatterns = detectTemporalPatterns(sessions, totalSessions);
  allPatterns.push(...temporalPatterns);

  // 4. Risk event repetition
  const riskPatterns = detectRiskPatterns(sessions, totalSessions);
  allPatterns.push(...riskPatterns);

  // Sort by confidence descending, take top N
  const sorted = allPatterns
    .filter(p => p.confidence >= 0.4) // minimum confidence threshold
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_PATTERNS);

  const bestPattern = sorted.length > 0 ? sorted[0] : null;

  return {
    patterns: sorted,
    bestPattern,
    debugSummary: `Detected ${sorted.length} patterns from ${totalSessions} sessions. Best: ${bestPattern?.label ?? 'none'} (${bestPattern?.confidence.toFixed(2) ?? '0'})`,
  };
}

// ─── Topic Pattern Detection ─────────────────────────────────────────────────

function detectTopicPatterns(sessions: SessionLogSummary[], totalSessions: number): RecurringPattern[] {
  const topicCounts = new Map<string, number>();

  for (const session of sessions) {
    // Use a Set to count each topic only once per session
    const sessionTopics = new Set(
      (session.discussedTopics ?? []).map(t => normalizeTopic(t))
    );
    for (const topic of sessionTopics) {
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
    }
  }

  const patterns: RecurringPattern[] = [];
  for (const [topic, count] of topicCounts) {
    const ratio = count / totalSessions;
    if (count >= MIN_ABSOLUTE_OCCURRENCES && ratio >= MIN_OCCURRENCE_RATIO) {
      const confidence = Math.min(ratio * 1.2, 0.95); // cap at 0.95
      patterns.push({
        patternType: 'topic',
        label: topic,
        confidence,
        occurrenceCount: count,
        totalSessions,
        safeAnchor: `'${topic}' komt terug in ${count} van je ${totalSessions} sessies`,
      });
    }
  }

  return patterns;
}

// ─── Emotional Theme Detection ───────────────────────────────────────────────

function detectEmotionalPatterns(sessions: SessionLogSummary[], totalSessions: number): RecurringPattern[] {
  const emotionCounts = new Map<string, { count: number; totalIntensity: number }>();

  for (const session of sessions) {
    // Count each emotion label only once per session (use highest intensity)
    const sessionEmotions = new Map<string, number>();
    for (const theme of session.emotionalThemes ?? []) {
      const label = theme.label.toLowerCase().trim();
      const existing = sessionEmotions.get(label) ?? 0;
      if (theme.intensity > existing) {
        sessionEmotions.set(label, theme.intensity);
      }
    }
    for (const [label, intensity] of sessionEmotions) {
      const entry = emotionCounts.get(label) ?? { count: 0, totalIntensity: 0 };
      entry.count++;
      entry.totalIntensity += intensity;
      emotionCounts.set(label, entry);
    }
  }

  const patterns: RecurringPattern[] = [];
  for (const [label, data] of emotionCounts) {
    const ratio = data.count / totalSessions;
    if (data.count >= MIN_ABSOLUTE_OCCURRENCES && ratio >= MIN_OCCURRENCE_RATIO) {
      const avgIntensity = data.totalIntensity / data.count;
      // Higher intensity emotions get higher confidence
      const confidence = Math.min(ratio * (0.8 + avgIntensity * 0.03), 0.92);
      patterns.push({
        patternType: 'emotional_theme',
        label,
        confidence,
        occurrenceCount: data.count,
        totalSessions,
        safeAnchor: `'${label}' is een terugkerend emotioneel thema (${data.count}x)`,
      });
    }
  }

  return patterns;
}

// ─── Temporal Pattern Detection ──────────────────────────────────────────────

function detectTemporalPatterns(sessions: SessionLogSummary[], totalSessions: number): RecurringPattern[] {
  // Count sessions per day of week
  const dayCounts = new Map<number, { count: number; riskCount: number }>();

  for (const session of sessions) {
    const startDate = new Date(session.startedAt);
    if (isNaN(startDate.getTime())) continue;
    const day = startDate.getDay(); // 0=Sunday
    const entry = dayCounts.get(day) ?? { count: 0, riskCount: 0 };
    entry.count++;
    // Check if this session had risk events
    const hasRisk = (session.relapseOrRiskEvents ?? []).some(
      e => e.eventType !== 'none' && e.severity >= 3
    );
    if (hasRisk) entry.riskCount++;
    dayCounts.set(day, entry);
  }

  const patterns: RecurringPattern[] = [];

  // Detect if a specific day has disproportionate risk events
  for (const [day, data] of dayCounts) {
    if (data.riskCount >= 2 && data.count >= 3) {
      const riskRatio = data.riskCount / data.count;
      if (riskRatio >= 0.5) { // 50%+ of sessions on this day have risk
        const confidence = Math.min(riskRatio * 0.85, 0.88);
        const dayName = DAY_NAMES_NL[day];
        patterns.push({
          patternType: 'temporal',
          label: `risicomomenten op ${dayName}`,
          confidence,
          occurrenceCount: data.riskCount,
          totalSessions: data.count,
          safeAnchor: `${dayName} lijkt een dag met meer risicomomenten (${data.riskCount}x)`,
          dayOfWeek: dayName,
        });
      }
    }
  }

  return patterns;
}

// ─── Risk Event Pattern Detection ────────────────────────────────────────────

function detectRiskPatterns(sessions: SessionLogSummary[], totalSessions: number): RecurringPattern[] {
  const riskTypeCounts = new Map<string, number>();

  for (const session of sessions) {
    // Count each risk type only once per session
    const sessionRiskTypes = new Set<string>();
    for (const event of session.relapseOrRiskEvents ?? []) {
      if (event.eventType !== 'none') {
        sessionRiskTypes.add(event.eventType);
      }
    }
    for (const riskType of sessionRiskTypes) {
      riskTypeCounts.set(riskType, (riskTypeCounts.get(riskType) ?? 0) + 1);
    }
  }

  const patterns: RecurringPattern[] = [];
  for (const [riskType, count] of riskTypeCounts) {
    const ratio = count / totalSessions;
    if (count >= MIN_ABSOLUTE_OCCURRENCES && ratio >= MIN_OCCURRENCE_RATIO) {
      const confidence = Math.min(ratio * 1.0, 0.90);
      const label = getRiskTypeLabel(riskType);
      patterns.push({
        patternType: 'risk_event',
        label,
        confidence,
        occurrenceCount: count,
        totalSessions,
        safeAnchor: `${label} komt terug in meerdere sessies (${count}x)`,
      });
    }
  }

  return patterns;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeTopic(topic: string): string {
  return topic.toLowerCase().trim();
}

function getRiskTypeLabel(riskType: string): string {
  switch (riskType) {
    case 'relapse': return 'terugval';
    case 'near_relapse': return 'bijna-terugval';
    case 'craving_spike': return 'craving-piek';
    case 'caregiver_overload': return 'overbelasting';
    case 'crisis': return 'crisismoment';
    default: return riskType;
  }
}
