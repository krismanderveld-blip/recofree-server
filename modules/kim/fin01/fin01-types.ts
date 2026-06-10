/**
 * FIN01 — Financiële Afhankelijkheid/Controle Detectie (Kim only)
 *
 * Detecteert patronen waarbij geld wordt gebruikt als machtsmiddel
 * in de relatie met de verslaafde: financiële controle, schulden
 * door verslaving, economische afhankelijkheid die vertrek blokkeert,
 * geld geven om de vrede te bewaren.
 *
 * Pipeline regels:
 * - K06 loopt altijd voor FIN01
 * - FIN01 mag niet activeren als K06 stabilisatie incompleet is
 * - Crisis en veiligheidsprotocol overschrijven altijd
 * - Kim only — nooit Elias data lezen
 */

export interface FIN01DetectionInput {
  /** Current user message (translated to English) */
  message: string;
  /** Recent conversation history (last 5 messages) */
  recentHistory: string[];
  /** K06 stabilization status */
  k06Stabilized: boolean;
  /** Active crisis level (0-3) */
  crisisLevel: number;
  /** Previous FIN01 detection results (for pattern accumulation) */
  previousDetections: FIN01Detection[];
  /** User's backpack sections (for context) */
  backpackContext: string;
}

export interface FIN01Detection {
  /** Whether financial control/dependency pattern is detected */
  detected: boolean;
  /** Confidence score (0-1) */
  confidence: number;
  /** Detected markers */
  markers: FIN01Marker[];
  /** Current phase of intervention */
  phase: FIN01Phase;
  /** Timestamp of detection */
  timestamp: string;
}

export type FIN01Marker =
  | 'financial-control'       // partner controleert geld
  | 'debt-from-addiction'     // schulden door verslaving van partner
  | 'money-as-peace'          // geld geven om rust te kopen
  | 'economic-trapped'        // kan niet weg door financiële afhankelijkheid
  | 'hidden-spending'         // partner verbergt uitgaven
  | 'financial-gaslighting'   // "je overdrijft over het geld"
  | 'sacrifice-savings'       // eigen spaargeld opofferen
  | 'work-overload'           // extra werken om gaten te dichten
  | 'shame-about-money';      // schaamte over financiële situatie

export type FIN01Phase =
  | 'awareness'        // Help user see the financial pattern
  | 'impact-mapping'   // Map the full financial impact
  | 'agency-building'  // Build sense of financial agency
  | 'protection'       // Concrete protection steps
  | 'autonomy';        // Financial autonomy as self-care

export interface FIN01RoutingOutput {
  /** Whether to activate FIN01 prompt block */
  activate: boolean;
  /** Selected phase for this interaction */
  phase: FIN01Phase;
  /** Intensity level (gentle/moderate/direct) */
  intensity: 'gentle' | 'moderate' | 'direct';
  /** Specific markers to address */
  targetMarkers: FIN01Marker[];
  /** Context note for prompt */
  contextNote: string;
}

export interface FIN01StoragePatch {
  /** Updated detection history */
  fin01Detections: FIN01Detection[];
  /** Current intervention phase */
  fin01Phase: FIN01Phase;
  /** Total sessions with FIN01 active */
  fin01SessionCount: number;
  /** Last active timestamp */
  fin01LastActive: string;
}
