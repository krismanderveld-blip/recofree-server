/**
 * Schema Detector — Deterministic Marker-Based Schema Detection
 * Based on RECOFREE_SCHEMA_MODE_ENGINE_CANON_V1 Sections 4, 5, 11, 13
 *
 * RULES:
 * - Schemas require repeated pattern evidence unless user explicitly names it
 * - Single phrase = weak candidate only (no strong prompt injection, no persistence)
 * - Multi-signal alignment strengthens candidates
 * - Safety override: crisis blocks schema exploration
 * - Schemas are candidate lenses, not diagnoses
 */

import {
  SchemaId,
  SchemaDomain,
  CopingStyle,
  SchemaCandidate,
  SchemaDecision,
  SchemaEvidence,
  SchemaActivationState,
  SchemaModeDetectionInput,
  SCHEMA_DOMAIN_MAP,
} from './schema-mode-types';
import { LocalDeviceTimeService } from "@/lib/core/time";

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Schema Marker Definitions
// ═══════════════════════════════════════════════════════════════════════════════

type SchemaMarkerDef = {
  schemaId: SchemaId;
  domain: SchemaDomain;
  textMarkers: string[];
  copingStyle: CopingStyle | null;
  /** Minimum frequency in user.dat tendencies to boost to ACTIVE */
  repeatThreshold: number;
};

const SCHEMA_MARKERS: SchemaMarkerDef[] = [
  // ── Domain 1: DISCONNECTION_REJECTION ──
  {
    schemaId: 'ABANDONMENT_INSTABILITY',
    domain: 'DISCONNECTION_REJECTION',
    textMarkers: [
      'they will leave', 'everyone leaves', 'they\'re going to abandon me',
      'i\'ll end up alone', 'nobody really stays', 'they\'ll get tired of me',
      'what if they leave', 'i\'m going to lose them', 'they don\'t really care',
      // NL markers
      'ze gaan me verlaten', 'iedereen verlaat me', 'ik eindig alleen',
      'niemand blijft', 'ze worden me beu', 'wat als ze weggaan',
      'ik ga ze verliezen', 'ze geven niet echt om mij', 'ik word verlaten',
      'alleen achterblijven', 'niemand houdt het vol bij mij',
    ],
    copingStyle: null,
    repeatThreshold: 2,
  },
  {
    schemaId: 'MISTRUST_ABUSE',
    domain: 'DISCONNECTION_REJECTION',
    textMarkers: [
      'everyone has an agenda', 'i can\'t trust anyone', 'they\'re going to hurt me',
      'people always betray', 'nobody is honest', 'they\'re using me',
      'i expect the worst from people', 'they\'ll take advantage',
      // NL markers
      'ik kan niemand vertrouwen', 'iedereen heeft een agenda', 'ze gaan me pijn doen',
      'mensen verraden altijd', 'niemand is eerlijk', 'ze gebruiken me',
      'ik verwacht het ergste van mensen', 'ze profiteren van mij',
      'vertrouwen is gevaarlijk', 'ik word altijd bedrogen', 'misbruikt',
    ],
    copingStyle: 'AVOIDANCE',
    repeatThreshold: 2,
  },
  {
    schemaId: 'EMOTIONAL_DEPRIVATION',
    domain: 'DISCONNECTION_REJECTION',
    textMarkers: [
      'nobody is there', 'i always carry this alone', 'nobody understands me',
      'i never get what i need', 'nobody really listens', 'i\'m always alone in this',
      'nobody cares enough', 'i feel emotionally starved',
      // NL markers
      'niemand is er voor mij', 'ik draag dit altijd alleen', 'niemand begrijpt me',
      'ik krijg nooit wat ik nodig heb', 'niemand luistert echt', 'ik sta er altijd alleen voor',
      'niemand geeft genoeg om mij', 'emotioneel uitgehongerd', 'ik voel me leeg van binnen',
      'er is nooit iemand', 'ik mis warmte', 'nooit aandacht gekregen',
    ],
    copingStyle: null,
    repeatThreshold: 2,
  },
  {
    schemaId: 'DEFECTIVENESS_SHAME',
    domain: 'DISCONNECTION_REJECTION',
    textMarkers: [
      'i\'m broken', 'something is wrong with me', 'i\'m defective',
      'if they knew the real me', 'i\'m too damaged', 'i\'m unlovable',
      'i\'m fundamentally flawed', 'i disgust myself', 'i\'m not worth knowing',
      // NL markers
      'ik ben kapot', 'er is iets mis met mij', 'ik ben defect',
      'als ze de echte mij kenden', 'ik ben te beschadigd', 'ik ben niet te beminnen',
      'ik ben fundamenteel fout', 'ik walg van mezelf', 'ik ben waardeloos',
      'ik ben minderwaardig', 'ik schaam me', 'ik deug niet', 'ik ben niks waard',
    ],
    copingStyle: 'AVOIDANCE',
    repeatThreshold: 2,
  },
  {
    schemaId: 'SOCIAL_ISOLATION',
    domain: 'DISCONNECTION_REJECTION',
    textMarkers: [
      'i don\'t belong', 'nobody understands', 'i\'m different from everyone',
      'i don\'t fit in', 'i\'m an outsider', 'i have no one',
      'i\'m completely alone', 'nobody gets me',
      // NL markers
      'ik hoor er niet bij', 'niemand begrijpt het', 'ik ben anders dan iedereen',
      'ik pas nergens', 'ik ben een buitenstaander', 'ik heb niemand',
      'ik ben helemaal alleen', 'niemand snapt me', 'ik voel me geïsoleerd',
    ],
    copingStyle: 'AVOIDANCE',
    repeatThreshold: 2,
  },

  // ── Domain 2: IMPAIRED_AUTONOMY_PERFORMANCE ──
  {
    schemaId: 'DEPENDENCE_INCOMPETENCE',
    domain: 'IMPAIRED_AUTONOMY_PERFORMANCE',
    textMarkers: [
      'i can\'t do this alone', 'i need someone to help me',
      'i\'m not capable', 'i can\'t manage', 'i\'m helpless without',
      'i need someone to decide for me', 'i can\'t handle responsibility',
      // NL markers
      'ik kan dit niet alleen', 'ik heb iemand nodig', 'ik ben niet capabel',
      'ik kan het niet aan', 'ik ben hulpeloos zonder', 'ik kan geen beslissingen nemen',
      'ik kan geen verantwoordelijkheid dragen',
    ],
    copingStyle: 'SURRENDER',
    repeatThreshold: 2,
  },
  {
    schemaId: 'VULNERABILITY_TO_HARM',
    domain: 'IMPAIRED_AUTONOMY_PERFORMANCE',
    textMarkers: [
      'something terrible will happen', 'i\'m not safe', 'disaster is coming',
      'the worst will happen', 'i can\'t protect myself', 'everything is dangerous',
      'i\'m going to get sick', 'something bad is about to happen',
      // NL markers
      'er gaat iets ergs gebeuren', 'ik ben niet veilig', 'een ramp komt eraan',
      'het ergste gaat gebeuren', 'ik kan mezelf niet beschermen', 'alles is gevaarlijk',
      'ik word ziek', 'er staat iets slechts te gebeuren',
    ],
    copingStyle: 'AVOIDANCE',
    repeatThreshold: 2,
  },
  {
    schemaId: 'ENMESHMENT_UNDEVELOPED_SELF',
    domain: 'IMPAIRED_AUTONOMY_PERFORMANCE',
    textMarkers: [
      'i don\'t know who i am without them', 'my life revolves around them',
      'i can\'t have my own life', 'i don\'t know what i want',
      'i exist for them', 'without them i\'m nothing',
      // NL markers
      'ik weet niet wie ik ben zonder hen', 'mijn leven draait om hen',
      'ik kan geen eigen leven hebben', 'ik weet niet wat ik wil',
      'ik besta voor hen', 'zonder hen ben ik niets',
    ],
    copingStyle: 'SURRENDER',
    repeatThreshold: 2,
  },
  {
    schemaId: 'FAILURE',
    domain: 'IMPAIRED_AUTONOMY_PERFORMANCE',
    textMarkers: [
      'i always fail', 'i\'m a failure', 'i can\'t succeed at anything',
      'why even try', 'i\'ll just mess it up', 'i never get it right',
      'everyone else can do it except me', 'i\'m destined to fail',
      // NL markers
      'ik faal altijd', 'ik ben een mislukkeling', 'ik kan nergens in slagen',
      'waarom zou ik het proberen', 'ik verpest het toch', 'ik krijg het nooit goed',
      'iedereen kan het behalve ik', 'ik ben voorbestemd om te falen',
    ],
    copingStyle: 'AVOIDANCE',
    repeatThreshold: 2,
  },

  // ── Domain 3: IMPAIRED_LIMITS ──
  {
    schemaId: 'ENTITLEMENT_GRANDIOSITY',
    domain: 'IMPAIRED_LIMITS',
    textMarkers: [
      'i deserve special treatment', 'rules don\'t apply to me',
      'i\'m above this', 'they should make an exception',
      'i shouldn\'t have to wait', 'i\'m better than this',
      // NL markers
      'ik verdien een speciale behandeling', 'regels gelden niet voor mij',
      'ik sta erboven', 'ze moeten een uitzondering maken',
      'ik hoef niet te wachten', 'ik ben beter dan dit',
    ],
    copingStyle: 'OVERCOMPENSATION',
    repeatThreshold: 3,
  },
  {
    schemaId: 'INSUFFICIENT_SELF_CONTROL',
    domain: 'IMPAIRED_LIMITS',
    textMarkers: [
      'i can\'t control myself', 'i have no willpower', 'i just give in',
      'i can\'t stop', 'i can\'t resist', 'i have no discipline',
      'i always give in to temptation',
      // NL markers
      'ik kan mezelf niet controleren', 'ik heb geen wilskracht', 'ik geef gewoon toe',
      'ik kan niet stoppen', 'ik kan niet weerstaan', 'ik heb geen discipline',
      'ik geef altijd toe aan verleiding', 'geen zelfcontrole', 'ik kan het niet laten',
    ],
    copingStyle: null,
    repeatThreshold: 2,
  },

  // ── Domain 4: OTHER_DIRECTEDNESS ──
  {
    schemaId: 'SUBJUGATION',
    domain: 'OTHER_DIRECTEDNESS',
    textMarkers: [
      'i can\'t say no', 'i have to do what they want', 'my needs don\'t matter',
      'i\'ll just go along', 'i can\'t disagree', 'they\'ll be angry if i refuse',
      'i suppress what i feel', 'i have no choice',
      // NL markers
      'ik kan geen nee zeggen', 'ik moet doen wat zij willen', 'mijn behoeften doen er niet toe',
      'ik ga gewoon mee', 'ik kan niet tegenspreken', 'ze worden boos als ik weiger',
      'ik onderdruk wat ik voel', 'ik heb geen keuze',
    ],
    copingStyle: 'SURRENDER',
    repeatThreshold: 2,
  },
  {
    schemaId: 'SELF_SACRIFICE',
    domain: 'OTHER_DIRECTEDNESS',
    textMarkers: [
      'i always put others first', 'i feel guilty when i rest',
      'their needs are more important', 'i can\'t stop helping',
      'i ignore my own needs', 'i give until i\'m empty',
      'i feel selfish if i say no',
      // NL markers
      'ik zet altijd anderen op de eerste plaats', 'ik voel me schuldig als ik rust',
      'hun behoeften zijn belangrijker', 'ik kan niet stoppen met helpen',
      'ik negeer mijn eigen behoeften', 'ik geef tot ik leeg ben',
      'ik voel me egoïstisch als ik nee zeg', 'zelfopoffering', 'ik offer mezelf op',
    ],
    copingStyle: 'SURRENDER',
    repeatThreshold: 2,
  },
  {
    schemaId: 'APPROVAL_SEEKING',
    domain: 'OTHER_DIRECTEDNESS',
    textMarkers: [
      'i need them to approve', 'what will they think',
      'i need validation', 'i perform for others', 'i need to be liked',
      'my worth depends on what others think', 'i need to impress them',
      // NL markers
      'ik heb hun goedkeuring nodig', 'wat zullen ze denken',
      'ik heb bevestiging nodig', 'ik presteer voor anderen', 'ik moet aardig gevonden worden',
      'mijn waarde hangt af van wat anderen denken', 'ik moet indruk maken',
    ],
    copingStyle: 'SURRENDER',
    repeatThreshold: 2,
  },

  // ── Domain 5: OVERVIGILANCE_INHIBITION ──
  {
    schemaId: 'NEGATIVITY_PESSIMISM',
    domain: 'OVERVIGILANCE_INHIBITION',
    textMarkers: [
      'nothing will change', 'it\'s hopeless', 'things only get worse',
      'there\'s no point', 'good things don\'t last', 'it\'s all downhill',
      'nothing ever works out', 'why bother',
      // NL markers
      'niets verandert', 'het is hopeloos', 'het wordt alleen maar erger',
      'het heeft geen zin', 'goede dingen duren niet', 'het gaat alleen bergaf',
      'niets lukt ooit', 'waarom zou ik moeite doen',
    ],
    copingStyle: 'AVOIDANCE',
    repeatThreshold: 2,
  },
  {
    schemaId: 'EMOTIONAL_INHIBITION',
    domain: 'OVERVIGILANCE_INHIBITION',
    textMarkers: [
      'i can\'t show how i feel', 'emotions are weakness',
      'i need to stay strong', 'i don\'t do feelings',
      'showing emotion is dangerous', 'i keep everything inside',
      'i can\'t let them see me cry',
      // NL markers
      'ik kan niet tonen hoe ik me voel', 'emoties zijn zwakte',
      'ik moet sterk blijven', 'ik doe niet aan gevoelens',
      'emoties tonen is gevaarlijk', 'ik houd alles binnen',
      'ik kan ze me niet zien huilen', 'ik slik alles in',
    ],
    copingStyle: 'AVOIDANCE',
    repeatThreshold: 2,
  },
  {
    schemaId: 'UNRELENTING_STANDARDS',
    domain: 'OVERVIGILANCE_INHIBITION',
    textMarkers: [
      'i must be perfect', 'anything less is failure', 'i can\'t make mistakes',
      'i need to do more', 'it\'s never good enough', 'i have to be the best',
      'no room for error', 'i should try harder',
      // NL markers
      'ik moet perfect zijn', 'alles minder is falen', 'ik mag geen fouten maken',
      'ik moet meer doen', 'het is nooit goed genoeg', 'ik moet de beste zijn',
      'geen ruimte voor fouten', 'ik moet harder proberen',
    ],
    copingStyle: 'OVERCOMPENSATION',
    repeatThreshold: 2,
  },
  {
    schemaId: 'PUNITIVENESS',
    domain: 'OVERVIGILANCE_INHIBITION',
    textMarkers: [
      'i deserve punishment', 'mistakes must be punished',
      'there should be consequences', 'no mercy for failure',
      'i should suffer for this', 'zero tolerance',
      // NL markers
      'ik verdien straf', 'fouten moeten bestraft worden',
      'er moeten gevolgen zijn', 'geen genade voor falen',
      'ik moet hiervoor lijden', 'nultolerantie', 'ik verdien dit niet',
    ],
    copingStyle: null,
    repeatThreshold: 2,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Detection Logic
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detect schema candidates from deterministic text markers and context signals.
 * Returns raw candidates — validation/decision happens in the router.
 */
export function detectSchemaCandidates(input: SchemaModeDetectionInput): SchemaCandidate[] {
  const messageLower = input.message.toLowerCase();
  const now = LocalDeviceTimeService.now().utcIso;
  const candidates: SchemaCandidate[] = [];

  for (const markerDef of SCHEMA_MARKERS) {
    let confidence = 0;
    const evidence: SchemaEvidence[] = [];

    // ── Text marker matching ──
    const matchedMarkers = markerDef.textMarkers.filter(marker =>
      messageLower.includes(marker)
    );

    if (matchedMarkers.length > 0) {
      // Base confidence from text markers (0.2 for 1, 0.35 for 2, 0.5 for 3+)
      // Schemas need more evidence than modes (repetition rule)
      confidence = Math.min(0.2 + (matchedMarkers.length - 1) * 0.15, 0.5);
      for (const marker of matchedMarkers) {
        evidence.push({
          evidenceType: 'CURRENT_LANGUAGE',
          value: marker,
          timestamp: now,
          sourceLayer: 'current_input',
        });
      }
    }

    // ── History pattern boost (from user.dat tendencies) ──
    const tendency = input.schemaTendencies.find(t => t.schemaId === markerDef.schemaId);
    if (tendency && tendency.frequency >= markerDef.repeatThreshold) {
      confidence += 0.25;
      evidence.push({
        evidenceType: 'REPEATED_PATTERN',
        value: `frequency=${tendency.frequency}, lastSeen=${tendency.lastSeen}`,
        timestamp: now,
        sourceLayer: 'user.dat',
      });
    }

    // ── Projection boost (schemas linked to future fears) ──
    if (input.activeProjections.length > 0) {
      const projectionLinkedSchemas: SchemaId[] = [
        'ABANDONMENT_INSTABILITY', 'VULNERABILITY_TO_HARM', 'FAILURE',
        'NEGATIVITY_PESSIMISM',
      ];
      if (projectionLinkedSchemas.includes(markerDef.schemaId)) {
        const hasFearProjection = input.activeProjections.some(p =>
          p.category === 'fear' || p.category === 'relapse_window'
        );
        if (hasFearProjection) {
          confidence += 0.1;
          evidence.push({
            evidenceType: 'PROJECTION_LINK',
            value: 'fear/relapse projection active',
            timestamp: now,
            sourceLayer: 'projections.dat',
          });
        }
      }
    }

    // ── Zone/VSP boost for certain schemas ──
    if (input.zoneColor === 'RED' || input.zoneColor === 'PURPLE') {
      const crisisLinkedSchemas: SchemaId[] = [
        'DEFECTIVENESS_SHAME', 'PUNITIVENESS', 'ABANDONMENT_INSTABILITY',
      ];
      if (crisisLinkedSchemas.includes(markerDef.schemaId)) {
        confidence += 0.1;
        evidence.push({
          evidenceType: 'VSP_LINK',
          value: `zone=${input.zoneColor}`,
          timestamp: now,
          sourceLayer: 'buffer',
        });
      }
    }

    // Only emit candidate if confidence > 0 (at least one signal)
    if (confidence > 0 && evidence.length > 0) {
      // Determine activation state based on confidence + history
      let activationState: SchemaActivationState = 'POSSIBLE';
      if (confidence >= 0.6 && tendency && tendency.frequency >= markerDef.repeatThreshold) {
        activationState = 'HIGHLY_ACTIVE';
      } else if (confidence >= 0.4) {
        activationState = 'ACTIVE';
      }

      // Safety override: mark as UNSAFE_TO_EXPLORE if crisis or high-risk zone
      if (input.isCrisis || input.zoneColor === 'PURPLE') {
        activationState = 'UNSAFE_TO_EXPLORE';
      }

      candidates.push({
        schemaId: markerDef.schemaId,
        domain: markerDef.domain,
        confidence: Math.min(confidence, 1.0),
        evidence,
        activationState,
        copingStyle: markerDef.copingStyle,
        allowedForPrompt: activationState !== 'UNSAFE_TO_EXPLORE',
      });
    }
  }

  // Sort by confidence descending
  candidates.sort((a, b) => b.confidence - a.confidence);

  return candidates;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Schema Validation / Decision
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate schema candidates and produce a SchemaDecision.
 * Applies safety hierarchy, repetition rule, and context budget.
 */
export function validateSchemas(
  candidates: SchemaCandidate[],
  input: SchemaModeDetectionInput
): SchemaDecision {
  if (candidates.length === 0) {
    return {
      acceptedSchemas: [],
      rejectedSchemas: [],
      dominantSchema: null,
      dominantDomain: null,
      safeToExplore: !input.isCrisis && input.zoneColor !== 'RED' && input.zoneColor !== 'PURPLE',
      promptSummary: '',
    };
  }

  const accepted: SchemaCandidate[] = [];
  const rejected: SchemaCandidate[] = [];

  // Minimum confidence threshold for schema acceptance (higher than modes)
  const MIN_CONFIDENCE = 0.35;

  for (const candidate of candidates) {
    // Reject if below minimum confidence
    if (candidate.confidence < MIN_CONFIDENCE) {
      rejected.push({ ...candidate, allowedForPrompt: false });
      continue;
    }

    // Safety override: crisis blocks all schema exploration
    if (input.isCrisis) {
      rejected.push({ ...candidate, allowedForPrompt: false });
      continue;
    }

    // VSP RED: only allow safety-relevant schemas (shame/punitiveness for stabilization)
    if (input.zoneColor === 'RED') {
      const safetyRelevant: SchemaId[] = ['DEFECTIVENESS_SHAME', 'PUNITIVENESS', 'ABANDONMENT_INSTABILITY'];
      if (!safetyRelevant.includes(candidate.schemaId)) {
        rejected.push({ ...candidate, allowedForPrompt: false });
        continue;
      }
    }

    // Single-phrase rule: if only current_input evidence and no history, weaken
    const hasHistoryEvidence = candidate.evidence.some(e =>
      e.sourceLayer === 'user.dat' || e.sourceLayer === 'projections.dat'
    );
    if (!hasHistoryEvidence && candidate.confidence < 0.5) {
      // Weak single-phrase candidate — accept but mark as POSSIBLE only
      accepted.push({
        ...candidate,
        activationState: 'POSSIBLE',
        allowedForPrompt: candidate.confidence >= 0.4,
      });
      continue;
    }

    accepted.push(candidate);
  }

  // Limit to max 2 accepted schemas (context budget)
  const limitedAccepted = accepted.slice(0, 2);
  const overBudget = accepted.slice(2);
  rejected.push(...overBudget.map(s => ({ ...s, allowedForPrompt: false })));

  // Determine dominant schema
  const dominantSchema = limitedAccepted.length > 0 ? limitedAccepted[0].schemaId : null;
  const dominantDomain = dominantSchema ? SCHEMA_DOMAIN_MAP[dominantSchema] : null;

  // Safe to explore?
  const safeToExplore = !input.isCrisis &&
    input.zoneColor !== 'RED' &&
    input.zoneColor !== 'PURPLE';

  return {
    acceptedSchemas: limitedAccepted,
    rejectedSchemas: rejected,
    dominantSchema,
    dominantDomain,
    safeToExplore,
    promptSummary: '', // Built by router
  };
}
