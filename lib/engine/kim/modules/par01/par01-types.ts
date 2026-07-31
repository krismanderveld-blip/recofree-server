/**
 * PAR01 — Parentificatie Patroon Detectie (Kim only)
 *
 * Detecteert patronen waarbij de naaste een ouderrol heeft aangenomen
 * voor de verslaafde partner/familielid: verantwoordelijkheid dragen
 * die niet van hen is, zorgen voor een volwassene alsof het een kind is,
 * eigen behoeften wegdrukken om de ander te "redden".
 *
 * Pipeline regels:
 * - K06 loopt altijd voor PAR01
 * - PAR01 mag niet activeren als K06 stabilisatie incompleet is
 * - Crisis en veiligheidsprotocol overschrijven altijd
 * - Kim only — nooit Elias data lezen
 */

export interface PAR01DetectionInput {
  /** Current user message (translated to English) */
  message: string;
  /** Recent conversation history (last 5 messages) */
  recentHistory: string[];
  /** K06 stabilization status */
  k06Stabilized: boolean;
  /** Active crisis level (0-3) */
  crisisLevel: number;
  /** Previous PAR01 detection results (for pattern accumulation) */
  previousDetections: PAR01Detection[];
  /** User's backpack sections (for context) */
  backpackContext: string;
}

export interface PAR01Detection {
  /** Whether parentification pattern is detected */
  detected: boolean;
  /** Confidence score (0-1) */
  confidence: number;
  /** Detected markers */
  markers: PAR01Marker[];
  /** Current phase of intervention */
  phase: PAR01Phase;
  /** Timestamp of detection */
  timestamp: string;
}

export type PAR01Marker =
  | 'role-reversal'           // "ik moet voor hem zorgen"
  | 'responsibility-overload' // "als ik het niet doe, doet niemand het"
  | 'own-needs-suppressed'    // "mijn behoeften doen er niet toe"
  | 'guilt-when-stepping-back'// "ik voel me schuldig als ik even niet help"
  | 'identity-as-caretaker'   // "ik ben er altijd voor iedereen"
  | 'childhood-pattern'       // "ik deed dit al als kind"
  | 'exhaustion-denial'       // "ik ben moe maar het moet"
  | 'emotional-labor'         // "ik houd alles bij elkaar"
  | 'boundary-inability';     // "ik kan geen nee zeggen"

export type PAR01Phase =
  | 'recognition'     // Help user see the pattern
  | 'origin-tracing'  // Connect to childhood/origin
  | 'impact-naming'   // Name the cost of parentification
  | 'boundary-seed'   // Plant seeds for boundary setting
  | 'integration';    // Integrate awareness into daily life

export interface PAR01RoutingOutput {
  /** Whether to activate PAR01 prompt block */
  activate: boolean;
  /** Selected phase for this interaction */
  phase: PAR01Phase;
  /** Intensity level (gentle/moderate/direct) */
  intensity: 'gentle' | 'moderate' | 'direct';
  /** Specific markers to address */
  targetMarkers: PAR01Marker[];
  /** Context note for prompt */
  contextNote: string;
}

export interface PAR01StoragePatch {
  /** Updated detection history */
  par01Detections: PAR01Detection[];
  /** Current intervention phase */
  par01Phase: PAR01Phase;
  /** Total sessions with PAR01 active */
  par01SessionCount: number;
  /** Last active timestamp */
  par01LastActive: string;
}
