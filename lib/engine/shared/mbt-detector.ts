/**
 * ═══════════════════════════════════════════════════════════════════
 * MBT++ ENGINE — DETECTOR (Round 56)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Deterministic mentalizing state detection + signal detection.
 * Uses text markers (regex/keyword) to detect:
 * 1. Current mentalizing state (M0-M7)
 * 2. Active MBT signals (18 signal types)
 *
 * Canon: Section 5 (Mentalizing State Detection) + Section 13 (Hidden Logic)
 * ═══════════════════════════════════════════════════════════════════
 */

import type { MBTSignalId, MBTCandidate, MentalizingStateId } from './mbt-types';
import { MBT_SIGNAL_MAP } from './mbt-types';

// ─── Signal Marker Definitions ───────────────────────────────────

interface SignalMarker {
  signal: MBTSignalId;
  patterns: RegExp[];
  priority: number; // higher = more important
}

const MBT_SIGNAL_MARKERS: SignalMarker[] = [
  {
    signal: 'CERTAINTY_ABOUT_OTHER',
    patterns: [
      /\b(they|he|she)\s+(always|never|definitely|clearly)\b/i,
      /\b(did this to|wants to|is trying to)\s+(hurt|destroy|manipulate|control|punish)\b/i,
      /\b(only cares about|never cared|doesn'?t care)\b/i,
      /\b(ze|hij|zij)\s+(altijd|nooit|duidelijk)\b/i,
      /\b(wil me|probeert me)\s+(pijn|kapot|manipuleren|controleren)\b/i,
    ],
    priority: 8,
  },
  {
    signal: 'RIGID_INTERPRETATION',
    patterns: [
      /\b(this proves|this means|see\?? I knew|I told you so)\b/i,
      /\b(it'?s obvious|clearly shows|just confirms)\b/i,
      /\b(dit bewijst|zie je wel|ik wist het)\b/i,
      /\b(het is duidelijk|bevestigt gewoon)\b/i,
    ],
    priority: 6,
  },
  {
    signal: 'SHAME_FLOOD',
    patterns: [
      /\b(I'?m (so )?(pathetic|worthless|disgusting|broken|garbage|trash))\b/i,
      /\b(I hate myself|I'?m the worst|I deserve nothing)\b/i,
      /\b(everyone would be better off without me)\b/i,
      /\b(ik ben (zo )?(waardeloos|walgelijk|kapot|niks waard))\b/i,
      /\b(ik haat mezelf|ik verdien niets)\b/i,
      /\b(schaam me (zo|dood|kapot))\b/i,
    ],
    priority: 9,
  },
  {
    signal: 'CRAVING_AFTER_REJECTION',
    patterns: [
      /\b(rejected|ignored|left me|abandoned).{0,40}(crav|want to use|need (a |to )?(drink|hit|fix|score))\b/i,
      /\b(crav|want to use|need (a |to )?(drink|hit|fix|score)).{0,40}(rejected|ignored|left me|abandoned)\b/i,
      /\b(afgewezen|genegeerd|verlaten).{0,40}(trek|zucht|wil gebruiken)\b/i,
      /\b(trek|zucht|wil gebruiken).{0,40}(afgewezen|genegeerd|verlaten)\b/i,
    ],
    priority: 9,
  },
  {
    signal: 'ANGER_COVERING_FEAR',
    patterns: [
      /\b(I'?m (so |fucking )?(angry|furious|pissed|livid)).{0,50}(but|actually|really|underneath)\b/i,
      /\b(want (to |them to )(pay|suffer|hurt)).{0,30}(scar|afraid|fear|hurt)\b/i,
      /\b(woedend|razend|kwaad).{0,40}(maar|eigenlijk|bang|pijn)\b/i,
      /\b(fuck (them|him|her|this|everything))\b/i,
    ],
    priority: 7,
  },
  {
    signal: 'NUMBNESS_DISSOCIATION',
    patterns: [
      /\b(feel nothing|numb|empty|blank|disconnected|far away|not real)\b/i,
      /\b(can'?t feel|don'?t feel anything|everything is flat)\b/i,
      /\b(watching (myself|from outside)|not in my body)\b/i,
      /\b(voel niets|leeg|verdoofd|ver weg|niet echt)\b/i,
      /\b(kan niets voelen|alles is plat|sta ernaast)\b/i,
    ],
    priority: 8,
  },
  {
    signal: 'PANIC_CONFUSION',
    patterns: [
      /\b(don'?t know what('?s| is) happening)\b/i,
      /\b(I'?m (so )?(confused|lost|panicking|overwhelmed))\b/i,
      /\b(everything is (too much|spinning|falling apart))\b/i,
      /\b(weet niet wat er gebeurt|in paniek|overweldigd)\b/i,
      /\b(alles is (te veel|draait|valt uit elkaar))\b/i,
    ],
    priority: 8,
  },
  {
    signal: 'BLACK_WHITE_THINKING',
    patterns: [
      /\b(always|never|everyone|nobody|everything|nothing)\s+(is|does|will|has)\b/i,
      /\b(all or nothing|completely|totally (ruined|broken|over|done))\b/i,
      /\b(either.{1,20}or.{1,20}(nothing|never|always))\b/i,
      /\b(altijd|nooit|iedereen|niemand|alles|niets)\s+(is|doet|zal)\b/i,
    ],
    priority: 6,
  },
  {
    signal: 'HOSTILE_CERTAINTY',
    patterns: [
      /\b(I know (exactly )?what (they|he|she) (is|are) doing)\b/i,
      /\b(they'?re (just |only )?(using|lying|faking|pretending))\b/i,
      /\b(don'?t tell me.{0,20}(understand|empathize|see their side))\b/i,
      /\b(ik weet precies wat (ze|hij|zij) (doet|doen))\b/i,
      /\b((ze|hij|zij) (liegt|faken|doen alsof|gebruiken me))\b/i,
    ],
    priority: 8,
  },
  {
    signal: 'SELF_BLAME_LOOP',
    patterns: [
      /\b(it'?s (all )?my fault|I (always )?ruin everything)\b/i,
      /\b(I'?m the (problem|reason|cause)|I did this to (myself|them|us))\b/i,
      /\b(I (always |keep )(mess|screw|fuck)(ing)? (up|everything))\b/i,
      /\b(het is (allemaal )?mijn schuld|ik verpest alles)\b/i,
      /\b(ik ben het probleem|ik doe dit mezelf aan)\b/i,
    ],
    priority: 7,
  },
  {
    signal: 'RELAPSE_SHAME',
    patterns: [
      /\b(I (used|relapsed|drank|scored|slipped|fell back))\b/i,
      /\b(relapse|terugval|weer gebruikt|weer gedronken)\b/i,
      /\b(I'?m (back to|at) (square one|the beginning|zero))\b/i,
      /\b(all (that |my )(progress|work|effort).{0,20}(gone|wasted|nothing))\b/i,
      /\b(terug bij af|alles voor niets)\b/i,
    ],
    priority: 9,
  },
  {
    signal: 'BOUNDARY_VIOLATION_REPORT',
    patterns: [
      /\b(hit me|pushed me|threatened|intimidat|stalk|forced|coerced)\b/i,
      /\b(went through my (phone|stuff|messages)|checked my)\b/i,
      /\b(won'?t let me (leave|go|see|talk))\b/i,
      /\b(sloeg me|duwde me|bedreig|intimider|gedwongen|stalkt)\b/i,
      /\b(ging door mijn (telefoon|spullen)|mag niet (weg|gaan))\b/i,
    ],
    priority: 10,
  },
  {
    signal: 'RESCUE_IMPULSE',
    patterns: [
      /\b(I (have to|need to|must) (save|help|fix|rescue) (them|him|her))\b/i,
      /\b(if I don'?t.{0,20}(they'?ll|he'?ll|she'?ll).{0,20}(die|relapse|hurt))\b/i,
      /\b(I can'?t (just |)(watch|let|leave) (them|him|her))\b/i,
      /\b(ik moet (hem|haar|ze) (redden|helpen|fixen))\b/i,
      /\b(als ik niet.{0,20}(dan|gaat).{0,20}(dood|terugval|pijn))\b/i,
    ],
    priority: 7,
  },
  {
    signal: 'CARETAKER_EXHAUSTION',
    patterns: [
      /\b(I can'?t (do this|take it|keep going|anymore))\b/i,
      /\b(I'?m (so )?(exhausted|drained|burned out|done))\b/i,
      /\b(nothing (I do|ever) (works|helps|changes|matters))\b/i,
      /\b(ik kan niet meer|uitgeput|opgebrand|het lukt niet)\b/i,
      /\b(niets (helpt|werkt|verandert))\b/i,
    ],
    priority: 7,
  },
  {
    signal: 'CONFLICT_ESCALATION',
    patterns: [
      /\b(going to (tell|send|confront|call) (them|him|her))\b/i,
      /\b(I'?ll (show|make) (them|him|her))\b/i,
      /\b(want to (scream|yell|hit|break|destroy))\b/i,
      /\b(about to (explode|lose it|snap|blow up))\b/i,
      /\b(ga (bellen|sturen|confronteren)|laat ik ze zien)\b/i,
      /\b(wil (schreeuwen|slaan|kapot maken)|ontplof bijna)\b/i,
    ],
    priority: 8,
  },
  {
    signal: 'MANIPULATION_FEAR',
    patterns: [
      /\b(manipulat|gaslighting|playing me|using me|lying to me)\b/i,
      /\b(is (this|it|that) manipulation|am I being (played|used))\b/i,
      /\b(they'?re (just )?saying that to (control|guilt|trap))\b/i,
      /\b(manipuleer|gaslighting|speelt met me|gebruikt me)\b/i,
      /\b(is dit manipulatie|word ik (bespeeld|gebruikt))\b/i,
    ],
    priority: 7,
  },
  {
    signal: 'PRETEND_FINE',
    patterns: [
      /\b(I'?m fine|everything'?s fine|it'?s (all )?fine|no big deal)\b/i,
      /\b(I'?m (over it|past it|done with it|okay now))\b/i,
      /\b(doesn'?t (bother|affect|matter to) me (anymore|at all))\b/i,
      /\b(gaat wel|is niet erg|maakt niet uit|ben er overheen)\b/i,
      /\b(niks aan de hand|het is oké|doet me niets)\b/i,
    ],
    priority: 5,
  },
  {
    signal: 'TELEOLOGICAL_DEMAND',
    patterns: [
      /\b(if (they|he|she) (really |actually )?(loved|cared).{0,20}(would|should))\b/i,
      /\b(prove (it|that|to me)|show me|actions (not|over) words)\b/i,
      /\b(just (do|fix|change|stop) it)\b/i,
      /\b(als (ze|hij|zij) (echt ).{0,10}(zou|moest))\b/i,
      /\b(bewijs het|laat maar zien|daden geen woorden)\b/i,
    ],
    priority: 6,
  },
];

// ─── Mentalizing State Detection ─────────────────────────────────

interface StateMarker {
  state: MentalizingStateId;
  patterns: RegExp[];
  weight: number;
}

const MBT_STATE_MARKERS: StateMarker[] = [
  {
    state: 'M0_STABLE_MENTALIZING',
    patterns: [
      /\b(maybe|perhaps|part of me|I wonder|I think|I felt|might be)\b/i,
      /\b(on one hand|on the other|could be|not sure)\b/i,
      /\b(misschien|een deel van mij|ik vraag me af|zou kunnen)\b/i,
    ],
    weight: 1,
  },
  {
    state: 'M1_NARROWED_MENTALIZING',
    patterns: [
      /\b(I'?m (pretty |quite )?(sure|certain)|obviously|clearly)\b/i,
      /\b(keep (thinking|coming back to)|can'?t stop thinking)\b/i,
      /\b(ik ben (vrij )?zeker|duidelijk|blijf denken)\b/i,
    ],
    weight: 2,
  },
  {
    state: 'M2_COLLAPSED_SELF',
    patterns: [
      /\b(don'?t know what('?s| is) (happening|wrong with me))\b/i,
      /\b(I'?m (so )?(confused|lost|broken|nothing))\b/i,
      /\b(can'?t (think|function|cope|understand myself))\b/i,
      /\b(weet niet wat er (mis is|gebeurt)|kan niet (denken|functioneren))\b/i,
    ],
    weight: 3,
  },
  {
    state: 'M3_COLLAPSED_OTHER',
    patterns: [
      /\b(they (always|never|definitely|clearly)|knows? exactly what)\b/i,
      /\b(did (this|it) (on purpose|to hurt|deliberately))\b/i,
      /\b((ze|hij|zij) (altijd|nooit|expres|met opzet))\b/i,
    ],
    weight: 3,
  },
  {
    state: 'M4_PSYCHIC_EQUIVALENCE',
    patterns: [
      /\b(I (just )?know|I can feel (it|that)|it'?s (a )?fact)\b/i,
      /\b(this IS|that IS|they ARE)\b/, // uppercase emphasis
      /\b(ik weet het (gewoon|zeker)|het IS zo|dat IS)\b/i,
    ],
    weight: 4,
  },
  {
    state: 'M5_PRETEND_MODE',
    patterns: [
      /\b(I'?m fine|everything'?s fine|no (big )?deal|whatever)\b/i,
      /\b(doesn'?t (matter|bother|affect) me)\b/i,
      /\b(gaat wel|maakt niet uit|boeit me niet)\b/i,
    ],
    weight: 2,
  },
  {
    state: 'M6_TELEOLOGICAL',
    patterns: [
      /\b(if (they|you) (really|actually) (cared|loved|meant it))\b/i,
      /\b(prove|show me|actions (not|over) words)\b/i,
      /\b(als (je|ze) echt.{0,10}(zou|moest)|bewijs het)\b/i,
    ],
    weight: 3,
  },
  {
    state: 'M7_SHUTDOWN',
    patterns: [
      /\b(feel nothing|numb|empty|blank|gone|dead inside)\b/i,
      /\b(can'?t feel|don'?t feel|everything is (flat|far|gone))\b/i,
      /\b(voel niets|leeg|dood van binnen|verdoofd)\b/i,
    ],
    weight: 4,
  },
];

// ─── Public Detection Functions ──────────────────────────────────

/**
 * Detect mentalizing state from user message text.
 * Returns the most severe detected state (highest weight wins).
 */
export function detectMentalizingState(text: string): MentalizingStateId {
  let bestState: MentalizingStateId = 'M0_STABLE_MENTALIZING';
  let bestWeight = 0;
  let bestMatchCount = 0;

  for (const marker of MBT_STATE_MARKERS) {
    let matchCount = 0;
    for (const pattern of marker.patterns) {
      if (pattern.test(text)) {
        matchCount++;
      }
    }
    if (matchCount > 0) {
      const effectiveWeight = marker.weight * matchCount;
      if (effectiveWeight > bestWeight || (effectiveWeight === bestWeight && matchCount > bestMatchCount)) {
        bestWeight = effectiveWeight;
        bestState = marker.state;
        bestMatchCount = matchCount;
      }
    }
  }

  return bestState;
}

/**
 * Detect MBT signals from user message text.
 * Returns candidates sorted by confidence (priority × match count).
 */
export function detectMBTSignals(text: string): MBTCandidate[] {
  const candidates: MBTCandidate[] = [];

  for (const marker of MBT_SIGNAL_MARKERS) {
    let matchCount = 0;
    for (const pattern of marker.patterns) {
      if (pattern.test(text)) {
        matchCount++;
      }
    }
    if (matchCount > 0) {
      const confidence = Math.min(1.0, (marker.priority * matchCount) / 10);
      const mapping = MBT_SIGNAL_MAP[marker.signal];

      candidates.push({
        signal: marker.signal,
        confidence,
        detectedState: mapping.state,
        suggestedProcess: mapping.process,
        suggestedResponseMode: mapping.responseMode,
        hint: mapping.hint,
      });
    }
  }

  // Sort by confidence descending
  candidates.sort((a, b) => b.confidence - a.confidence);

  return candidates;
}

/**
 * Combined detection: state + signals in one pass.
 */
export function detectMBT(text: string): {
  state: MentalizingStateId;
  candidates: MBTCandidate[];
} {
  return {
    state: detectMentalizingState(text),
    candidates: detectMBTSignals(text),
  };
}
