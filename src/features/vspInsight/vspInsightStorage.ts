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

import AsyncStorage from "@react-native-async-storage/async-storage";
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
    const raw = await AsyncStorage.getItem(profileKey(userId, persona));
    if (!raw) return null;
    return JSON.parse(raw) as VspInsightProfile;
  } catch {
    return null;
  }
}

export async function saveVspInsightProfile(
  userId: string,
  persona: RecoFreePersona,
  profile: VspInsightProfile
): Promise<void> {
  await AsyncStorage.setItem(profileKey(userId, persona), JSON.stringify(profile));
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
    const raw = await AsyncStorage.getItem(discrepancyKey(userId, persona));
    if (!raw) return [];
    return JSON.parse(raw) as VspSilentDiscrepancyEvent[];
  } catch {
    return [];
  }
}

export async function appendDiscrepancyEvent(
  userId: string,
  persona: RecoFreePersona,
  event: VspSilentDiscrepancyEvent
): Promise<void> {
  const events = await loadDiscrepancyEvents(userId, persona);
  events.push(event);
  // Keep max 100
  const trimmed = events.length > 100 ? events.slice(-100) : events;
  await AsyncStorage.setItem(discrepancyKey(userId, persona), JSON.stringify(trimmed));
}

// ─── Phase Transitions ────────────────────────────────────────────────────────

export async function loadPhaseTransitions(
  userId: string,
  persona: RecoFreePersona
): Promise<VspPhaseTransitionExample[]> {
  try {
    const raw = await AsyncStorage.getItem(transitionsKey(userId, persona));
    if (!raw) return [];
    return JSON.parse(raw) as VspPhaseTransitionExample[];
  } catch {
    return [];
  }
}

export async function appendPhaseTransition(
  userId: string,
  persona: RecoFreePersona,
  transition: VspPhaseTransitionExample
): Promise<void> {
  const transitions = await loadPhaseTransitions(userId, persona);
  transitions.push(transition);
  // Keep max 50
  const trimmed = transitions.length > 50 ? transitions.slice(-50) : transitions;
  await AsyncStorage.setItem(transitionsKey(userId, persona), JSON.stringify(trimmed));
}

// ─── Soothing Effect Records ──────────────────────────────────────────────────

export async function loadSoothingEffects(
  userId: string,
  persona: RecoFreePersona
): Promise<VspSoothingEffectRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(soothingKey(userId, persona));
    if (!raw) return [];
    return JSON.parse(raw) as VspSoothingEffectRecord[];
  } catch {
    return [];
  }
}

export async function appendSoothingEffect(
  userId: string,
  persona: RecoFreePersona,
  record: VspSoothingEffectRecord
): Promise<void> {
  const records = await loadSoothingEffects(userId, persona);
  records.push(record);
  // Keep max 200
  const trimmed = records.length > 200 ? records.slice(-200) : records;
  await AsyncStorage.setItem(soothingKey(userId, persona), JSON.stringify(trimmed));
}

// ─── Soothing Choice Events ───────────────────────────────────────────────────

const SOOTHING_CHOICE_KEY_PREFIX = "vsp_soothing_choice_";

function soothingChoiceKey(userId: string, persona: RecoFreePersona): string {
  return `${SOOTHING_CHOICE_KEY_PREFIX}${persona}_${userId}`;
}

export async function saveLastSoothingChoice(
  userId: string,
  persona: RecoFreePersona,
  event: VspSoothingChoiceEvent
): Promise<void> {
  await AsyncStorage.setItem(soothingChoiceKey(userId, persona), JSON.stringify(event));
}

export async function loadLastSoothingChoice(
  userId: string,
  persona: RecoFreePersona
): Promise<VspSoothingChoiceEvent | null> {
  try {
    const raw = await AsyncStorage.getItem(soothingChoiceKey(userId, persona));
    if (!raw) return null;
    return JSON.parse(raw) as VspSoothingChoiceEvent;
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
  await AsyncStorage.multiRemove([
    profileKey(userId, persona),
    discrepancyKey(userId, persona),
    transitionsKey(userId, persona),
    soothingKey(userId, persona),
    soothingChoiceKey(userId, persona),
  ]);
}
