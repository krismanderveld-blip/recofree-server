/**
 * VSP DGT Soothing Flow
 *
 * When OVERWHELMED_ORANGE_RED is detected and DGT framework is active,
 * this module provides soothing options based on:
 * - Sensory channels (sight, sound, touch, taste, smell, breath, movement, temperature, orientation)
 * - Safety filtering (no options that could trigger craving, dissociation, etc.)
 * - Personalization from profile (what worked before)
 *
 * Safety core NEVER touched. store:false.
 */

import type {
  VspSoothingOption,
  VspDgtSoothingFlow,
  VspMoodSlidersSnapshot,
  VspInsightProfile,
  VspSensoryChannel,
  VspZone,
  ImmutableSafetyCoreSnapshot,
  RecoFreePersona,
} from "./vspInsightTypes";

// ─── Default Soothing Options Library ─────────────────────────────────────────

const DEFAULT_SOOTHING_OPTIONS: VspSoothingOption[] = [
  // BREATH
  {
    optionId: "sooth_breath_box",
    label: "Box Breathing (4-4-4-4)",
    sensoryChannel: "breath",
    instruction: "Adem in voor 4 tellen, houd vast voor 4, adem uit voor 4, houd vast voor 4. Herhaal 3x.",
    allowedZones: ["GROEN", "GEEL", "ORANJE", "ROOD"],
    defaultRank: 1,
  },
  {
    optionId: "sooth_breath_long_exhale",
    label: "Lange Uitademing",
    sensoryChannel: "breath",
    instruction: "Adem in voor 4 tellen, adem uit voor 8 tellen. De lange uitademing activeert je parasympathisch zenuwstelsel.",
    allowedZones: ["GROEN", "GEEL", "ORANJE", "ROOD"],
    defaultRank: 2,
  },
  // TOUCH
  {
    optionId: "sooth_touch_cold_water",
    label: "Koud Water op Polsen",
    sensoryChannel: "touch",
    instruction: "Houd je polsen onder koud water. Voel de temperatuur. Dit helpt je zenuwstelsel te resetten.",
    allowedZones: ["GEEL", "ORANJE", "ROOD"],
    excludedIfDissociation: true,
    defaultRank: 3,
  },
  {
    optionId: "sooth_touch_butterfly_hug",
    label: "Butterfly Hug",
    sensoryChannel: "touch",
    instruction: "Kruis je armen over je borst, handen op je schouders. Tik afwisselend links-rechts, langzaam. Voel het ritme.",
    allowedZones: ["GROEN", "GEEL", "ORANJE", "ROOD"],
    defaultRank: 4,
  },
  {
    optionId: "sooth_touch_feet_ground",
    label: "Voeten op de Grond",
    sensoryChannel: "touch",
    instruction: "Druk je voeten stevig op de grond. Voel het contact. Wieg zachtjes heen en weer.",
    allowedZones: ["GROEN", "GEEL", "ORANJE", "ROOD"],
    defaultRank: 5,
  },
  // SIGHT
  {
    optionId: "sooth_sight_5_things",
    label: "5 Dingen Zien",
    sensoryChannel: "sight",
    instruction: "Noem 5 dingen die je nu kunt zien. Beschrijf ze in detail: kleur, vorm, textuur.",
    allowedZones: ["GROEN", "GEEL", "ORANJE", "ROOD"],
    defaultRank: 6,
  },
  {
    optionId: "sooth_sight_nature",
    label: "Kijk naar Natuur",
    sensoryChannel: "sight",
    instruction: "Kijk uit het raam of zoek een plant/boom. Focus op de details: bladeren, kleuren, beweging.",
    allowedZones: ["GROEN", "GEEL", "ORANJE"],
    defaultRank: 7,
  },
  // SOUND
  {
    optionId: "sooth_sound_humming",
    label: "Neuriën/Humming",
    sensoryChannel: "sound",
    instruction: "Neurie een laag, rustig geluid. Voel de trillingen in je borst en keel. Dit activeert de nervus vagus.",
    allowedZones: ["GROEN", "GEEL", "ORANJE", "ROOD"],
    defaultRank: 8,
  },
  {
    optionId: "sooth_sound_listen",
    label: "Luister naar 3 Geluiden",
    sensoryChannel: "sound",
    instruction: "Sluit je ogen. Luister naar 3 geluiden om je heen. Benoem ze zonder te oordelen.",
    allowedZones: ["GROEN", "GEEL", "ORANJE"],
    excludedIfDissociation: true,
    defaultRank: 9,
  },
  // MOVEMENT
  {
    optionId: "sooth_movement_shake",
    label: "Schudden (TRE-light)",
    sensoryChannel: "movement",
    instruction: "Sta op en schud je hele lichaam 30 seconden. Armen, benen, romp. Laat spanning los.",
    allowedZones: ["GEEL", "ORANJE", "ROOD"],
    excludedIfDrivingRisk: true,
    defaultRank: 10,
  },
  {
    optionId: "sooth_movement_walk",
    label: "Korte Wandeling",
    sensoryChannel: "movement",
    instruction: "Loop 5 minuten. Focus op je voeten: hak, voet, teen. Eén stap tegelijk.",
    allowedZones: ["GROEN", "GEEL", "ORANJE"],
    excludedIfDrivingRisk: true,
    defaultRank: 11,
  },
  // TEMPERATURE
  {
    optionId: "sooth_temp_ice_cube",
    label: "IJsblokje Vasthouden",
    sensoryChannel: "temperature",
    instruction: "Houd een ijsblokje in je hand. Focus op de kou. Dit helpt bij dissociatie en intense emoties.",
    allowedZones: ["ORANJE", "ROOD"],
    excludedIfSelfHarmRisk: true,
    defaultRank: 12,
  },
  {
    optionId: "sooth_temp_warm_drink",
    label: "Warm Drankje",
    sensoryChannel: "temperature",
    instruction: "Maak een warm (niet-alcoholisch) drankje. Houd de mok vast. Voel de warmte in je handen.",
    allowedZones: ["GROEN", "GEEL", "ORANJE"],
    excludedIfCravingAtLeast: 7,
    defaultRank: 13,
  },
  // SMELL
  {
    optionId: "sooth_smell_essential_oil",
    label: "Ruik Iets Sterks",
    sensoryChannel: "smell",
    instruction: "Ruik aan iets met een sterke geur: koffie, zeep, een kruid. Focus alleen op de geur.",
    allowedZones: ["GROEN", "GEEL", "ORANJE", "ROOD"],
    excludedIfCravingAtLeast: 8,
    defaultRank: 14,
  },
  // ORIENTATION
  {
    optionId: "sooth_orient_54321",
    label: "5-4-3-2-1 Grounding",
    sensoryChannel: "orientation",
    instruction: "5 dingen zien, 4 dingen voelen, 3 dingen horen, 2 dingen ruiken, 1 ding proeven.",
    allowedZones: ["GROEN", "GEEL", "ORANJE", "ROOD"],
    defaultRank: 15,
  },
  {
    optionId: "sooth_orient_name_place",
    label: "Benoem Waar Je Bent",
    sensoryChannel: "orientation",
    instruction: "Zeg hardop: 'Ik ben [naam], ik ben in [plek], het is [dag/tijd].' Dit helpt bij dissociatie.",
    allowedZones: ["ORANJE", "ROOD"],
    defaultRank: 16,
  },
  // TASTE
  {
    optionId: "sooth_taste_sour",
    label: "Iets Zuurs Proeven",
    sensoryChannel: "taste",
    instruction: "Proef iets zuurs (citroen, azijn op je tong). De intense smaak brengt je terug in het nu.",
    allowedZones: ["ORANJE", "ROOD"],
    excludedIfMedicalRisk: true,
    defaultRank: 17,
  },
];

// ─── Soothing Flow Builder ────────────────────────────────────────────────────

export interface BuildSoothingFlowInput {
  persona: RecoFreePersona;
  mood: VspMoodSlidersSnapshot;
  immutableCore: ImmutableSafetyCoreSnapshot;
  profile: VspInsightProfile | null;
}

/**
 * Build a DGT soothing flow with safety-filtered options.
 * Returns max 3 options, ranked by relevance and personalization.
 */
export function buildDgtSoothingFlow(input: BuildSoothingFlowInput): VspDgtSoothingFlow {
  const { persona, mood, immutableCore, profile } = input;

  // Safety filter options
  const filtered = filterSoothingOptions(DEFAULT_SOOTHING_OPTIONS, mood, immutableCore);
  const safetyFiltered = filtered.length < DEFAULT_SOOTHING_OPTIONS.length;

  // Personalize ranking if profile exists
  let ranked: VspSoothingOption[];
  if (profile && profile.soothingProfile.personalizedEffectiveOptions.length > 0) {
    ranked = personalizeRanking(filtered, profile);
  } else {
    ranked = filtered.sort((a, b) => a.defaultRank - b.defaultRank);
  }

  // Select top 3
  const selected = ranked.slice(0, 3);

  // Build intro text
  const intro = buildSoothingIntro(persona, mood);

  return {
    selectedOptions: selected,
    userFacingIntro: intro,
    safetyFiltered,
  };
}

// ─── Safety Filtering ─────────────────────────────────────────────────────────

function filterSoothingOptions(
  options: VspSoothingOption[],
  mood: VspMoodSlidersSnapshot,
  immutableCore: ImmutableSafetyCoreSnapshot
): VspSoothingOption[] {
  const zone = immutableCore.finalZone;

  return options.filter((opt) => {
    // Zone filter
    if (!opt.allowedZones.includes(zone)) return false;

    // Craving filter
    if (opt.excludedIfCravingAtLeast && mood.craving >= opt.excludedIfCravingAtLeast) {
      return false;
    }

    // Dissociation filter (high despondency + low focus = possible dissociation)
    if (opt.excludedIfDissociation && mood.despondency >= 8 && mood.focus <= 2) {
      return false;
    }

    // Self-harm risk filter
    if (opt.excludedIfSelfHarmRisk && immutableCore.crisisDetected) {
      return false;
    }

    // Medical risk filter
    if (opt.excludedIfMedicalRisk && immutableCore.crisisDetected) {
      return false;
    }

    return true;
  });
}

// ─── Personalization ──────────────────────────────────────────────────────────

function personalizeRanking(
  options: VspSoothingOption[],
  profile: VspInsightProfile
): VspSoothingOption[] {
  const effectiveIds = new Set(
    profile.soothingProfile.personalizedEffectiveOptions
      .filter((o) => o.averageEffectScore >= 6)
      .map((o) => o.optionId)
  );

  const excludedIds = new Set(
    profile.soothingProfile.excludedOptions.map((o) => o.optionId)
  );

  // Remove excluded options
  const available = options.filter((o) => !excludedIds.has(o.optionId));

  // Sort: effective first, then by default rank
  return available.sort((a, b) => {
    const aEffective = effectiveIds.has(a.optionId) ? 0 : 1;
    const bEffective = effectiveIds.has(b.optionId) ? 0 : 1;
    if (aEffective !== bEffective) return aEffective - bEffective;
    return a.defaultRank - b.defaultRank;
  });
}

// ─── Intro Text ───────────────────────────────────────────────────────────────

function buildSoothingIntro(persona: RecoFreePersona, mood: VspMoodSlidersSnapshot): string {
  if (persona === "kim") {
    return "Ik merk dat het nu zwaar is. Laten we even iets proberen om je zenuwstelsel te kalmeren. Kies wat bij je past:";
  }

  if (mood.craving >= 7) {
    return "De craving is nu sterk. Laten we eerst je lichaam kalmeren voordat we verder praten. Probeer één van deze:";
  }

  if (mood.frustration >= 7) {
    return "Ik voel dat de spanning hoog is. Laten we even gronden. Kies wat nu het meest haalbaar voelt:";
  }

  return "Laten we even pauzeren en je zenuwstelsel helpen kalmeren. Kies wat bij je past:";
}

/**
 * Get all available soothing options (for testing/display).
 */
export function getAllSoothingOptions(): VspSoothingOption[] {
  return [...DEFAULT_SOOTHING_OPTIONS];
}

/**
 * Get soothing options by sensory channel.
 */
export function getSoothingByChannel(channel: VspSensoryChannel): VspSoothingOption[] {
  return DEFAULT_SOOTHING_OPTIONS.filter((o) => o.sensoryChannel === channel);
}
