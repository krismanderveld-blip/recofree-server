/**
 * PAR01 Test Definitions — Parentificatie Patroon Detectie
 */

import type { PAR01DetectionInput } from './par01-types';

export const PAR01_TEST_CASES: { name: string; input: PAR01DetectionInput; expectDetected: boolean; expectMarkers?: string[] }[] = [
  {
    name: 'Detects role-reversal + responsibility-overload',
    input: {
      message: 'I have to take care of him like he is a child. If I don\'t do it, nobody else will.',
      recentHistory: [],
      k06Stabilized: true,
      crisisLevel: 0,
      previousDetections: [],
      backpackContext: '',
    },
    expectDetected: true,
    expectMarkers: ['role-reversal', 'responsibility-overload'],
  },
  {
    name: 'Detects childhood-pattern + identity-as-caretaker',
    input: {
      message: 'I have always been the one who fixes everything since I was a child. That is just who I am.',
      recentHistory: [],
      k06Stabilized: true,
      crisisLevel: 0,
      previousDetections: [],
      backpackContext: '',
    },
    expectDetected: true,
    expectMarkers: ['identity-as-caretaker', 'childhood-pattern'],
  },
  {
    name: 'Does not activate when K06 not stabilized',
    input: {
      message: 'I have to take care of him like a child and nobody else will do it.',
      recentHistory: [],
      k06Stabilized: false,
      crisisLevel: 0,
      previousDetections: [],
      backpackContext: '',
    },
    expectDetected: false,
  },
  {
    name: 'Does not activate during crisis',
    input: {
      message: 'I have to take care of him like a child and nobody else will do it.',
      recentHistory: [],
      k06Stabilized: true,
      crisisLevel: 2,
      previousDetections: [],
      backpackContext: '',
    },
    expectDetected: false,
  },
  {
    name: 'Detects exhaustion-denial + guilt-when-stepping-back',
    input: {
      message: 'I am so exhausted but I have to keep going. I feel guilty when I try to step back and rest.',
      recentHistory: [],
      k06Stabilized: true,
      crisisLevel: 0,
      previousDetections: [],
      backpackContext: '',
    },
    expectDetected: true,
    expectMarkers: ['exhaustion-denial', 'guilt-when-stepping-back'],
  },
  {
    name: 'Single marker insufficient for detection',
    input: {
      message: 'I am tired but I must keep going.',
      recentHistory: [],
      k06Stabilized: true,
      crisisLevel: 0,
      previousDetections: [],
      backpackContext: '',
    },
    expectDetected: false,
  },
];
