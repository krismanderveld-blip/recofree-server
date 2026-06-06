/**
 * Kim Advanced Modules — Pipeline Integration Layer
 *
 * Consolidates KST01, KDL01, KBR01, KSC01 detection, routing, and prompt
 * building into a single import point for pipeline.ts.
 *
 * Pipeline order after K06:
 *   K06 → KST01 → conditional routing to KDL01 / KBR01 / KSC01
 *
 * Routing rules:
 *   KST01 → KDL01 when CONNECTED_NOT_CONSUMED_TO_KDL01
 *   KST01 → KBR01 when BOUNDARY_PLANNING_TO_KBR01
 *   KST01 → KSC01 when CAREGIVER_SHAME_TO_KSC01
 *   KST01 → K06_SAFETY when crisisLevel >= 2
 */

import { detectKST01 } from '../../../modules/kim/kst01/kst01-detector';
import { routeKST01 } from '../../../modules/kim/kst01/kst01-router';
import { buildKST01PromptPayload, buildKST01FullPromptBlock } from '../../../modules/kim/kst01/kst01-prompt';
import type { KST01RuntimeInputs, KST01DetectionResult, KST01OutputContract, KST01StorageState } from '../../../modules/kim/kst01/kst01-types';

import { detectKDL01 } from '../../../modules/kim/kdl01/kdl01-detector';
import { routeKDL01 } from '../../../modules/kim/kdl01/kdl01-router';
import { buildKDL01PromptPayload, buildKDL01FullPromptBlock } from '../../../modules/kim/kdl01/kdl01-prompt';
import type { KDL01RuntimeInputs, KDL01DetectionResult, KDL01OutputContract, KDL01StorageState } from '../../../modules/kim/kdl01/kdl01-types';

import { detectKBR01 } from '../../../modules/kim/kbr01/kbr01-detector';
import { routeKBR01 } from '../../../modules/kim/kbr01/kbr01-router';
import { buildKBR01PromptPayload, buildKBR01FullPromptBlock } from '../../../modules/kim/kbr01/kbr01-prompt';
import type { KBR01RuntimeInputs, KBR01DetectionResult, KBR01OutputContract, KBR01StorageState } from '../../../modules/kim/kbr01/kbr01-types';

import { detectKSC01 } from '../../../modules/kim/ksc01/ksc01-detector';
import { routeKSC01 } from '../../../modules/kim/ksc01/ksc01-router';
import { buildKSC01PromptPayload, buildKSC01FullPromptBlock } from '../../../modules/kim/ksc01/ksc01-prompt';
import type { KSC01RuntimeInputs, KSC01DetectionResult, KSC01OutputContract, KSC01StorageState } from '../../../modules/kim/ksc01/ksc01-types';

import type { KimModuleRouteTarget } from '../../../modules/kim/kst01/kst01-types';

// ─── Combined Result ───────────────────────────────────────────────

export interface KimAdvancedModulesResult {
  kst01Active: boolean;
  kdl01Active: boolean;
  kbr01Active: boolean;
  ksc01Active: boolean;
  kst01PromptBlock: string | null;
  kdl01PromptBlock: string | null;
  kbr01PromptBlock: string | null;
  ksc01PromptBlock: string | null;
  routeTarget: KimModuleRouteTarget;
  kst01StoragePatch: Partial<KST01StorageState>;
  kdl01StoragePatch: Partial<KDL01StorageState>;
  kbr01StoragePatch: Partial<KBR01StorageState>;
  ksc01StoragePatch: Partial<KSC01StorageState>;
}

export interface KimAdvancedModulesInput {
  userType: 'elias' | 'kim';
  latestUserMessage: string;
  recentMessages: string[];
  crisisLevel: number;
  k06SafetyGate: 'cleared' | 'partial_with_grounding' | 'blocked' | 'not_run';
  stabilizationStatus: 'stable' | 'partially_stable' | 'unstable' | 'unknown';
  // Slider values
  caregiverShameLevel?: number;
  guiltLevel?: number;
  boundaryReadinessLevel?: number;
  selfLossLevel?: number;
  angerShameLevel?: number;
  restGuiltLevel?: number;
  // Cross-module routing
  recentRelapseOfLovedOne?: boolean;
  exactWordingRequested?: boolean;
  safetyBoundaryConcern?: boolean;
  // Storage for continuity
  kst01Storage?: KST01StorageState;
  kdl01Storage?: KDL01StorageState;
  kbr01Storage?: KBR01StorageState;
  ksc01Storage?: KSC01StorageState;
}

/**
 * Run the full Kim advanced module pipeline:
 * 1. Always run KST01 first
 * 2. Based on KST01 route target, conditionally run KDL01/KBR01/KSC01
 * 3. Return combined result with all prompt blocks and storage patches
 */
export function runKimAdvancedModules(input: KimAdvancedModulesInput): KimAdvancedModulesResult {
  const emptyResult: KimAdvancedModulesResult = {
    kst01Active: false,
    kdl01Active: false,
    kbr01Active: false,
    ksc01Active: false,
    kst01PromptBlock: null,
    kdl01PromptBlock: null,
    kbr01PromptBlock: null,
    ksc01PromptBlock: null,
    routeTarget: 'NO_MODULE',
    kst01StoragePatch: {},
    kdl01StoragePatch: {},
    kbr01StoragePatch: {},
    ksc01StoragePatch: {},
  };

  // Only run for Kim users
  if (input.userType !== 'kim') return emptyResult;

  // ── Step 1: KST01 Stoicism for Caregivers ──
  const kst01Input: KST01RuntimeInputs = {
    userType: input.userType,
    latestUserMessage: input.latestUserMessage,
    recentMessages: input.recentMessages,
    crisisLevel: input.crisisLevel,
    k06SafetyGate: input.k06SafetyGate,
    stabilizationStatus: input.stabilizationStatus,
    caregiverShameLevel: input.caregiverShameLevel,
    selfLossLevel: input.selfLossLevel,
  };

  const kst01Detection = detectKST01(kst01Input);
  const kst01Output = routeKST01(kst01Detection, input.kst01Storage);

  let kst01PromptBlock: string | null = null;
  if (kst01Output.promptPayload) {
    kst01PromptBlock = buildKST01FullPromptBlock(kst01Output.promptPayload);
  }

  const result: KimAdvancedModulesResult = {
    ...emptyResult,
    kst01Active: kst01Detection.activationStatus === 'ACTIVE',
    kst01PromptBlock,
    kst01StoragePatch: kst01Output.storagePatch,
    routeTarget: kst01Output.routeNext,
  };

  // ── Step 2: Conditional routing based on KST01 decision ──
  const routeTarget = kst01Output.routeNext;

  if (routeTarget === 'KDL01_DETACHMENT_WITH_LOVE') {
    const kdl01Input: KDL01RuntimeInputs = {
      userType: input.userType,
      latestUserMessage: input.latestUserMessage,
      recentMessages: input.recentMessages,
      crisisLevel: input.crisisLevel,
      k06SafetyGate: input.k06SafetyGate,
      stabilizationStatus: input.stabilizationStatus,
      selfLossLevel: input.selfLossLevel,
      caregiverShameLevel: input.caregiverShameLevel,
      routedFromKST01: true,
    };
    const kdl01Detection = detectKDL01(kdl01Input);
    const kdl01Output = routeKDL01(kdl01Detection, input.kdl01Storage);
    if (kdl01Output.promptPayload) {
      result.kdl01PromptBlock = buildKDL01FullPromptBlock(kdl01Output.promptPayload);
    }
    result.kdl01Active = kdl01Detection.activationStatus === 'ACTIVE';
    result.kdl01StoragePatch = kdl01Output.storagePatch;
    result.routeTarget = kdl01Output.routeNext;
  }

  if (routeTarget === 'KBR01_BOUNDARY_RESTORATION') {
    const kbr01Input: KBR01RuntimeInputs = {
      userType: input.userType,
      latestUserMessage: input.latestUserMessage,
      recentMessages: input.recentMessages,
      crisisLevel: input.crisisLevel,
      k06SafetyGate: input.k06SafetyGate,
      stabilizationStatus: input.stabilizationStatus,
      boundaryReadinessLevel: input.boundaryReadinessLevel,
      caregiverShameLevel: input.caregiverShameLevel,
      selfLossLevel: input.selfLossLevel,
      exactWordingRequested: input.exactWordingRequested,
      safetyBoundaryConcern: input.safetyBoundaryConcern,
      routedFromKST01: true,
    };
    const kbr01Detection = detectKBR01(kbr01Input);
    const kbr01Output = routeKBR01(kbr01Detection, input.kbr01Storage);
    if (kbr01Output.promptPayload) {
      result.kbr01PromptBlock = buildKBR01FullPromptBlock(kbr01Output.promptPayload);
    }
    result.kbr01Active = kbr01Detection.activationStatus === 'ACTIVE';
    result.kbr01StoragePatch = kbr01Output.storagePatch;
    result.routeTarget = kbr01Output.routeNext;
  }

  if (routeTarget === 'KSC01_SELF_COMPASSION_CAREGIVER') {
    const ksc01Input: KSC01RuntimeInputs = {
      userType: input.userType,
      latestUserMessage: input.latestUserMessage,
      recentMessages: input.recentMessages,
      crisisLevel: input.crisisLevel,
      k06SafetyGate: input.k06SafetyGate,
      stabilizationStatus: input.stabilizationStatus,
      caregiverShameLevel: input.caregiverShameLevel,
      guiltLevel: input.guiltLevel,
      boundaryReadinessLevel: input.boundaryReadinessLevel,
      selfLossLevel: input.selfLossLevel,
      angerShameLevel: input.angerShameLevel,
      restGuiltLevel: input.restGuiltLevel,
      recentRelapseOfLovedOne: input.recentRelapseOfLovedOne,
      routedFromKST01: true,
    };
    const ksc01Detection = detectKSC01(ksc01Input);
    const ksc01Output = routeKSC01(ksc01Detection, input.ksc01Storage);
    if (ksc01Output.promptPayload) {
      result.ksc01PromptBlock = buildKSC01FullPromptBlock(ksc01Output.promptPayload);
    }
    result.ksc01Active = ksc01Detection.activationStatus === 'ACTIVE';
    result.ksc01StoragePatch = ksc01Output.storagePatch;
    result.routeTarget = ksc01Output.routeNext;
  }

  // Safety override: if crisis detected at any point, route to K06_SAFETY
  if (input.crisisLevel >= 2) {
    result.routeTarget = 'K06_SAFETY';
  }

  return result;
}

// Re-export types for pipeline usage
export type { KST01StorageState, KDL01StorageState, KBR01StorageState, KSC01StorageState, KimModuleRouteTarget };
