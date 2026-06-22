/**
 * Migration: Convert legacy sessionAnalyses[] (PAD A) into logs.dat SessionLogSummary entries.
 *
 * Triggered by hidden 5x tap on persona name in chat header.
 * One-time migration — marks completion in AsyncStorage so it won't run twice.
 */
import type { RecoFreePersona } from "@/lib/types/memory/memoryCore.types";
import type { SessionLogSummary } from "@/lib/types/memory/logsDat.types";
import { createLogsDatStore } from "@/lib/storage/memory/logsDatStore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const MIGRATION_DONE_KEY = "@recofree_migration_sessionAnalyses_to_logsDat_done";

export interface LegacySessionAnalysis {
  sessionNumber?: number;
  date?: string;
  messageCount?: number;
  durationMinutes?: number;
  dominantEmotion?: string;
  themes?: string[];
  newTriggers?: string[];
  modulesUsed?: string[];
  moodDelta?: { distressChange?: number; resilienceChange?: number };
  endRiskLevel?: string;
}

export interface MigrationResult {
  migrated: number;
  skipped: number;
  alreadyDone: boolean;
  error?: string;
}

/**
 * Check if migration has already been completed.
 */
export async function isMigrationDone(): Promise<boolean> {
  const done = await AsyncStorage.getItem(MIGRATION_DONE_KEY);
  return done === "true";
}

/**
 * Run the migration: convert sessionAnalyses[] to logs.dat entries.
 *
 * @param persona - The persona to migrate for
 * @param sessionAnalyses - The legacy sessionAnalyses array from userDat
 * @returns MigrationResult with counts
 */
export async function migrateSessionAnalysesToLogsDat(
  persona: RecoFreePersona,
  sessionAnalyses: LegacySessionAnalysis[]
): Promise<MigrationResult> {
  // Check if already done
  if (await isMigrationDone()) {
    return { migrated: 0, skipped: 0, alreadyDone: true };
  }

  if (!sessionAnalyses || sessionAnalyses.length === 0) {
    await AsyncStorage.setItem(MIGRATION_DONE_KEY, "true");
    return { migrated: 0, skipped: 0, alreadyDone: false };
  }

  // Guard: check if crypto is available (required for encrypted logsDat store)
  const cryptoAvailable = (() => {
    try {
      const ExpoCrypto = require('expo-crypto');
      if (ExpoCrypto && typeof ExpoCrypto.getRandomValues === 'function') return true;
    } catch { /* ignore */ }
    if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.subtle !== 'undefined') return true;
    return false;
  })();

  if (!cryptoAvailable) {
    console.warn('[Migration] crypto not available — skipping migration (will retry next session)');
    return { migrated: 0, skipped: sessionAnalyses.length, alreadyDone: false, error: 'crypto not available' };
  }

  try {
  const store = createLogsDatStore();
  const logsDat = await store.load(persona);

  // Get existing session dates to avoid duplicates
  const existingDates = new Set(logsDat.sessions.map((s) => s.startedAt.slice(0, 10)));

  let migrated = 0;
  let skipped = 0;

  for (const analysis of sessionAnalyses) {
    const date = analysis.date || new Date().toISOString();
    const dateKey = date.slice(0, 10);

    // Skip if a session for this date already exists in logs.dat
    if (existingDates.has(dateKey)) {
      skipped++;
      continue;
    }

    const summary: SessionLogSummary = {
      summaryId: `migrated_${analysis.sessionNumber || migrated}_${Date.now()}`,
      sessionId: `legacy_session_${analysis.sessionNumber || migrated}`,
      persona,
      startedAt: date,
      endedAt: date,
      createdAt: new Date().toISOString(),
      summaryModel: "gpt-4o-mini",
      summarySchemaVersion: "session_summary.v1",
      compressedNarrative: buildMigrationNarrative(analysis),
      discussedTopics: analysis.themes?.slice(0, 5) || [],
      emotionalThemes: analysis.dominantEmotion
        ? [{ label: analysis.dominantEmotion, intensity: 0.6 }]
        : [],
      breakthroughs: [],
      relapseOrRiskEvents: [{ eventType: "none", description: "", severity: 0 }],
      openEndpoints: [],
      extractedCandidates: {
        fears: [],
        hopes: [],
        triggers: [],
        schemaTendencies: [],
        modeTendencies: [],
      },
      moduleTrace: (analysis.modulesUsed || []).map((m) => ({
        moduleId: m,
        responseMode: "default",
        count: 1,
      })),
      zoneTrace: [],
      inputTokenEstimate: 0,
      outputTokenEstimate: 0,
    };

    logsDat.sessions.push(summary);
    existingDates.add(dateKey);
    migrated++;
  }

  // Sort by date
  logsDat.sessions.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
  logsDat.updatedAt = new Date().toISOString();

  // Save
  await store.save(persona, logsDat);

  // Mark as done
  await AsyncStorage.setItem(MIGRATION_DONE_KEY, "true");

  console.log(`[Migration] sessionAnalyses → logs.dat: migrated=${migrated}, skipped=${skipped}`);

  return { migrated, skipped, alreadyDone: false };
  } catch (err: any) {
    console.error('[Migration] Failed:', err?.message || err);
    return { migrated: 0, skipped: sessionAnalyses.length, alreadyDone: false, error: err?.message || 'Unknown migration error' };
  }
}

function buildMigrationNarrative(analysis: LegacySessionAnalysis): string {
  const parts: string[] = [];

  if (analysis.messageCount) {
    parts.push(`Sessie met ${analysis.messageCount} berichten`);
  }
  if (analysis.durationMinutes) {
    parts.push(`(${analysis.durationMinutes} min)`);
  }
  if (analysis.dominantEmotion) {
    parts.push(`Dominante emotie: ${analysis.dominantEmotion}`);
  }
  if (analysis.themes && analysis.themes.length > 0) {
    parts.push(`Thema's: ${analysis.themes.join(", ")}`);
  }
  if (analysis.newTriggers && analysis.newTriggers.length > 0) {
    parts.push(`Triggers: ${analysis.newTriggers.join(", ")}`);
  }

  return parts.length > 0 ? parts.join(". ") + "." : "Gemigreerde sessie (geen details beschikbaar).";
}
