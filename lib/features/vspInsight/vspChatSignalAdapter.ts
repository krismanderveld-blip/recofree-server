/**
 * VSP Chat Signal Adapter
 *
 * Extracts signal markers from raw message text for VSP Insight detection.
 * Populates VspChatSignalSnapshot from user messages.
 *
 * Supports NL, EN, FR markers.
 * Safety flags are extracted but NEVER override safety core decisions.
 */

import type { VspChatSignalSnapshot, VspSafetyFlags } from "./vspInsightTypes";

// ─── Marker Dictionaries ──────────────────────────────────────────────────────

const RATIONALITY_MARKERS = [
  // NL
  "objectief", "logisch", "rationeel", "eigenlijk", "feitelijk",
  "onder controle", "geen probleem", "niets aan de hand", "ik begrijp",
  "het is wat het is", "ik snap", "dat klopt", "gewoon", "simpelweg",
  "uiteraard", "vanzelfsprekend", "in principe", "theoretisch",
  "als je het zo bekijkt", "puur", "analytisch", "functioneel",
  "maakt niet uit", "het is oké", "ik voel niets", "geen emotie",
  "ik sta erboven", "het raakt me niet", "niet belangrijk",
  "alles onder controle", "ik heb het in de hand", "ik manage het",
  "ik regel het", "ik los het op", "ik kan het aan", "geen hulp nodig",
  "ik red me wel", "ik hoef niets", "het lukt wel",
  // EN
  "objectively", "logically", "rationally", "actually", "factually",
  "under control", "no problem", "nothing wrong", "i understand",
  "it is what it is", "i get it", "simply", "obviously",
  "in principle", "theoretically", "purely", "analytically",
  "doesn't matter", "it's fine", "i feel nothing", "no emotion",
  "i'm above it", "doesn't affect me", "not important",
  "all under control", "i've got it handled", "i manage it",
  "i'll figure it out", "i can handle it", "no help needed",
  // FR
  "objectivement", "logiquement", "rationnellement", "en fait",
  "sous contrôle", "pas de problème", "rien de grave", "je comprends",
  "c'est comme ça", "simplement", "évidemment", "en principe",
  "théoriquement", "purement", "analytiquement",
  "ça ne fait rien", "c'est bon", "je ne ressens rien",
  "tout sous contrôle", "je gère", "pas besoin d'aide",
];

const EMOTIONAL_CONNECTION_MARKERS = [
  // NL
  "ik voel", "dat raakt me", "het doet me", "ik merk",
  "in mijn hart", "in mijn buik", "mijn lichaam", "warm",
  "verbonden", "dankbaar", "ontroerd", "geraakt", "kwetsbaar",
  "teder", "zacht", "dichtbij", "samen",
  // EN
  "i feel", "it touches me", "it affects me", "i notice",
  "in my heart", "in my body", "warm", "connected",
  "grateful", "moved", "touched", "vulnerable", "tender",
  "soft", "close", "together",
  // FR
  "je ressens", "ça me touche", "ça m'affecte", "je remarque",
  "dans mon cœur", "dans mon corps", "chaud", "connecté",
  "reconnaissant", "ému", "touché", "vulnérable",
];

const AVOIDANCE_MARKERS = [
  // NL
  "laat maar", "maakt niet uit", "hoeft niet", "ik wil er niet over praten",
  "het is voorbij", "ik denk er niet aan", "niet belangrijk",
  "ik wil het niet", "liever niet", "laten we het over iets anders hebben",
  "dat hoeft niet", "het gaat wel", "niet nodig",
  // EN
  "never mind", "doesn't matter", "don't need to", "i don't want to talk about it",
  "it's over", "i don't think about it", "not important",
  "i don't want to", "rather not", "let's talk about something else",
  // FR
  "laisse tomber", "ça ne fait rien", "pas besoin", "je ne veux pas en parler",
  "c'est fini", "je n'y pense pas", "pas important",
];

const CRAVING_MARKERS = [
  // NL
  "ik wil gebruiken", "zucht", "trek", "craving", "ik moet scoren",
  "ik ga bellen", "ik wil drinken", "ik wil een pil", "ik wil roken",
  "ik ga het doen", "de verleiding", "ik kan niet weerstaan",
  "het trekt", "mijn lichaam schreeuwt", "ik heb het nodig",
  "ik denk aan gebruiken", "ik wil een shot", "ik wil een lijn",
  // EN
  "i want to use", "craving", "i need to score", "i want to drink",
  "i want a pill", "i want to smoke", "i'm going to do it",
  "temptation", "i can't resist", "my body screams", "i need it",
  // FR
  "je veux consommer", "envie", "je dois scorer", "je veux boire",
  "je veux une pilule", "je veux fumer", "je vais le faire",
  "tentation", "je ne peux pas résister", "j'en ai besoin",
];

const OVERWHELM_MARKERS = [
  // NL
  "ik kan niet meer", "te veel", "overspoeld", "paniek", "ik stik",
  "ik ga stuk", "ik breek", "ik houd het niet vol", "alles is zwart",
  "ik wil stoppen", "ik wil weg", "het houdt niet op", "ik verdwijn",
  "dichtklappen", "bevriezen", "verlamd", "op springen", "exploderen",
  "ik ga door het lint", "ik voel niets meer", "leeg", "dood van binnen",
  "afwezig", "verdoofd", "numb", "uitgeschakeld", "afgesloten",
  // EN
  "i can't anymore", "too much", "overwhelmed", "panic", "i'm suffocating",
  "i'm breaking", "i can't hold on", "everything is black",
  "i want to stop", "i want to leave", "it won't stop", "i'm disappearing",
  "shutting down", "freezing", "paralyzed", "about to explode",
  "i feel nothing", "empty", "dead inside", "absent", "numb",
  // FR
  "je n'en peux plus", "trop", "submergé", "panique", "j'étouffe",
  "je craque", "je ne tiens plus", "tout est noir",
  "je veux arrêter", "je veux partir", "ça ne s'arrête pas",
  "je disparais", "paralysé", "engourdi", "vide", "mort à l'intérieur",
];

const WARMTH_MARKERS = [
  // NL
  "warm", "lief", "zacht", "teder", "dankbaar", "blij",
  "gelukkig", "veilig", "rustig", "kalm", "ontspannen",
  "tevreden", "vredig", "hoopvol", "licht",
  // EN
  "warm", "kind", "soft", "tender", "grateful", "happy",
  "safe", "calm", "relaxed", "content", "peaceful", "hopeful", "light",
  // FR
  "chaud", "doux", "tendre", "reconnaissant", "heureux",
  "en sécurité", "calme", "détendu", "content", "paisible",
];

const EMBODIED_EMOTION_MARKERS = [
  // NL
  "in mijn buik", "in mijn borst", "mijn hart klopt", "trillen",
  "rillen", "zweten", "adem", "ademhaling", "mijn keel",
  "mijn schouders", "spanning in", "mijn lichaam", "fysiek",
  "ik voel het in", "mijn maag", "mijn rug", "mijn hoofd bonkt",
  // EN
  "in my stomach", "in my chest", "my heart is racing", "trembling",
  "shivering", "sweating", "breath", "breathing", "my throat",
  "my shoulders", "tension in", "my body", "physically",
  "i feel it in", "my gut", "my back", "my head is pounding",
  // FR
  "dans mon ventre", "dans ma poitrine", "mon cœur bat", "trembler",
  "frissonner", "transpirer", "souffle", "respiration", "ma gorge",
  "mes épaules", "tension dans", "mon corps", "physiquement",
];

const SELF_COMPASSION_MARKERS = [
  // NL
  "ik mag er zijn", "het is oké om", "ik ben genoeg",
  "ik verdien", "lief voor mezelf", "geduld met mezelf",
  "het is menselijk", "ik hoef niet perfect", "zelfzorg",
  "ik gun mezelf", "zachtheid", "mededogen",
  // EN
  "i'm allowed to", "it's okay to", "i am enough",
  "i deserve", "kind to myself", "patient with myself",
  "it's human", "i don't have to be perfect", "self-care",
  "i allow myself", "gentleness", "compassion",
  // FR
  "j'ai le droit", "c'est ok de", "je suis suffisant",
  "je mérite", "doux envers moi-même", "patient avec moi-même",
  "c'est humain", "je n'ai pas besoin d'être parfait",
];

const RELAPSE_INTENT_MARKERS = [
  // NL
  "ik ga gebruiken", "ik heb al gebeld", "ik heb al gescoord",
  "ik ga nu drinken", "ik heb al gedronken", "ik ga het doen",
  "ik ben al bezig", "het is al gebeurd", "ik heb terugval",
  "ik ben hervallen", "ik heb weer gebruikt",
  // EN
  "i'm going to use", "i already called", "i already scored",
  "i'm going to drink now", "i already drank", "i'm doing it",
  "i'm already at it", "it already happened", "i relapsed",
  "i used again",
  // FR
  "je vais consommer", "j'ai déjà appelé", "j'ai déjà scoré",
  "je vais boire maintenant", "j'ai déjà bu", "je le fais",
  "c'est déjà fait", "j'ai rechuté", "j'ai reconsommé",
];

// Safety flag markers (advisory only — safety core is source of truth)
const SUICIDE_SELF_HARM_MARKERS = [
  "zelfmoord", "suicide", "mezelf pijn doen", "snijden", "ik wil dood",
  "ik wil niet meer leven", "einde maken", "een eind aan maken",
  "suicidal", "self-harm", "hurt myself", "i want to die",
  "je veux mourir", "me faire du mal", "en finir",
];

const ACUTE_DANGER_MARKERS = [
  "hij slaat", "ze slaat", "geweld", "mishandeling", "bedreigd",
  "ik word geslagen", "hij dreigt", "ze dreigt", "wapen",
  "violence", "abuse", "threatened", "weapon", "hitting me",
  "il me frappe", "elle me frappe", "menacé", "arme",
];

// ─── Main Adapter Function ────────────────────────────────────────────────────

/**
 * Extract all chat signal markers from a raw message text.
 * Returns a complete VspChatSignalSnapshot.
 */
export function extractChatSignals(messageText: string): VspChatSignalSnapshot {
  const lower = messageText.toLowerCase();

  return {
    rationalityMarkers: findMarkers(lower, RATIONALITY_MARKERS),
    emotionalConnectionMarkers: findMarkers(lower, EMOTIONAL_CONNECTION_MARKERS),
    avoidanceMarkers: findMarkers(lower, AVOIDANCE_MARKERS),
    cravingMarkers: findMarkers(lower, CRAVING_MARKERS),
    overwhelmMarkers: findMarkers(lower, OVERWHELM_MARKERS),
    warmthMarkers: findMarkers(lower, WARMTH_MARKERS),
    embodiedEmotionMarkers: findMarkers(lower, EMBODIED_EMOTION_MARKERS),
    selfCompassionMarkers: findMarkers(lower, SELF_COMPASSION_MARKERS),
    relapseIntentMarkers: findMarkers(lower, RELAPSE_INTENT_MARKERS),
    safetyFlags: extractSafetyFlags(lower),
  };
}

/**
 * Extract safety flags from message text.
 * These are ADVISORY only — the immutable safety core is the source of truth.
 */
function extractSafetyFlags(lowerText: string): VspSafetyFlags {
  return {
    crisisDetected: false, // determined by safety core, not chat adapter
    suicideSelfHarmDetected: SUICIDE_SELF_HARM_MARKERS.some((m) => lowerText.includes(m)),
    relapseIntentDetected: RELAPSE_INTENT_MARKERS.some((m) => lowerText.includes(m)),
    acuteDangerDetected: ACUTE_DANGER_MARKERS.some((m) => lowerText.includes(m)),
    medicalEmergencyDetected: false, // determined by safety core
    coreSafetyOverrideActive: false, // determined by safety core
  };
}

/**
 * Find all matching markers in text.
 */
function findMarkers(lowerText: string, markers: string[]): string[] {
  const found: string[] = [];
  for (const marker of markers) {
    if (lowerText.includes(marker)) {
      found.push(marker);
    }
  }
  return found;
}

/**
 * Merge multiple chat signal snapshots (e.g., from multiple messages in a turn).
 */
export function mergeChatSignals(
  snapshots: VspChatSignalSnapshot[]
): VspChatSignalSnapshot {
  if (snapshots.length === 0) {
    return createEmptyChatSignals();
  }
  if (snapshots.length === 1) return snapshots[0];

  const merged: VspChatSignalSnapshot = createEmptyChatSignals();

  for (const snap of snapshots) {
    merged.rationalityMarkers.push(...snap.rationalityMarkers);
    merged.emotionalConnectionMarkers.push(...snap.emotionalConnectionMarkers);
    merged.avoidanceMarkers.push(...snap.avoidanceMarkers);
    merged.cravingMarkers.push(...snap.cravingMarkers);
    merged.overwhelmMarkers.push(...snap.overwhelmMarkers);
    merged.warmthMarkers.push(...snap.warmthMarkers);
    merged.embodiedEmotionMarkers.push(...snap.embodiedEmotionMarkers);
    merged.selfCompassionMarkers.push(...snap.selfCompassionMarkers);
    merged.relapseIntentMarkers.push(...snap.relapseIntentMarkers);

    // Safety flags: OR logic
    if (snap.safetyFlags.crisisDetected) merged.safetyFlags.crisisDetected = true;
    if (snap.safetyFlags.suicideSelfHarmDetected) merged.safetyFlags.suicideSelfHarmDetected = true;
    if (snap.safetyFlags.relapseIntentDetected) merged.safetyFlags.relapseIntentDetected = true;
    if (snap.safetyFlags.acuteDangerDetected) merged.safetyFlags.acuteDangerDetected = true;
    if (snap.safetyFlags.medicalEmergencyDetected) merged.safetyFlags.medicalEmergencyDetected = true;
    if (snap.safetyFlags.coreSafetyOverrideActive) merged.safetyFlags.coreSafetyOverrideActive = true;
  }

  // Deduplicate
  merged.rationalityMarkers = Array.from(new Set(merged.rationalityMarkers));
  merged.emotionalConnectionMarkers = Array.from(new Set(merged.emotionalConnectionMarkers));
  merged.avoidanceMarkers = Array.from(new Set(merged.avoidanceMarkers));
  merged.cravingMarkers = Array.from(new Set(merged.cravingMarkers));
  merged.overwhelmMarkers = Array.from(new Set(merged.overwhelmMarkers));
  merged.warmthMarkers = Array.from(new Set(merged.warmthMarkers));
  merged.embodiedEmotionMarkers = Array.from(new Set(merged.embodiedEmotionMarkers));
  merged.selfCompassionMarkers = Array.from(new Set(merged.selfCompassionMarkers));
  merged.relapseIntentMarkers = Array.from(new Set(merged.relapseIntentMarkers));

  return merged;
}

/**
 * Create an empty chat signal snapshot.
 */
export function createEmptyChatSignals(): VspChatSignalSnapshot {
  return {
    rationalityMarkers: [],
    emotionalConnectionMarkers: [],
    avoidanceMarkers: [],
    cravingMarkers: [],
    overwhelmMarkers: [],
    warmthMarkers: [],
    embodiedEmotionMarkers: [],
    selfCompassionMarkers: [],
    relapseIntentMarkers: [],
    safetyFlags: {
      crisisDetected: false,
      suicideSelfHarmDetected: false,
      relapseIntentDetected: false,
      acuteDangerDetected: false,
      medicalEmergencyDetected: false,
      coreSafetyOverrideActive: false,
    },
  };
}
