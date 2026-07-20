/**
 * VSP Insight Intake Adapters
 *
 * Extracts VSP Insight signals from intake-time data sources:
 * 1. Wheel of Change (stageOfChange from intake → WheelOfChangeSnapshot)
 * 2. Early Signs (VspStructuredPlan.zones.*.signals → VspSelfReportedEarlySign[])
 * 3. Self-Image (backpack sections + VspStructuredPlan anchors → VspObservedEarlySign[])
 *
 * These adapters run ONCE at session start (or when intake/VSP data changes)
 * and feed into the VspInsightProfile for long-term pattern tracking.
 *
 * RULES:
 * - NEVER mutates safety core
 * - Source: "intake" for all produced signals
 * - Deterministic (no GPT calls)
 */

import type {
  VspZone,
  VspSelfReportedEarlySign,
  VspObservedEarlySign,
  VspInsightState,
  VspSignalSource,
  WheelOfChangeSnapshot,
} from "./vspInsightTypes";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Input for the wheel-of-change adapter */
export interface WheelOfChangeAdapterInput {
  /** Stage of change from intake (Elias) or null (Kim) */
  stageOfChange: string | null;
  /** Timestamp of intake */
  intakeDate: string;
}

/** Input for the early signs adapter */
export interface EarlySignsAdapterInput {
  /** VspStructuredPlan zones — each zone has a 'signals' field */
  zones: {
    green?: { signals: string };
    yellow?: { signals: string };
    orange?: { signals: string };
    red?: { signals: string };
    purple?: { signals: string };
  };
  /** When the VSP was last updated */
  lastUpdated: string | null;
}

/** Input for the self-image adapter */
export interface SelfImageAdapterInput {
  /** Backpack life story sections (Elias) */
  sections?: Array<{ id: string; label: string; content: string }>;
  /** Kim backpack sections */
  kimBackpack?: {
    my_story: string;
    the_relationship: string;
    the_impact: string;
    my_boundaries: string;
    my_strength: string;
  };
  /** VSP anchor sentences per zone */
  anchorSentences?: {
    green?: string;
    yellow?: string;
    orange?: string;
    red?: string;
    purple?: string;
  };
  /** Timestamp */
  capturedAt: string;
}

// ─── Zone Mapping ─────────────────────────────────────────────────────────────

const ZONE_KEY_TO_VSP: Record<string, VspZone> = {
  green: "GROEN",
  yellow: "GEEL",
  orange: "ORANJE",
  red: "ROOD",
  purple: "PAARS",
};

// ─── Wheel of Change Adapter ──────────────────────────────────────────────────

/**
 * Converts intake stageOfChange into a WheelOfChangeSnapshot.
 * Maps Prochaska stages to the VSP Insight wheel-of-change model.
 */
export function adaptWheelOfChange(input: WheelOfChangeAdapterInput): WheelOfChangeSnapshot {
  const validStages = [
    "precontemplation",
    "contemplation",
    "preparation",
    "action",
    "maintenance",
    "relapse",
  ] as const;

  const stage = input.stageOfChange?.toLowerCase().trim() ?? "unknown";
  const currentStage = validStages.includes(stage as any)
    ? (stage as WheelOfChangeSnapshot["currentStage"])
    : "unknown";

  return {
    currentStage,
    capturedAt: input.intakeDate || new Date().toISOString(),
  };
}

// ─── Early Signs Adapter ──────────────────────────────────────────────────────

/**
 * Extracts self-reported early signs from VspStructuredPlan zone signals.
 * Each zone's 'signals' field is split into individual signs.
 *
 * Example input: zones.orange.signals = "Ik word prikkelbaar, slaap slecht, trek me terug"
 * Output: 3 VspSelfReportedEarlySign entries with source="intake"
 */
export function adaptEarlySigns(input: EarlySignsAdapterInput): VspSelfReportedEarlySign[] {
  const signs: VspSelfReportedEarlySign[] = [];
  const now = input.lastUpdated || new Date().toISOString();

  for (const [zoneKey, zoneData] of Object.entries(input.zones)) {
    if (!zoneData?.signals || zoneData.signals.trim() === "") continue;

    const vspZone = ZONE_KEY_TO_VSP[zoneKey];
    if (!vspZone) continue;

    // Split signals by common delimiters (comma, semicolon, newline, "en", bullet points)
    const rawSignals = splitSignalText(zoneData.signals);

    for (const rawSignal of rawSignals) {
      const label = rawSignal.trim();
      if (label.length < 3) continue; // Skip too-short fragments

      const normalizedLabel = normalizeSignalLabel(label);
      const signId = `intake_${zoneKey}_${hashString(normalizedLabel)}`;

      // Check if we already have this sign (dedup by normalized label)
      const existing = signs.find(s => s.normalizedLabel === normalizedLabel);
      if (existing) {
        // Add zone association if not already present
        if (!existing.userReportedZoneAssociation.includes(vspZone)) {
          existing.userReportedZoneAssociation.push(vspZone);
        }
        continue;
      }

      signs.push({
        signId,
        label,
        normalizedLabel,
        examples: [label],
        userReportedZoneAssociation: [vspZone],
        source: "intake",
        firstDetectedAt: now,
        lastUpdatedAt: now,
      });
    }
  }

  return signs;
}

// ─── Self-Image Adapter ───────────────────────────────────────────────────────

/**
 * Extracts self-image related observed early signs from backpack content.
 * Looks for self-referential patterns that indicate self-image beliefs.
 *
 * Patterns detected:
 * - "Ik ben..." (I am...) statements → identity beliefs
 * - "Ik voel me..." (I feel...) statements → emotional self-image
 * - "Ik kan niet..." (I can't...) statements → limiting beliefs
 * - "Ik moet..." (I have to...) statements → obligation patterns
 * - Anchor sentences → protective self-image
 */
export function adaptSelfImage(input: SelfImageAdapterInput): VspObservedEarlySign[] {
  const signs: VspObservedEarlySign[] = [];
  const now = input.capturedAt || new Date().toISOString();

  // Collect all text sources
  const textSources: string[] = [];

  if (input.sections) {
    for (const section of input.sections) {
      if (section.content) textSources.push(section.content);
    }
  }

  if (input.kimBackpack) {
    textSources.push(input.kimBackpack.my_story || "");
    textSources.push(input.kimBackpack.the_impact || "");
    textSources.push(input.kimBackpack.my_strength || "");
  }

  // Extract self-referential patterns
  const allText = textSources.join(" ");
  const selfPatterns = extractSelfImagePatterns(allText);

  for (const pattern of selfPatterns) {
    const signId = `selfimage_${hashString(pattern.normalizedLabel)}`;

    // Dedup
    if (signs.find(s => s.normalizedLabel === pattern.normalizedLabel)) continue;

    signs.push({
      signId,
      label: pattern.label,
      normalizedLabel: pattern.normalizedLabel,
      examples: [pattern.example],
      associatedInsightState: pattern.insightState,
      associatedZone: pattern.zone,
      confidence: pattern.confidence,
      frequency: 1,
      firstDetectedAt: now,
      lastUpdatedAt: now,
      sourceSignals: ["intake" as VspSignalSource],
    });
  }

  // Extract anchor sentences as protective signs
  if (input.anchorSentences) {
    for (const [zoneKey, anchor] of Object.entries(input.anchorSentences)) {
      if (!anchor || anchor.trim() === "") continue;
      const vspZone = ZONE_KEY_TO_VSP[zoneKey];
      if (!vspZone) continue;

      const normalizedLabel = `ankerzin_${zoneKey}`;
      const signId = `selfimage_anchor_${zoneKey}`;

      signs.push({
        signId,
        label: `Ankerzin (${zoneKey}): "${anchor.slice(0, 60)}"`,
        normalizedLabel,
        examples: [anchor],
        associatedInsightState: "REAL_GREEN",
        associatedZone: vspZone,
        confidence: 0.8,
        frequency: 1,
        firstDetectedAt: now,
        lastUpdatedAt: now,
        sourceSignals: ["intake" as VspSignalSource],
      });
    }
  }

  return signs;
}

// ─── Combined Adapter (convenience) ──────────────────────────────────────────

export interface VspIntakeAdapterInput {
  stageOfChange: string | null;
  intakeDate: string;
  vspZones?: EarlySignsAdapterInput["zones"];
  vspLastUpdated?: string | null;
  sections?: SelfImageAdapterInput["sections"];
  kimBackpack?: SelfImageAdapterInput["kimBackpack"];
  anchorSentences?: SelfImageAdapterInput["anchorSentences"];
}

export interface VspIntakeAdapterResult {
  wheelOfChange: WheelOfChangeSnapshot;
  selfReportedEarlySigns: VspSelfReportedEarlySign[];
  observedEarlySigns: VspObservedEarlySign[];
}

/**
 * Runs all three intake adapters and returns combined results.
 * Call this at session start to seed the VspInsightProfile with intake data.
 */
export function runVspIntakeAdapters(input: VspIntakeAdapterInput): VspIntakeAdapterResult {
  const wheelOfChange = adaptWheelOfChange({
    stageOfChange: input.stageOfChange,
    intakeDate: input.intakeDate,
  });

  const selfReportedEarlySigns = input.vspZones
    ? adaptEarlySigns({
        zones: input.vspZones,
        lastUpdated: input.vspLastUpdated ?? null,
      })
    : [];

  const observedEarlySigns = adaptSelfImage({
    sections: input.sections,
    kimBackpack: input.kimBackpack,
    anchorSentences: input.anchorSentences,
    capturedAt: input.intakeDate,
  });

  return {
    wheelOfChange,
    selfReportedEarlySigns,
    observedEarlySigns,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Split signal text by common Dutch delimiters */
function splitSignalText(text: string): string[] {
  // Split by: comma, semicolon, newline, bullet points, numbered lists
  return text
    .split(/[,;\n]|(?:\d+\.\s)|(?:[-•]\s)/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/** Normalize a signal label for deduplication */
function normalizeSignalLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\sàáâãäåèéêëìíîïòóôõöùúûüýÿ]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

/** Simple string hash for generating deterministic IDs */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/** Self-image pattern extraction from free text */
interface SelfImagePattern {
  label: string;
  normalizedLabel: string;
  example: string;
  insightState: VspInsightState;
  zone: VspZone | "silent_only";
  confidence: number;
}

const SELF_IMAGE_REGEX_PATTERNS: Array<{
  regex: RegExp;
  insightState: VspInsightState;
  zone: VspZone | "silent_only";
  confidence: number;
  labelPrefix: string;
}> = [
  // Negative self-beliefs (high relevance for RATIONAL_GREEN detection)
  {
    regex: /ik ben\s+(niet\s+(?:goed|waard|genoeg|sterk)|waardeloos|dom|zwak|lelijk|mislukt|kapot|niks|niets)/gi,
    insightState: "RATIONAL_GREEN",
    zone: "ORANJE",
    confidence: 0.7,
    labelPrefix: "negatief zelfbeeld",
  },
  // Limiting beliefs
  {
    regex: /ik kan\s+(?:niet|nooit|niks)\s+(.{3,40})/gi,
    insightState: "RATIONAL_GREEN",
    zone: "GEEL",
    confidence: 0.6,
    labelPrefix: "beperkende overtuiging",
  },
  // Obligation patterns (should/must)
  {
    regex: /ik moet\s+(?:altijd|alles|perfect|sterk)\s*(.{0,30})/gi,
    insightState: "RATIONAL_GREEN",
    zone: "GEEL",
    confidence: 0.5,
    labelPrefix: "verplichting-patroon",
  },
  // Overwhelm indicators
  {
    regex: /ik voel me\s+(overweldigd|verloren|machteloos|hopeloos|leeg|dood van binnen)/gi,
    insightState: "OVERWHELMED_ORANGE_RED",
    zone: "ROOD",
    confidence: 0.7,
    labelPrefix: "overweldiging",
  },
  // Positive self-image (protective factor)
  {
    regex: /ik ben\s+(sterk|waardevol|goed genoeg|trots|veerkrachtig|een goede)/gi,
    insightState: "REAL_GREEN",
    zone: "GROEN",
    confidence: 0.6,
    labelPrefix: "positief zelfbeeld",
  },
];

function extractSelfImagePatterns(text: string): SelfImagePattern[] {
  const patterns: SelfImagePattern[] = [];
  const seenLabels = new Set<string>();

  for (const patternDef of SELF_IMAGE_REGEX_PATTERNS) {
    const matches = text.matchAll(patternDef.regex);
    for (const match of matches) {
      const fullMatch = match[0].trim();
      const captured = match[1]?.trim() || fullMatch;
      const label = `${patternDef.labelPrefix}: ${captured.slice(0, 40)}`;
      const normalizedLabel = normalizeSignalLabel(label);

      if (seenLabels.has(normalizedLabel)) continue;
      seenLabels.add(normalizedLabel);

      patterns.push({
        label,
        normalizedLabel,
        example: fullMatch,
        insightState: patternDef.insightState,
        zone: patternDef.zone,
        confidence: patternDef.confidence,
      });
    }
  }

  return patterns;
}
