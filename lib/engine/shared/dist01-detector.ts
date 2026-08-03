/**
 * DIST01 — Detector
 *
 * Deterministic extraction of entities, signals, and context from user text.
 * Runs on EVERY user message (chat, diary, gratitude, check-in).
 * No LLM call — uses pattern matching, NLP heuristics, and keyword detection.
 *
 * Design principles:
 * - Fast: must complete in <10ms (no async, no network)
 * - Conservative: prefer false negatives over false positives
 * - Dutch-first: patterns optimized for Dutch input (with English fallback)
 * - Privacy: never logs raw user text externally
 */
import type {
  DetectorInput,
  DetectorOutput,
  DetectedEntity,
  DetectedSignal,
  DetectedContext,
  EntityType,
  SignalType,
  ContextType,
  DistillationConfidence,
} from './dist01-types';

// ─── Name Detection Patterns ───────────────────────────────────────────────

/**
 * Dutch/English relationship indicators that precede or follow a name.
 * Format: [pattern, relationship_label]
 */
const RELATIONSHIP_PATTERNS: Array<[RegExp, string]> = [
  // Dutch
  [/\bmijn\s+(vrouw|echtgenote)\s+(\p{Lu}\p{Ll}+)/iu, 'partner'],
  [/\bmijn\s+(man|echtgenoot)\s+(\p{Lu}\p{Ll}+)/iu, 'partner'],
  [/\bmijn\s+(vriendin|vriend|partner|lief)\s+(\p{Lu}\p{Ll}+)/iu, 'partner'],
  [/\bmijn\s+(ex|ex-vriendin|ex-vriend|ex-partner|ex-man|ex-vrouw)\s+(\p{Lu}\p{Ll}+)/iu, 'ex-partner'],
  [/\bmijn\s+(moeder|mama|mam)\s+(\p{Lu}\p{Ll}+)/iu, 'moeder'],
  [/\bmijn\s+(vader|papa|pap)\s+(\p{Lu}\p{Ll}+)/iu, 'vader'],
  [/\bmijn\s+(zus|zusje)\s+(\p{Lu}\p{Ll}+)/iu, 'zus'],
  [/\bmijn\s+(broer|broertje)\s+(\p{Lu}\p{Ll}+)/iu, 'broer'],
  [/\bmijn\s+(dochter)\s+(\p{Lu}\p{Ll}+)/iu, 'dochter'],
  [/\bmijn\s+(zoon|zoontje)\s+(\p{Lu}\p{Ll}+)/iu, 'zoon'],
  [/\bmijn\s+(kind|kindje)\s+(\p{Lu}\p{Ll}+)/iu, 'kind'],
  [/\bmijn\s+(therapeut|psycholoog|psychiater|dokter|arts|huisarts)\s+(\p{Lu}\p{Ll}+)/iu, 'therapeut'],
  [/\bmijn\s+(baas|leidinggevende|manager|chef)\s+(\p{Lu}\p{Ll}+)/iu, 'leidinggevende'],
  [/\bmijn\s+(collega)\s+(\p{Lu}\p{Ll}+)/iu, 'collega'],
  [/\bmijn\s+(buurman|buurvrouw)\s+(\p{Lu}\p{Ll}+)/iu, 'buur'],
  [/\bmijn\s+(oma|grootmoeder)\s+(\p{Lu}\p{Ll}+)/iu, 'grootmoeder'],
  [/\bmijn\s+(opa|grootvader)\s+(\p{Lu}\p{Ll}+)/iu, 'grootvader'],
  [/\bmijn\s+(schoonmoeder|schoonvader|schoonzus|schoonbroer)\s+(\p{Lu}\p{Ll}+)/iu, 'schoonfamilie'],
  [/\bmijn\s+(stiefmoeder|stiefvader)\s+(\p{Lu}\p{Ll}+)/iu, 'stieffamilie'],
  // Reversed: "Lisa, mijn vriendin"
  [/\b(\p{Lu}\p{Ll}+),?\s+mijn\s+(vrouw|echtgenote|vriendin|vriend|partner|lief)/iu, 'partner'],
  [/\b(\p{Lu}\p{Ll}+),?\s+mijn\s+(ex|ex-vriendin|ex-vriend|ex-partner)/iu, 'ex-partner'],
  [/\b(\p{Lu}\p{Ll}+),?\s+mijn\s+(moeder|mama|vader|papa)/iu, 'ouder'],
  [/\b(\p{Lu}\p{Ll}+),?\s+mijn\s+(zus|zusje|broer|broertje)/iu, 'sibling'],
  [/\b(\p{Lu}\p{Ll}+),?\s+mijn\s+(dochter|zoon|kind)/iu, 'kind'],
  [/\b(\p{Lu}\p{Ll}+),?\s+mijn\s+(therapeut|psycholoog|psychiater|dokter)/iu, 'therapeut'],
  // English fallbacks
  [/\bmy\s+(wife|husband|girlfriend|boyfriend|partner)\s+(\p{Lu}\p{Ll}+)/iu, 'partner'],
  [/\bmy\s+(ex|ex-girlfriend|ex-boyfriend|ex-wife|ex-husband)\s+(\p{Lu}\p{Ll}+)/iu, 'ex-partner'],
  [/\bmy\s+(mother|mom|mum|father|dad)\s+(\p{Lu}\p{Ll}+)/iu, 'ouder'],
  [/\bmy\s+(sister|brother)\s+(\p{Lu}\p{Ll}+)/iu, 'sibling'],
  [/\bmy\s+(daughter|son|child|kid)\s+(\p{Lu}\p{Ll}+)/iu, 'kind'],
  [/\bmy\s+(therapist|psychologist|psychiatrist|doctor)\s+(\p{Lu}\p{Ll}+)/iu, 'therapeut'],
];

/**
 * Standalone name detection: capitalized words that appear in conversational context.
 * Only matches names that appear with a verb or preposition (to avoid false positives on nouns).
 */
const NAME_CONTEXT_PATTERNS: RegExp[] = [
  // "met [Name]", "van [Name]", "bij [Name]", "naar [Name]", "over [Name]"
  /\b(?:met|van|bij|naar|over|tegen|voor|zonder)\s+(\p{Lu}\p{Ll}{2,})\b/gu,
  // "[Name] zei/zegt/vindt/wil/heeft/is/was/deed/doet"
  /\b(\p{Lu}\p{Ll}{2,})\s+(?:zei|zegt|vindt|wil|heeft|is|was|deed|doet|kan|mag|moet|komt|ging|gaat|belt|belde|vraagt|vroeg)\b/gu,
  // "en [Name]", "of [Name]" (in context of listing people)
  /\b(?:en|of)\s+(\p{Lu}\p{Ll}{2,})\s+(?:ook|zei|zegt|vindt|wil|heeft|is|was)\b/gu,
];

/**
 * Words that look like names but aren't (Dutch/English common nouns that start with capital in sentences).
 */
const FALSE_POSITIVE_NAMES = new Set([
  'God', 'Allah', 'Jezus', 'Maria', 'Kerstmis', 'Pasen', 'Sinterklaas',
  'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag',
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus',
  'September', 'Oktober', 'November', 'December',
  'België', 'Nederland', 'Vlaanderen', 'Wallonië', 'Brussel', 'Antwerpen',
  'Gent', 'Brugge', 'Leuven', 'Luik', 'Amsterdam', 'Rotterdam', 'Utrecht',
  'Europa', 'Afrika', 'Azië', 'Amerika',
  'Elias', 'Kim', 'RecoFree', // App personas
  'Internet', 'Facebook', 'Instagram', 'WhatsApp', 'Tinder',
  'AA', 'NA', 'CAW', 'OCMW', 'CGG', 'VDAB',
]);

// ─── Signal Detection Patterns ─────────────────────────────────────────────

interface SignalPattern {
  pattern: RegExp;
  signalType: SignalType;
  normalizer: (match: RegExpMatchArray) => string;
}

const SIGNAL_PATTERNS: SignalPattern[] = [
  // ─── Trigger patterns (structured Dutch) ────────────────────────────────
  { pattern: /\bals\s+(.{5,60})\s+(?:dan|word ik|voel ik|krijg ik|begin ik)/iu, signalType: 'new_trigger_detected', normalizer: (m) => `trigger: ${m[1].trim()}` },
  { pattern: /\b(?:telkens|elke keer|steeds)\s+(?:als|wanneer)\s+(.{5,60})/iu, signalType: 'recurring_trigger_detected', normalizer: (m) => `herhalende trigger: ${m[1].trim()}` },
  { pattern: /\b(?:ik word|ik voel me|ik raak)\s+(.{3,30})\s+(?:als|wanneer|door)\s+(.{5,40})/iu, signalType: 'new_trigger_detected', normalizer: (m) => `trigger: ${m[2].trim()} → ${m[1].trim()}` },

  // ─── Valkuil / trigger (natural speech — addiction recovery) ─────────────
  { pattern: /\b(.{3,50})\s+is\s+(?:mijn|een)?\s*(?:grootste?\s+)?(?:valkuil|zwakte|gevaar|risico)\b/iu, signalType: 'new_trigger_detected', normalizer: (m) => `trigger (valkuil): ${m[1].trim()}` },
  { pattern: /\b(?:mijn\s+(?:grootste?\s+)?(?:valkuil|zwakte|gevaar|risico)\s+is)\s+(.{3,50})/iu, signalType: 'new_trigger_detected', normalizer: (m) => `trigger (valkuil): ${m[1].trim()}` },
  { pattern: /\b(?:bij|voor|met|door)\s+(.{3,40})\s+(?:moet ik oppassen|ben ik kwetsbaar|verlies ik mezelf|word ik zwak)/iu, signalType: 'new_trigger_detected', normalizer: (m) => `trigger: ${m[1].trim()}` },
  { pattern: /\b(.{3,40})\s+(?:trekt me|lokt me|verleidt me|triggert me|maakt me zwak)/iu, signalType: 'new_trigger_detected', normalizer: (m) => `trigger: ${m[1].trim()}` },
  { pattern: /\b(?:ik kan niet weerstaan|ik kan er niet tegen|ik ben zwak voor)\s+(.{3,40})/iu, signalType: 'new_trigger_detected', normalizer: (m) => `trigger: ${m[1].trim()}` },
  { pattern: /\b(?:dat is|dat was)\s+(?:een\s+)?(?:trigger|valkuil|risicosituatie|gevaarlijk moment)\b/iu, signalType: 'new_trigger_detected', normalizer: (m) => `trigger: ${m[0].trim()}` },

  // ─── Terugval / relapse patterns ────────────────────────────────────────
  { pattern: /\b(?:ik heb\s+(?:een\s+)?)?terugval\s+(?:gehad|meegemaakt|gedaan)\b/iu, signalType: 'risk_pattern_detected', normalizer: (m) => `terugval: ${m[0].trim()}` },
  { pattern: /\b(?:ik ben\s+)?teruggevallen\b/iu, signalType: 'risk_pattern_detected', normalizer: (m) => `terugval: ${m[0].trim()}` },
  { pattern: /\b(?:ik heb\s+)?(?:weer|opnieuw)\s+(?:gebruikt|gedronken|gerookt|genomen|gesnoven|gespoten|gegokt)/iu, signalType: 'risk_pattern_detected', normalizer: (m) => `terugval: ${m[0].trim()}` },
  { pattern: /\b(?:het is\s+)?(?:weer\s+)?(?:fout|mis)\s+gegaan/iu, signalType: 'risk_pattern_detected', normalizer: (m) => `terugval: ${m[0].trim()}` },
  { pattern: /\b(?:ik heb\s+)?(?:hervallen|herval\s+gehad)\b/iu, signalType: 'risk_pattern_detected', normalizer: (m) => `terugval: ${m[0].trim()}` },
  { pattern: /\b(?:vorig\s+weekend|gisteren|laatst|vorige\s+week)\s+(?:heb ik|ben ik)\s+(.{5,50})/iu, signalType: 'risk_pattern_detected', normalizer: (m) => `terugval: ${m[0].trim()}` },

  // ─── Anchor sentence patterns (addiction recovery — nuchter/kracht) ──────
  { pattern: /\b(.{5,60})\s+(?:geeft me kracht|kracht geven|kracht geeft|houdt me nuchter|helpt me nuchter|houdt me clean|helpt me clean|nuchter te blijven|clean te blijven)/iu, signalType: 'anchor_sentence_detected', normalizer: (m) => `ankerzin: ${m[0].trim()}` },
  { pattern: /\b(?:ik doe het voor|ik blijf nuchter voor|ik blijf clean voor|ik stop voor)\s+(.{3,40})/iu, signalType: 'anchor_sentence_detected', normalizer: (m) => `ankerzin: ${m[0].trim()}` },
  { pattern: /\b(?:nuchter blijven|clean blijven|clean zijn|nuchter zijn)\s+(?:is|betekent|voelt|geeft)\s+(.{3,50})/iu, signalType: 'anchor_sentence_detected', normalizer: (m) => `ankerzin: ${m[0].trim()}` },
  { pattern: /\b(?:ik wil|ik ga|ik kies voor)\s+(?:nuchter|clean|sober)\s+(?:blijven|leven|zijn)/iu, signalType: 'anchor_sentence_detected', normalizer: (m) => `ankerzin: ${m[0].trim()}` },
  { pattern: /\b(?:mijn motivatie is|mijn reden is|daarom stop ik|daarom blijf ik nuchter)\b/iu, signalType: 'anchor_sentence_detected', normalizer: (m) => `ankerzin: ${m[0].trim()}` },

  // ─── Patroonherkenning / recurring pattern recognition ──────────────────
  { pattern: /\b(?:dat herken ik|ik herken dat|dat is een patroon|ik zie het patroon|ik zie een patroon)/iu, signalType: 'recurring_trigger_detected', normalizer: (m) => `patroonherkenning: ${m[0].trim()}` },
  { pattern: /\b(?:ik doe dat altijd|dat doe ik steeds|ik val altijd terug op|dat overkomt me steeds)/iu, signalType: 'recurring_trigger_detected', normalizer: (m) => `patroonherkenning: ${m[0].trim()}` },
  { pattern: /\b(?:het is altijd hetzelfde|het herhaalt zich|dit patroon|hetzelfde patroon)/iu, signalType: 'recurring_trigger_detected', normalizer: (m) => `patroonherkenning: ${m[0].trim()}` },
  { pattern: /\b(?:ik merk|ik zie)\s+(?:dat ik|bij mezelf)\s+(.{5,50})/iu, signalType: 'recurring_trigger_detected', normalizer: (m) => `patroonherkenning: ${m[0].trim()}` },

  // ─── Craving / zucht / trek ─────────────────────────────────────────────
  { pattern: /\b(?:ik heb\s+)?(?:trek|zin|goesting|craving|zucht)\s+(?:in|naar|om)\s+(.{3,40})/iu, signalType: 'risk_pattern_detected', normalizer: (m) => `craving: ${m[0].trim()}` },
  { pattern: /\b(?:de trek|de zucht|de craving|de verleiding)\s+(?:is|was|wordt)\s+(.{3,40})/iu, signalType: 'risk_pattern_detected', normalizer: (m) => `craving: ${m[0].trim()}` },

  // ─── Boundary patterns ──────────────────────────────────────────────────
  { pattern: /\b(?:ik wil niet meer|ik accepteer niet|mijn grens is|ik trek een grens)\s*(.{0,60})/iu, signalType: 'boundary_pattern_detected', normalizer: (m) => `grens: ${m[0].trim()}` },
  { pattern: /\b(?:dat pik ik niet|genoeg is genoeg|tot hier en niet verder)\b/iu, signalType: 'boundary_pattern_detected', normalizer: (m) => `grens: ${m[0].trim()}` },

  // ─── Self-care / protective patterns ────────────────────────────────────
  { pattern: /\b(?:wat mij helpt is|wat goed werkt is|ik voel me beter als|het helpt als)\s+(.{5,60})/iu, signalType: 'self_care_pattern_detected', normalizer: (m) => `zelfzorg: ${m[1].trim()}` },
  { pattern: /\b(?:wandelen|sporten|mediteren|lezen|muziek|natuur|douchen|slapen)\s+(?:helpt|doet goed|kalmeert|ontspant)/iu, signalType: 'self_care_pattern_detected', normalizer: (m) => `zelfzorg: ${m[0].trim()}` },
  { pattern: /\b(?:als ik\s+)?(?:wandel|sport|mediteer|lees|slaap|beweeg|hardloop|fiets)\s+(?:voel ik me|gaat het|word ik)\s+(?:beter|rustiger|kalmer)/iu, signalType: 'self_care_pattern_detected', normalizer: (m) => `zelfzorg: ${m[0].trim()}` },

  // ─── Support source patterns ────────────────────────────────────────────
  { pattern: /\b(?:ik kan terecht bij|ik bel dan|die steunt mij|die helpt mij)\s*(.{0,40})/iu, signalType: 'support_source_detected', normalizer: (m) => `steun: ${m[0].trim()}` },
  { pattern: /\b(?:mijn sponsor|mijn buddy|mijn groep|mijn AA|mijn NA|mijn therapeut)\s+(.{0,40})/iu, signalType: 'support_source_detected', normalizer: (m) => `steun: ${m[0].trim()}` },

  // ─── Anchor sentence patterns (strong self-statements) ──────────────────
  { pattern: /\b(?:ik ben|ik verdien|ik mag|ik kies|ik kan)\s+(.{5,50})/iu, signalType: 'anchor_sentence_detected', normalizer: (m) => m[0].trim() },

  // ─── Risk patterns ──────────────────────────────────────────────────────
  { pattern: /\b(?:ik heb zin om|ik denk aan|ik overweeg|de verleiding is)\s+(.{5,50})/iu, signalType: 'risk_pattern_detected', normalizer: (m) => `risico: ${m[0].trim()}` },
  { pattern: /\b(?:ik sta op het punt|ik ben bang dat ik|ik weet niet of ik het volhoud)\b/iu, signalType: 'risk_pattern_detected', normalizer: (m) => `risico: ${m[0].trim()}` },

  // ─── Zone signals ───────────────────────────────────────────────────────
  { pattern: /\b(?:ik zit in het rood|alarmsignaal|het gaat niet goed|ik ben in gevaar)\b/iu, signalType: 'zone_signal_detected', normalizer: (m) => `zone-signaal: ${m[0].trim()}` },
  { pattern: /\b(?:ik voel me stabiel|het gaat goed|ik ben rustig|ik ben in balans)\b/iu, signalType: 'zone_signal_detected', normalizer: (m) => `zone-signaal: ${m[0].trim()}` },
  { pattern: /\b(?:ik zit in de gevarenzone|het is code rood|ik ben in oranje|ik zit in het oranje)\b/iu, signalType: 'zone_signal_detected', normalizer: (m) => `zone-signaal: ${m[0].trim()}` },

  // ─── Protective / recovery patterns ─────────────────────────────────────
  { pattern: /\b(?:ik ben al|ik ben nu)\s+(.{1,10})\s+(?:dagen|weken|maanden|jaar)\s+(?:nuchter|clean|sober)/iu, signalType: 'protective_pattern_detected', normalizer: (m) => `beschermend: ${m[0].trim()}` },
  { pattern: /\b(?:mijn herstel|mijn nuchterheid|mijn soberheid)\s+(?:is|betekent|geeft)\s+(.{3,50})/iu, signalType: 'protective_pattern_detected', normalizer: (m) => `beschermend: ${m[0].trim()}` },

  // ─── Kim: Naaste-perspectief addiction patterns ──────────────────────────
  // Terugval van de ander (hij/zij/partner/mijn man/mijn vrouw)
  { pattern: /\b(?:hij|zij|ze|mijn partner|mijn man|mijn vrouw|mijn zoon|mijn dochter)\s+(?:is|heeft)\s+(?:weer\s+)?(?:teruggevallen|hervallen|begonnen met|aan het gebruiken|aan het drinken)/iu, signalType: 'risk_pattern_detected', normalizer: (m) => `terugval naaste: ${m[0].trim()}` },
  { pattern: /\b(?:hij|zij|ze)\s+(?:heeft|had)\s+(?:weer\s+)?(?:een terugval|een herval|gedronken|gebruikt|gerookt|gegokt)/iu, signalType: 'risk_pattern_detected', normalizer: (m) => `terugval naaste: ${m[0].trim()}` },
  // Patroonherkenning bij de ander
  { pattern: /\b(?:ik herken|ik zie)\s+(?:het patroon|dat patroon|hetzelfde)\s+(?:bij hem|bij haar|weer|opnieuw)/iu, signalType: 'recurring_trigger_detected', normalizer: (m) => `patroon naaste: ${m[0].trim()}` },
  { pattern: /\b(?:het is altijd hetzelfde|het herhaalt zich|weer hetzelfde verhaal|dezelfde cyclus)\s+(?:bij hem|bij haar|met hem|met haar)/iu, signalType: 'recurring_trigger_detected', normalizer: (m) => `patroon naaste: ${m[0].trim()}` },
  { pattern: /\b(?:hij|zij|ze)\s+(?:doet|zegt|belooft)\s+(?:altijd|steeds|weer)\s+(?:hetzelfde|dat)/iu, signalType: 'recurring_trigger_detected', normalizer: (m) => `patroon naaste: ${m[0].trim()}` },
  // Opname/behandeling van de ander
  { pattern: /\b(?:hij|zij|ze)\s+(?:is|wordt|gaat|moet)\s+(?:.{0,20}\s+)?(?:opgenomen|in behandeling|naar een kliniek|naar afkicken|naar detox|in therapie)/iu, signalType: 'life_story_detail_detected', normalizer: (m) => `behandeling naaste: ${m[0].trim()}` },
  { pattern: /\b(?:zijn|haar)\s+(?:opname|behandeling|therapie|programma|herstel|nuchterheid)/iu, signalType: 'life_story_detail_detected', normalizer: (m) => `behandeling naaste: ${m[0].trim()}` },
  // Grenzen stellen bij verslaving van de ander
  { pattern: /\b(?:ik kan niet meer|ik trek het niet meer|ik houd het niet vol|ik ben op)\s*(?:met hem|met haar|zo)?/iu, signalType: 'boundary_pattern_detected', normalizer: (m) => `grens naaste: ${m[0].trim()}` },
  { pattern: /\b(?:ik wil niet meer|ik weiger|ik ga niet meer)\s+(?:helpen|redden|opvangen|excuses maken|liegen|dekken)/iu, signalType: 'boundary_pattern_detected', normalizer: (m) => `grens naaste: ${m[0].trim()}` },
  { pattern: /\b(?:ik moet mezelf|mijn eigen leven|mijn eigen gezondheid|mijn eigen grenzen)\s+(?:beschermen|voorop|bewaken|respecteren)/iu, signalType: 'self_care_pattern_detected', normalizer: (m) => `zelfzorg naaste: ${m[0].trim()}` },
  // Enabling / co-afhankelijkheid herkenning
  { pattern: /\b(?:ik doe alles voor|ik neem alles over|ik los alles op|ik dek hem|ik dek haar|ik lieg voor)/iu, signalType: 'recurring_trigger_detected', normalizer: (m) => `co-afhankelijkheid: ${m[0].trim()}` },
  { pattern: /\b(?:ik maak excuses|ik bescherm hem|ik bescherm haar|ik houd het stil|ik verberg het)/iu, signalType: 'recurring_trigger_detected', normalizer: (m) => `co-afhankelijkheid: ${m[0].trim()}` },
  // Steun zoeken als naaste
  { pattern: /\b(?:ik heb niemand|niemand begrijpt|ik sta er alleen voor|wie helpt mij|ik heb ook hulp nodig)/iu, signalType: 'support_source_detected', normalizer: (m) => `steunbehoefte naaste: ${m[0].trim()}` },
  { pattern: /\b(?:de naastengroep|Al-Anon|Nar-Anon|lotgenotengroep|naastencontact|familiegroep)/iu, signalType: 'support_source_detected', normalizer: (m) => `steun naaste: ${m[0].trim()}` },
];

// ─── Context Detection Patterns ────────────────────────────────────────────

interface ContextPattern {
  pattern: RegExp;
  contextType: ContextType;
  extractor: (match: RegExpMatchArray) => string;
}

const CONTEXT_PATTERNS: ContextPattern[] = [
  // Life events
  { pattern: /\b(?:ik ben|we zijn)\s+(?:verhuisd|gescheiden|ontslagen|gestopt|begonnen|getrouwd)\b/iu, contextType: 'life_event', extractor: (m) => m[0].trim() },
  { pattern: /\b(?:vorige week|gisteren|vandaag|recent|laatst)\s+(.{10,60})\s+(?:gebeurd|geweest|gehad)/iu, contextType: 'life_event', extractor: (m) => m[0].trim() },

  // Current situation
  { pattern: /\b(?:ik werk als|ik ben)\s+([\p{L}\s]{3,30})/iu, contextType: 'current_situation', extractor: (m) => m[0].trim() },
  { pattern: /\b(?:ik woon|we wonen)\s+(.{5,40})/iu, contextType: 'current_situation', extractor: (m) => m[0].trim() },

  // Treatment / opname / therapy (addiction recovery context)
  { pattern: /\b(?:ik zit in|ik ben in)\s+(?:opname|behandeling|therapie|revalidatie|detox|afkickkliniek|dagbehandeling)/iu, contextType: 'current_situation', extractor: (m) => m[0].trim() },
  { pattern: /\b(?:ik ben|ik ga|ik word)\s+(?:opgenomen|vrijwillig opgenomen|gedwongen opgenomen)/iu, contextType: 'current_situation', extractor: (m) => m[0].trim() },
  { pattern: /\b(?:ik volg|ik doe|ik zit in)\s+(?:een programma|een traject|groepstherapie|individuele therapie|ambulante behandeling)/iu, contextType: 'current_situation', extractor: (m) => m[0].trim() },
  { pattern: /\b(?:ik ga naar|ik kom bij)\s+(?:AA|NA|zelfhulpgroep|lotgenoten|groep)/iu, contextType: 'current_situation', extractor: (m) => m[0].trim() },

  // Goals
  { pattern: /\b(?:mijn doel is|ik wil|ik hoop|ik streef naar)\s+(.{5,60})/iu, contextType: 'goal', extractor: (m) => m[0].trim() },

  // Fears
  { pattern: /\b(?:ik ben bang|ik vrees|mijn angst is|ik maak me zorgen)\s+(.{5,60})/iu, contextType: 'fear', extractor: (m) => m[0].trim() },

  // Values
  { pattern: /\b(?:belangrijk voor mij is|wat ik waardeer|mijn waarden|ik geloof in)\s+(.{5,50})/iu, contextType: 'value', extractor: (m) => m[0].trim() },
];

// ─── Detector Implementation ───────────────────────────────────────────────

/**
 * Run the DIST01 detector on user text.
 * Returns detected entities, signals, and contexts.
 * Deterministic, no network calls, <10ms execution.
 */
export function detectDistillation(input: DetectorInput): DetectorOutput {
  const { userText, userName } = input;

  // Skip very short messages (greetings, single words)
  if (userText.trim().length < 10) {
    return { entities: [], signals: [], contexts: [] };
  }

  const entities = detectEntities(userText, userName);
  const signals = detectSignals(userText);
  const contexts = detectContexts(userText);

  return { entities, signals, contexts };
}

// ─── Entity Detection ──────────────────────────────────────────────────────

function detectEntities(text: string, userName: string): DetectedEntity[] {
  const detected: DetectedEntity[] = [];
  const seenNames = new Set<string>();

  // 1. Relationship-based detection (highest confidence)
  for (const [pattern, relation] of RELATIONSHIP_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      // Name is in the last capture group for "mijn X Name" patterns
      // or first capture group for "Name, mijn X" patterns
      const name = match[2] || match[1];
      if (name && !isExcludedName(name, userName) && !seenNames.has(name.toLowerCase())) {
        seenNames.add(name.toLowerCase());
        detected.push({
          entityType: 'person',
          name,
          relation: normalizeRelation(relation),
          valence: 'neutral',
          contextSnippet: extractSnippet(text, name),
          confidence: 'high',
        });
      }
    }
  }

  // 2. Context-based name detection (medium confidence)
  for (const pattern of NAME_CONTEXT_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1];
      if (name && !isExcludedName(name, userName) && !seenNames.has(name.toLowerCase())) {
        seenNames.add(name.toLowerCase());
        detected.push({
          entityType: 'person',
          name,
          relation: null,
          valence: inferValence(text, name),
          contextSnippet: extractSnippet(text, name),
          confidence: 'medium',
        });
      }
    }
  }

  return detected;
}

// ─── Signal Detection ──────────────────────────────────────────────────────

function detectSignals(text: string): DetectedSignal[] {
  const detected: DetectedSignal[] = [];
  const seenNormalized = new Set<string>();

  for (const { pattern, signalType, normalizer } of SIGNAL_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const normalized = normalizer(match);
      const key = `${signalType}:${normalized.toLowerCase()}`;
      if (!seenNormalized.has(key)) {
        seenNormalized.add(key);
        detected.push({
          signalType,
          rawUserTextExcerpt: match[0].slice(0, 100),
          normalizedText: normalized.slice(0, 120),
          confidence: 'medium',
        });
      }
    }
  }

  // Anchor sentence detection: strong "ik" statements with positive self-affirmation
  const anchorPattern = /\b(ik\s+(?:ben|verdien|mag|kies|kan|wil)\s+[\p{L}\s]{5,50})/giu;
  let anchorMatch: RegExpExecArray | null;
  anchorPattern.lastIndex = 0;
  while ((anchorMatch = anchorPattern.exec(text)) !== null) {
    const statement = anchorMatch[1].trim();
    // Only count as anchor if it's positive/empowering
    if (isPositiveStatement(statement)) {
      const key = `anchor_sentence_detected:${statement.toLowerCase()}`;
      if (!seenNormalized.has(key)) {
        seenNormalized.add(key);
        detected.push({
          signalType: 'anchor_sentence_detected',
          rawUserTextExcerpt: statement.slice(0, 100),
          normalizedText: statement.slice(0, 120),
          confidence: 'medium',
        });
      }
    }
  }

  return detected;
}

// ─── Context Detection ─────────────────────────────────────────────────────

function detectContexts(text: string): DetectedContext[] {
  const detected: DetectedContext[] = [];
  const seenSummaries = new Set<string>();

  for (const { pattern, contextType, extractor } of CONTEXT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const summary = extractor(match).slice(0, 100);
      const key = `${contextType}:${summary.toLowerCase()}`;
      if (!seenSummaries.has(key)) {
        seenSummaries.add(key);
        detected.push({
          contextType,
          summary,
          confidence: 'medium',
        });
      }
    }
  }

  return detected;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function isExcludedName(name: string, userName: string): boolean {
  if (name.length < 2 || name.length > 20) return true;
  if (FALSE_POSITIVE_NAMES.has(name)) return true;
  if (name.toLowerCase() === userName.toLowerCase()) return true;
  // Exclude all-caps (likely acronyms)
  if (name === name.toUpperCase()) return true;
  return false;
}

function normalizeRelation(raw: string): string {
  const map: Record<string, string> = {
    'partner': 'partner',
    'ex-partner': 'ex-partner',
    'moeder': 'moeder',
    'vader': 'vader',
    'ouder': 'ouder',
    'zus': 'zus',
    'broer': 'broer',
    'sibling': 'broer/zus',
    'dochter': 'dochter',
    'zoon': 'zoon',
    'kind': 'kind',
    'therapeut': 'therapeut',
    'leidinggevende': 'leidinggevende',
    'collega': 'collega',
    'buur': 'buur',
    'grootmoeder': 'grootmoeder',
    'grootvader': 'grootvader',
    'schoonfamilie': 'schoonfamilie',
    'stieffamilie': 'stieffamilie',
  };
  return map[raw] || raw;
}

function extractSnippet(text: string, name: string): string {
  const idx = text.toLowerCase().indexOf(name.toLowerCase());
  if (idx < 0) return '';
  const start = Math.max(0, idx - 30);
  const end = Math.min(text.length, idx + name.length + 50);
  return text.slice(start, end).trim();
}

function inferValence(text: string, name: string): 'positive' | 'negative' | 'ambivalent' | 'neutral' {
  // Simple heuristic: check words near the name
  const idx = text.toLowerCase().indexOf(name.toLowerCase());
  if (idx < 0) return 'neutral';
  const window = text.slice(Math.max(0, idx - 50), Math.min(text.length, idx + name.length + 50)).toLowerCase();

  const negativeWords = ['ruzie', 'boos', 'kwaad', 'verdrietig', 'pijn', 'bang', 'bedreigd', 'manipuleert', 'liegt', 'slaat', 'schreeuwt', 'kwetst', 'vernedert', 'controleert'];
  const positiveWords = ['steunt', 'helpt', 'lief', 'fijn', 'blij', 'gelukkig', 'trots', 'dankbaar', 'veilig', 'warm', 'liefde', 'vertrouw'];

  const hasNeg = negativeWords.some(w => window.includes(w));
  const hasPos = positiveWords.some(w => window.includes(w));

  if (hasNeg && hasPos) return 'ambivalent';
  if (hasNeg) return 'negative';
  if (hasPos) return 'positive';
  return 'neutral';
}

function isPositiveStatement(statement: string): boolean {
  const lower = statement.toLowerCase();
  const positiveIndicators = [
    'verdien', 'mag', 'kan', 'kies', 'wil groeien', 'wil leren',
    'sterk', 'waardevol', 'goed genoeg', 'trots', 'in staat',
    'niet alleen', 'het waard', 'belangrijk',
  ];
  const negativeIndicators = [
    'niet', 'geen', 'nooit', 'niks waard', 'waardeloos', 'schuldig',
    'bang', 'zwak', 'dom', 'lelijk', 'hopeloos',
  ];

  const posScore = positiveIndicators.filter(w => lower.includes(w)).length;
  const negScore = negativeIndicators.filter(w => lower.includes(w)).length;

  return posScore > negScore;
}
