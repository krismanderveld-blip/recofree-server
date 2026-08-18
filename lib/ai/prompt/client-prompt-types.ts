/**
 * CLIENT PROMPT TYPES
 * 
 * Types for client-side prompt building.
 * No clinical decisions — only structuring of already-chosen payload/context.
 */

export type Persona = 'kim' | 'elias';
export type EffectiveDepthLevel = 'safety' | 'low' | 'medium' | 'high';
export type FormulationMode = 'none' | 'low' | 'medium' | 'high';

export interface ClientPromptBuildInput {
  /** Already determined persona */
  persona: Persona;
  /** User display name */
  userName?: string;
  /** Already selected module ID */
  selectedModule?: string;
  /** Already determined crisis level */
  crisisLevel: number;
  /** Already determined safety level */
  safetyLevel: string;
  /** Already built relational stance directive (Kim) */
  relationalStanceDirective?: string;
  /** Already built depth/naming directive (Kim) */
  depthNamingDirective?: string;
  /** Already determined effective depth */
  effectiveDepth?: EffectiveDepthLevel;
  /** Already determined max formulation mode */
  maxFormulationMode?: FormulationMode;
  /** Already built guidance depth reason */
  guidanceDepthReason?: string;
  /** User guidance depth setting */
  userGuidanceDepth?: string;
  /** Already built regulation instruction */
  regulationInstruction?: string;
  /** Already built intervention continuity block */
  interventionContinuityBlock?: string;
  /** Already built engine directive */
  engineDirective?: string;
  /** Already built context summary */
  contextSummary?: string;
  /** Already serialized context.dat */
  contextDatSerialized?: string;
  /** Already built deepening block */
  deepeningBlock?: string;
  /** Already built projection context */
  projectionContext?: string;
  /** Current mood sliders */
  moodSliders?: Record<string, number>;
  /** VSP level */
  vspLevel?: string;
  /** Relapse intent detected */
  relapseIntentDetected?: boolean;
  /** Session duration minutes */
  sessionDurationMinutes?: number;
  /** Conversation history (last N messages) */
  recentHistory?: Array<{ role: string; content: string }>;
  /** Kim formulation block (already built by pipeline formulation engine) */
  kimFormulationBlock?: string;
  /** Elias recovery formulation block (already built by pipeline formulation engine) */
  eliasFormulationBlock?: string;
  /** CMD selected memory summary — compact budget-selected clinical memory for GPT context */
  cmdMemorySummary?: string;
  /** Confirmed personal anchors — compact key figure facts that must always reach GPT */
  personalAnchors?: string;
  /** Rejected suggestions block — topics user explicitly rejected this session */
  rejectedSuggestionsBlock?: string;
  /** Deep analysis context — schemas, modes, triggers, protective factors, values, goals, risks from section analysis */
  personalClinicalContext?: string;
}

export interface ClientBuiltPromptResult {
  systemPrompt: string;
  promptBuildVersion: 'client_mirror_v1';
  persona: Persona;
  estimatedPromptSize: number;
  budgetWarnings: string[];
  debug?: {
    includedSections: string[];
    omittedSections: string[];
    effectiveDepth?: string;
    maxFormulationMode?: string;
  };
}
