/**
 * SW01 Shadow Work — Zucht Router
 *
 * Routes shadow work depth and intervention style based on zuchtmeter state.
 *
 * CANON: shadowwork.txt section 6
 *   green  → reflection,     warm_direct
 *   yellow → early_detection, warm_direct
 *   orange → interruption,    sharp_warm
 *   red    → containment,     contained_direct
 *
 * At red: no deep excavation. Name the loop, contain the next action.
 */

import type { ZuchtShadowState, ZuchtColor, AllowedDepth, InterventionStyle } from './sw01_shadow_types';

// ─── Zucht Color Thresholds ──────────────────────────────────────────────────

function getZuchtColor(zuchtValue: number): ZuchtColor {
  if (zuchtValue >= 8) return 'red';
  if (zuchtValue >= 6) return 'orange';
  if (zuchtValue >= 4) return 'yellow';
  return 'green';
}

// ─── Depth Routing ───────────────────────────────────────────────────────────

const DEPTH_MAP: Record<ZuchtColor, AllowedDepth> = {
  green: 'reflection',
  yellow: 'early_detection',
  orange: 'interruption',
  red: 'containment',
};

const STYLE_MAP: Record<ZuchtColor, InterventionStyle> = {
  green: 'warm_direct',
  yellow: 'warm_direct',
  orange: 'sharp_warm',
  red: 'contained_direct',
};

// ─── Router Function ─────────────────────────────────────────────────────────

/**
 * Compute the ZuchtShadowState from a raw zuchtmeter value (0-10).
 */
export function routeZuchtShadow(zuchtValue: number): ZuchtShadowState {
  const clamped = Math.max(0, Math.min(10, zuchtValue));
  const color = getZuchtColor(clamped);

  return {
    zucht_value: clamped,
    zucht_color: color,
    allowed_depth: DEPTH_MAP[color],
    intervention_style: STYLE_MAP[color],
  };
}

// ─── Depth Constraint Helpers ────────────────────────────────────────────────

/**
 * Returns true if the current zucht state allows deep exploration
 * (archetype mapping, childhood material, full projection unfolding).
 */
export function allowsDeepExploration(state: ZuchtShadowState): boolean {
  return state.zucht_color === 'green';
}

/**
 * Returns true if the current zucht state allows early pattern detection
 * (naming loops, slowing escalation, preventing rationalization).
 */
export function allowsPatternDetection(state: ZuchtShadowState): boolean {
  return state.zucht_color === 'green' || state.zucht_color === 'yellow';
}

/**
 * Returns true if the current zucht state requires containment mode
 * (no deep excavation, brief naming, hold present, reduce shame collapse).
 */
export function requiresContainment(state: ZuchtShadowState): boolean {
  return state.zucht_color === 'red';
}

/**
 * Returns true if the current zucht state requires loop interruption
 * (direct naming, reduce self-deception, focus on immediate next choice).
 */
export function requiresInterruption(state: ZuchtShadowState): boolean {
  return state.zucht_color === 'orange' || state.zucht_color === 'red';
}

// ─── Depth Description (for prompt injection) ────────────────────────────────

const DEPTH_DESCRIPTIONS: Record<ZuchtColor, string> = {
  green: 'Reflective mode: explore recurring themes, map shame/projection/anger/longing, connect to values, use journaling, identify early warning signs.',
  yellow: 'Early detection mode: detect shadow trigger early, prevent rationalization, name emotional fuel, slow the loop before escalation.',
  orange: 'Interruption mode: stop abstraction, name the loop directly, reduce self-deception, bring attention to immediate next choice, avoid long analysis.',
  red: 'Containment mode: do NOT dig deeply, do NOT open childhood layers, do NOT run full archetype mapping. Name the shadow loop, hold user in present, reduce shame collapse, keep responsibility alive.',
};

/**
 * Get a description of what Elias should do at the current depth level.
 */
export function getDepthDescription(state: ZuchtShadowState): string {
  return DEPTH_DESCRIPTIONS[state.zucht_color];
}
