/**
 * Schema rotation logic for greeting engine.
 * Runs only on every 4th session. Cycles through eligible schemas without repetition.
 */

import type { GreetingSchemaTendency, GreetingSchemaRotationState } from './sessionGreeting.types';

const SCHEMA_CONFIDENCE_THRESHOLD = 0.60;

export interface ResolveSchemaRotationInput {
  currentSessionNumber: number;
  schemaTendencies: GreetingSchemaTendency[];
  rotationState?: GreetingSchemaRotationState;
}

export interface SchemaRotationResult {
  selectedSchema: GreetingSchemaTendency | null;
  nextRotationState: GreetingSchemaRotationState;
  reason: string;
}

export function resolveSchemaRotationAnchor(input: ResolveSchemaRotationInput): SchemaRotationResult {
  const { currentSessionNumber, schemaTendencies, rotationState } = input;

  const defaultState: GreetingSchemaRotationState = {
    usedSchemaIdsInCurrentCycle: [],
    lastSchemaAnchorSessionNumber: 0,
    lastSchemaIdUsed: null,
  };

  const state = rotationState ?? defaultState;

  // Schema rotation only runs when currentSessionNumber % 4 == 0
  if (currentSessionNumber === 0 || currentSessionNumber % 4 !== 0) {
    return {
      selectedSchema: null,
      nextRotationState: state,
      reason: `Not a 4th session (session=${currentSessionNumber}, ${currentSessionNumber} % 4 = ${currentSessionNumber % 4})`,
    };
  }

  // Filter eligible schemas (confidence >= 0.60)
  const eligible = schemaTendencies
    .filter(s => (s.confidence ?? s.score ?? 0) >= SCHEMA_CONFIDENCE_THRESHOLD)
    .sort((a, b) => {
      // Sort by: 1. highest confidence, 2. most recent lastUpdatedAt, 3. lexical schemaId
      const confA = a.confidence ?? a.score ?? 0;
      const confB = b.confidence ?? b.score ?? 0;
      if (confB !== confA) return confB - confA;
      const dateA = a.lastUpdatedAt ?? '';
      const dateB = b.lastUpdatedAt ?? '';
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      return (a.schemaId ?? a.name ?? '').localeCompare(b.schemaId ?? b.name ?? '');
    });

  if (eligible.length === 0) {
    return {
      selectedSchema: null,
      nextRotationState: state,
      reason: 'No schemas with confidence >= 0.60',
    };
  }

  // Check if all eligible schemas have been used in current cycle
  let usedIds = [...state.usedSchemaIdsInCurrentCycle];
  const eligibleIds = eligible.map(s => s.schemaId ?? s.name ?? '');
  const allUsed = eligibleIds.every(id => usedIds.includes(id));

  if (allUsed) {
    // Reset cycle
    usedIds = [];
  }

  // Select first eligible schema not in usedIds
  const selected = eligible.find(s => !usedIds.includes(s.schemaId ?? s.name ?? '')) ?? null;

  if (!selected) {
    return {
      selectedSchema: null,
      nextRotationState: state,
      reason: 'No eligible schema available after filtering used IDs',
    };
  }

  const selectedId = selected.schemaId ?? selected.name ?? '';
  const nextRotationState: GreetingSchemaRotationState = {
    usedSchemaIdsInCurrentCycle: [...usedIds, selectedId],
    lastSchemaAnchorSessionNumber: currentSessionNumber,
    lastSchemaIdUsed: selectedId,
  };

  return {
    selectedSchema: selected,
    nextRotationState,
    reason: `Schema rotation: selected "${selected.schemaName ?? selected.name ?? 'unknown'}" (conf=${selected.confidence ?? selected.score ?? 0}, session=${currentSessionNumber})`,
  };
}
