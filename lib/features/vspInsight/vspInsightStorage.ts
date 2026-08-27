/**
 * VSP Insight Storage
 *
 * Local-only storage for VSP Insight state history and silent discrepancy.
 * Uses AsyncStorage. Data is NEVER communicated to user.
 * Data is NEVER sent to server (store:false).
 *
 * Stores:
 * - Insight profile (patterns, early signs, soothing history)
 * - Silent discrepancy events
 * - Phase transition examples
 * - Soothing effect records
 */

import { readJson, writeJson, updateJson, removeJson } from "@/lib/storage/memory/atomicJsonStore";
import type {
  RecoFreePersona,
  VspInsightProfile,
  VspInsightProfilePatch,
  VspSilentDiscrepancyEvent,
  VspPhaseTransitionExample,
  VspSoothingEffectRecord,
  VspSoothingChoiceEvent,
  VspInsightState,
  VspZone,
  VspMoodSlidersSnapshot,
} from "./vspInsightTypes";

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const PROFILE_KEY_PREFIX = "vsp_insight_profile_";
const DISCREPANCY_KEY_PREFIX = "vsp_discrepancy_events_";
const TRANSITIONS_KEY_PREFIX = "vsp_phase_transitions_";
const SOOTHING_KEY_PREFIX = "vsp_soothing_effects_";

function profileKey(userId: string, persona: RecoFreePersona): string {
  return `${PROFILE_KEY_PREFIX}${persona}_${userId}`;
}

function discrepancyKey(userId: string, persona: RecoFreePersona): string {
  return `${DISCREPANCY_KEY_PREFIX}${persona}_${userId}`;
}

function transitionsKey(userId: string, persona: RecoFreePersona): string {
  return `${TRANSITIONS_KEY_PREFIX}${persona}_${userId}`;
}

function soothingKey(userId: string, persona: RecoFreePersona): string {
  return `${SOOTHING_KEY_PREFIX}${persona}_${userId}`;
}

// ─── Profile CRUD ─────────────────────────────────────────────────────────────

export async function loadVspInsightProfile(
  userId: string,
  persona: RecoFreePersona
): Promise<VspInsightProfile | null> {
  try {
    return await readJson<VspInsightProfile>(profileKey(userId, persona));
  } catch {
    return null;
  }
}

export async function saveVspInsightProfile(
  userId: string,
  persona: RecoFreePersona,
  profile: VspInsightProfile
): Promise<void> {
  await writeJson(profileKey(userId, persona), profile);
}

export async function applyVspInsightProfilePatch(
  userId: string,
  persona: RecoFreePersona,
  patch: VspInsightProfilePatch
): Promise<VspInsightProfile> {
  const existing = await loadVspInsightProfile(userId, persona);
  const now = patch.updatedAt;

  const profile: VspInsightProfile = existing ?? createEmptyProfile(userId, persona, now);

  // Update metadata
  profile.updatedAt = now;

  // Upsert self-reported early signs
  for (const sign of patch.upsertSelfReportedEarlySigns) {
    const idx = profile.selfReportedEarlySigns.findIndex((s) => s.signId === sign.signId);
    if (idx >= 0) {
      profile.selfReportedEarlySigns[idx] = sign;
    } else {
      profile.selfReportedEarlySigns.push(sign);
    }
  }

  // Upsert observed early signs
  for (const sign of patch.upsertObservedEarlySigns) {
    const idx = profile.observedEarlySigns.findIndex((s) => s.signId === sign.signId);
    if (idx >= 0) {
      profile.observedEarlySigns[idx] = sign;
    } else {
      profile.observedEarlySigns.push(sign);
    }
  }

  // Upsert phase transition examples (max 50)
  for (const example of patch.upsertPhaseTransitionExamples) {
    const idx = profile.phaseTransitionExamples.findIndex(
      (e) => e.exampleId === example.exampleId
    );
    if (idx >= 0) {
      profile.phaseTransitionExamples[idx] = example;
    } else {
      profile.phaseTransitionExamples.push(example);
    }
  }
  if (profile.phaseTransitionExamples.length > 50) {
    profile.phaseTransitionExamples = profile.phaseTransitionExamples.slice(-50);
  }

  // Upsert discrepancy events (max 100)
  for (const event of patch.upsertDiscrepancyEvents) {
    const idx = profile.discrepancyHistory.findIndex((e) => e.eventId === event.eventId);
    if (idx >= 0) {
      profile.discrepancyHistory[idx] = event;
    } else {
      profile.discrepancyHistory.push(event);
    }
  }
  if (profile.discrepancyHistory.length > 100) {
    profile.discrepancyHistory = profile.discrepancyHistory.slice(-100);
  }

  // Update soothing profile
  if (patch.updateSoothingProfile) {
    if (patch.updateSoothingProfile.genericOptionsUsed) {
      profile.soothingProfile.genericOptionsUsed = patch.updateSoothingProfile.genericOptionsUsed;
    }
    if (patch.updateSoothingProfile.personalizedEffectiveOptions) {
      profile.soothingProfile.personalizedEffectiveOptions =
        patch.updateSoothingProfile.personalizedEffectiveOptions;
    }
    if (patch.updateSoothingProfile.excludedOptions) {
      profile.soothingProfile.excludedOptions = patch.updateSoothingProfile.excludedOptions;
    }
  }

  // Update last state
  if (patch.lastInsightState) profile.lastInsightState = patch.lastInsightState;
  if (patch.lastUserReportedZone) profile.lastUserReportedZone = patch.lastUserReportedZone;
  if (patch.lastMoodSnapshot) profile.lastMoodSnapshot = patch.lastMoodSnapshot;

  await saveVspInsightProfile(userId, persona, profile);
  return profile;
}

// ─── Discrepancy Events (local only, never communicated) ──────────────────────

export async function loadDiscrepancyEvents(
  userId: string,
  persona: RecoFreePersona
): Promise<VspSilentDiscrepancyEvent[]> {
  try {
    return (await readJson<VspSilentDiscrepancyEvent[]>(discrepancyKey(userId, persona))) ?? [];
  } catch {
    return [];
  }
}

export async function appendDiscrepancyEvent(
  userId: string,
  persona: RecoFreePersona,
  event: VspSilentDiscrepancyEvent
): Promise<void> {
  await updateJson<VspSilentDiscrepancyEvent[]>(discrepancyKey(userId, persona), (current) => {
    const events = Array.isArray(current) ? [...current, event] : [event];
    return events.length > 100 ? events.slice(-100) : events;
  });
}

// ─── Phase Transitions ────────────────────────────────────────────────────────

export async function loadPhaseTransitions(
  userId: string,
  persona: RecoFreePersona
): Promise<VspPhaseTransitionExample[]> {
  try {
    return (await readJson<VspPhaseTransitionExample[]>(transitionsKey(userId, persona))) ?? [];
  } catch {
    return [];
  }
}

export async function appendPhaseTransition(
  userId: string,
  persona: RecoFreePersona,
  transition: VspPhaseTransitionExample
): Promise<void> {
  await updateJson<VspPhaseTransitionExample[]>(transitionsKey(userId, persona), (current) => {
    const transitions = Array.isArray(current) ? [...current, transition] : [transition];
    return transitions.length > 50 ? transitions.slice(-50) : transitions;
  });
}

// ─── Soothing Effect Records ──────────────────────────────────────────────────

export async function loadSoothingEffects(
  userId: string,
  persona: RecoFreePersona
): Promise<VspSoothingEffectRecord[]> {
  try {
    return (await readJson<VspSoothingEffectRecord[]>(soothingKey(userId, persona))) ?? [];
  } catch {
    return [];
  }
}

export async function appendSoothingEffect(
  userId: string,
  persona: RecoFreePersona,
  record: VspSoothingEffectRecord
): Promise<void> {
  await updateJson<VspSoothingEffectRecord[]>(soothingKey(userId, persona), (current) => {
    const records = Array.isArray(current) ? [...current, record] : [record];
    return records.length > 200 ? records.slice(-200) : records;
  });
}

// ─── Soothing Choice Events ───────────────────────────────────────────────────

const SOOTHING_CHOICE_KEY_PREFIX = "vsp_soothing_choice_";

function soothingChoiceKey(userId: string, persona: RecoFreePersona): string {
  return `${SOOTHING_CHOICE_KEY_PREFIX}${persona}_${userId}`;
}

export function getVspInsightStorageKeys(userId: string, persona: RecoFreePersona): string[] {
  return [
    profileKey(userId, persona),
    discrepancyKey(userId, persona),
    transitionsKey(userId, persona),
    soothingKey(userId, persona),
    soothingChoiceKey(userId, persona),
  ];
}

export async function saveLastSoothingChoice(
  userId: string,
  persona: RecoFreePersona,
  event: VspSoothingChoiceEvent
): Promise<void> {
  await writeJson(soothingChoiceKey(userId, persona), event);
}

export async function loadLastSoothingChoice(
  userId: string,
  persona: RecoFreePersona
): Promise<VspSoothingChoiceEvent | null> {
  try {
    return await readJson<VspSoothingChoiceEvent>(soothingChoiceKey(userId, persona));
  } catch {
    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createEmptyProfile(
  userId: string,
  persona: RecoFreePersona,
  now: string
): VspInsightProfile {
  return {
    profileVersion: "vsp_insight_profile.v1",
    persona,
    userId,
    createdAt: now,
    updatedAt: now,
    selfReportedEarlySigns: [],
    observedEarlySigns: [],
    rationalGreenPattern: {
      patternId: `${persona}_rational_green`,
      label: "Rational Green Pattern",
      confidence: 0,
      markers: [],
      examples: [],
      firstDetectedAt: null,
      lastUpdatedAt: null,
    },
    overwhelmPattern: {
      patternId: `${persona}_overwhelm`,
      label: "Overwhelm Pattern",
      confidence: 0,
      markers: [],
      examples: [],
      firstDetectedAt: null,
      lastUpdatedAt: null,
    },
    realGreenPattern: {
      patternId: `${persona}_real_green`,
      label: "Real Green Pattern",
      confidence: 0,
      markers: [],
      examples: [],
      firstDetectedAt: null,
      lastUpdatedAt: null,
    },
    soothingProfile: {
      genericOptionsUsed: [],
      personalizedEffectiveOptions: [],
      excludedOptions: [],
    },
    phaseTransitionExamples: [],
    wheelOfChangeHistory: [],
    discrepancyHistory: [],
    lastInsightState: null,
    lastUserReportedZone: null,
    lastMoodSnapshot: null,
    lastSoothingChoiceEvent: null,
  };
}

/**
 * Clear all VSP Insight data for a user (for testing/reset).
 */
export async function clearVspInsightData(
  userId: string,
  persona: RecoFreePersona
): Promise<void> {
  await Promise.all([
    removeJson(profileKey(userId, persona)),
    removeJson(discrepancyKey(userId, persona)),
    removeJson(transitionsKey(userId, persona)),
    removeJson(soothingKey(userId, persona)),
    removeJson(soothingChoiceKey(userId, persona)),
  ]);
}

export interface VspInsightBackupBundle {
  profile: VspInsightProfile | null;
  discrepancyEvents: VspSilentDiscrepancyEvent[];
  phaseTransitions: VspPhaseTransitionExample[];
  soothingEffects: VspSoothingEffectRecord[];
  lastSoothingChoice: VspSoothingChoiceEvent | null;
}

export async function exportVspInsightData(
  userId: string,
  persona: RecoFreePersona,
): Promise<VspInsightBackupBundle> {
  const [profile, discrepancyEvents, phaseTransitions, soothingEffects, lastSoothingChoice] = await Promise.all([
    loadVspInsightProfile(userId, persona),
    loadDiscrepancyEvents(userId, persona),
    loadPhaseTransitions(userId, persona),
    loadSoothingEffects(userId, persona),
    loadLastSoothingChoice(userId, persona),
  ]);
  return { profile, discrepancyEvents, phaseTransitions, soothingEffects, lastSoothingChoice };
}

export async function replaceVspInsightData(
  userId: string,
  persona: RecoFreePersona,
  data: Partial<VspInsightBackupBundle> | null | undefined,
): Promise<void> {
  if (!data) return;
  await Promise.all([
    data.profile ? writeJson(profileKey(userId, persona), data.profile) : removeJson(profileKey(userId, persona)),
    writeJson(discrepancyKey(userId, persona), Array.isArray(data.discrepancyEvents) ? data.discrepancyEvents : []),
    writeJson(transitionsKey(userId, persona), Array.isArray(data.phaseTransitions) ? data.phaseTransitions : []),
    writeJson(soothingKey(userId, persona), Array.isArray(data.soothingEffects) ? data.soothingEffects : []),
    data.lastSoothingChoice
      ? writeJson(soothingChoiceKey(userId, persona), data.lastSoothingChoice)
      : removeJson(soothingChoiceKey(userId, persona)),
  ]);
}
