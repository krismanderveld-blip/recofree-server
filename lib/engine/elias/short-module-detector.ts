/**
 * Short Module Detector — Lightweight keyword-based routing for M05-M85.
 *
 * Strategy: Each module has 5 detected_tags (e.g., 'structural_loneliness').
 * We split each tag into words and check if those words appear in the user message.
 * A module "matches" when 2+ of its tag-words appear in the text.
 * The module with the highest match score wins.
 *
 * This runs BEFORE GPT — it's a fast heuristic, not a semantic classifier.
 * The GPT model itself will do the final clinical annotation.
 */
import { SHORT_MODULE_TAG_MAP } from './short-module-routing';

// Build a reverse map: moduleId → list of keywords derived from its tags
interface ModuleKeywords {
  moduleId: string;
  keywords: string[]; // individual words extracted from tag names
  dutchKeywords: string[]; // Dutch equivalents for common concepts
}

// Dutch translations for common tag words
const DUTCH_MAP: Record<string, string[]> = {
  loneliness: ['eenzaam', 'alleen'],
  trust: ['vertrouwen'],
  rupture: ['breuk', 'gebroken'],
  closeness: ['nabijheid', 'dichtbij'],
  panic: ['paniek'],
  attachment: ['hechting', 'gehecht'],
  intimacy: ['intimiteit'],
  sleep: ['slaap', 'slapen'],
  craving: ['craving', 'trek', 'zucht', 'verlangen'],
  perfectionism: ['perfectionisme', 'perfect'],
  pressure: ['druk'],
  grief: ['rouw', 'verdriet'],
  loss: ['verlies', 'verloren'],
  overload: ['overbelast', 'te veel'],
  trauma: ['trauma'],
  childhood: ['kindertijd', 'vroeger', 'opgegroeid'],
  rejection: ['afwijzing', 'afgewezen'],
  shame: ['schaamte', 'schaam'],
  worthlessness: ['waardeloos', 'niks waard'],
  abandonment: ['verlating', 'verlaten'],
  fear: ['angst', 'bang'],
  invisibility: ['onzichtbaar'],
  outsider: ['buitenstaander'],
  misunderstood: ['niet begrepen', 'begrijpt niet'],
  control: ['controle'],
  instability: ['instabiel'],
  anger: ['woede', 'boos', 'kwaad'],
  confrontation: ['confrontatie'],
  self: ['zelf'],
  medication: ['medicatie', 'middel'],
  relapse: ['terugval', 'hervallen'],
  body: ['lichaam'],
  identity: ['identiteit', 'wie ben ik'],
  guilt: ['schuld', 'schuldig'],
  parentification: ['parentificatie', 'zorgen voor'],
  suicidal: ['dood', 'niet meer willen'],
  financial: ['financieel', 'geld', 'schulden'],
  dissociation: ['dissociatie', 'afwezig', 'weg'],
  pain: ['pijn'],
  codependency: ['co-afhankelijk', 'medeafhankelijk'],
  existential: ['existentieel', 'zinloos'],
  ambivalence: ['ambivalent', 'twijfel'],
  nostalgia: ['nostalgie', 'mis'],
  isolation: ['isolatie', 'geïsoleerd'],
  explosion: ['ontplof', 'uitbarsting'],
  numbing: ['gevoelloos', 'verdoofd'],
  helplessness: ['hulpeloos', 'machteloos'],
  hopelessness: ['hopeloos', 'zinloos'],
  emptiness: ['leegte', 'leeg'],
  betrayal: ['verraad', 'verraden'],
  boundary: ['grens', 'grenzen'],
  exhaustion: ['uitgeput', 'moe', 'op'],
  powerlessness: ['machteloos', 'hulpeloos'],
  vulnerability: ['kwetsbaar'],
  hypervigilance: ['waakzaam', 'alert', 'op je hoede'],
  avoidance: ['vermijding', 'vermijden', 'ontwijken'],
  sabotage: ['sabotage', 'saboteren'],
  dependency: ['afhankelijk', 'afhankelijkheid'],
  restlessness: ['onrust', 'onrustig'],
  boredom: ['verveling', 'saai', 'niets te doen'],
  meaninglessness: ['zinloos', 'betekenisloos'],
  jealousy: ['jaloezie', 'jaloers'],
  comparison: ['vergelijken', 'vergelijking'],
  stagnation: ['stilstand', 'vastgelopen'],
  regression: ['terugval', 'achteruit'],
  fatigue: ['moeheid', 'vermoeid'],
  overwhelm: ['overweldigd', 'overspoeld'],
};

// Build module keyword sets from the tag map
const MODULE_KEYWORDS: ModuleKeywords[] = (() => {
  // Group tags by module
  const moduleTagsMap: Record<string, string[]> = {};
  for (const [tag, moduleId] of Object.entries(SHORT_MODULE_TAG_MAP)) {
    if (!moduleTagsMap[moduleId]) moduleTagsMap[moduleId] = [];
    moduleTagsMap[moduleId].push(tag);
  }

  return Object.entries(moduleTagsMap).map(([moduleId, tags]) => {
    // Extract unique words from all tags (split on underscore)
    const wordSet = new Set<string>();
    const dutchSet = new Set<string>();

    for (const tag of tags) {
      const words = tag.split('_');
      for (const word of words) {
        if (word.length >= 4) { // Skip short words like 'no', 'as', 'to'
          wordSet.add(word);
          // Add Dutch equivalents
          const dutch = DUTCH_MAP[word];
          if (dutch) {
            for (const d of dutch) dutchSet.add(d);
          }
        }
      }
    }

    return {
      moduleId,
      keywords: Array.from(wordSet),
      dutchKeywords: Array.from(dutchSet),
    };
  });
})();

/**
 * Detect the best matching short module for a user message.
 * Returns module ID (e.g., 'M05') or null if no strong match.
 *
 * Requires at least 2 keyword matches to activate (prevents false positives).
 */
export function detectShortModuleTrigger(text: string): string | null {
  const lower = text.toLowerCase();
  let bestModule: string | null = null;
  let bestScore = 0;

  for (const { moduleId, keywords, dutchKeywords } of MODULE_KEYWORDS) {
    let score = 0;

    // Check English keywords (from tag names)
    for (const kw of keywords) {
      if (lower.includes(kw)) score++;
    }

    // Check Dutch keywords
    for (const kw of dutchKeywords) {
      if (lower.includes(kw)) score++;
    }

    if (score > bestScore) {
      bestScore = score;
      bestModule = moduleId;
    }
  }

  // Require at least 2 matches to avoid false positives
  return bestScore >= 2 ? bestModule : null;
}
