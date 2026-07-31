/**
 * Zone-based Prevention Plan Field Selector
 *
 * Selects only the relevant prevention plan fields based on the current zone.
 * - Elias: uses VSP level (PAARS/ROOD/ORANJE/GEEL/LICHTGROEN/GROEN)
 * - Kim: uses eigenRegie score → zone mapping (0-100 → ROOD/ORANJE/GEEL/LICHTGROEN/GROEN)
 *
 * Zone → Field mapping:
 * PAARS  → supportContacts (+ crisis flow handles the rest)
 * ROOD   → warningSigns + supportContacts
 * ORANJE → warningSigns + copingStrategies
 * GEEL   → copingStrategies + safeActivities
 * LICHTGROEN → safeActivities + motivation
 * GROEN  → motivation
 */

export interface PreventionPlan {
  warningSigns?: string;
  copingStrategies?: string;
  supportContacts?: string;
  safeActivities?: string;
  motivation?: string;
}

export interface ZoneFilteredPlan {
  /** The fields relevant to the current zone */
  fields: Partial<PreventionPlan>;
  /** The zone that was used for filtering */
  zone: string;
  /** Whether the plan has any content at all */
  hasPlan: boolean;
}

/**
 * Determines the effective zone for prevention plan filtering.
 * - Elias: uses vspLevel directly
 * - Kim: maps eigenRegie score (0-100) to zone
 */
export function getEffectiveZone(
  userType: 'elias' | 'kim',
  vspLevel: string | null,
  eigenRegieScore: number | null,
): string {
  if (userType === 'elias') {
    return vspLevel ?? 'GROEN';
  }
  // Kim: eigenRegie 0-100 → zone
  if (eigenRegieScore == null) return 'GROEN';
  if (eigenRegieScore <= 20) return 'ROOD';
  if (eigenRegieScore <= 40) return 'ORANJE';
  if (eigenRegieScore <= 60) return 'GEEL';
  if (eigenRegieScore <= 80) return 'LICHTGROEN';
  return 'GROEN';
}

/**
 * Filters the prevention plan to only include zone-relevant fields.
 *
 * For Elias: full zone-based field selection.
 * For Kim: sends full plan when zone is ROOD/ORANJE (eigenRegie ≤ 40),
 *          otherwise only motivation/safeActivities.
 */
export function filterPreventionPlanByZone(
  plan: PreventionPlan | null | undefined,
  userType: 'elias' | 'kim',
  vspLevel: string | null,
  eigenRegieScore: number | null,
): ZoneFilteredPlan {
  if (!plan) {
    return { fields: {}, zone: getEffectiveZone(userType, vspLevel, eigenRegieScore), hasPlan: false };
  }

  const hasAnyContent = Object.values(plan).some(v => v && typeof v === 'string' && v.trim().length > 0);
  if (!hasAnyContent) {
    return { fields: {}, zone: getEffectiveZone(userType, vspLevel, eigenRegieScore), hasPlan: false };
  }

  const zone = getEffectiveZone(userType, vspLevel, eigenRegieScore);

  if (userType === 'kim') {
    // Kim: full plan at ROOD/ORANJE, partial at GEEL, minimal at LICHTGROEN/GROEN
    if (zone === 'ROOD' || zone === 'ORANJE') {
      return { fields: { ...plan }, zone, hasPlan: true };
    }
    if (zone === 'GEEL') {
      return { fields: pick(plan, 'copingStrategies', 'safeActivities'), zone, hasPlan: true };
    }
    return { fields: pick(plan, 'motivation'), zone, hasPlan: true };
  }

  // Elias: zone-specific field selection
  switch (zone) {
    case 'PAARS':
      return { fields: pick(plan, 'supportContacts'), zone, hasPlan: true };
    case 'ROOD':
      return { fields: pick(plan, 'warningSigns', 'supportContacts'), zone, hasPlan: true };
    case 'ORANJE':
      return { fields: pick(plan, 'warningSigns', 'copingStrategies'), zone, hasPlan: true };
    case 'GEEL':
      return { fields: pick(plan, 'copingStrategies', 'safeActivities'), zone, hasPlan: true };
    case 'LICHTGROEN':
      return { fields: pick(plan, 'safeActivities', 'motivation'), zone, hasPlan: true };
    case 'GROEN':
    default:
      return { fields: pick(plan, 'motivation'), zone, hasPlan: true };
  }
}

/** Pick only non-empty fields from the plan */
function pick(plan: PreventionPlan, ...keys: (keyof PreventionPlan)[]): Partial<PreventionPlan> {
  const result: Partial<PreventionPlan> = {};
  for (const key of keys) {
    if (plan[key] && typeof plan[key] === 'string' && plan[key]!.trim().length > 0) {
      result[key] = plan[key];
    }
  }
  return result;
}
