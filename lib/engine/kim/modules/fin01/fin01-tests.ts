/**
 * FIN01 Test Definitions — Financiële Afhankelijkheid/Controle Detectie
 */

import type { FIN01DetectionInput } from './fin01-types';

export const FIN01_TEST_CASES: { name: string; input: FIN01DetectionInput; expectDetected: boolean; expectMarkers?: string[] }[] = [
  {
    name: 'Detects financial-control + economic-trapped',
    input: {
      message: 'He controls all the money and I have no access to our bank account. I can\'t leave because I have no own income.',
      recentHistory: [],
      k06Stabilized: true,
      crisisLevel: 0,
      previousDetections: [],
      backpackContext: '',
    },
    expectDetected: true,
    expectMarkers: ['financial-control', 'economic-trapped'],
  },
  {
    name: 'Detects debt-from-addiction + sacrifice-savings',
    input: {
      message: 'He spent all our savings on drugs and now we have debts from his addiction everywhere.',
      recentHistory: [],
      k06Stabilized: true,
      crisisLevel: 0,
      previousDetections: [],
      backpackContext: '',
    },
    expectDetected: true,
    expectMarkers: ['debt-from-addiction', 'sacrifice-savings'],
  },
  {
    name: 'Does not activate when K06 not stabilized',
    input: {
      message: 'He controls all the money and I can\'t leave because I depend on him financially.',
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
      message: 'He controls all the money and I can\'t leave because I depend on him financially.',
      recentHistory: [],
      k06Stabilized: true,
      crisisLevel: 2,
      previousDetections: [],
      backpackContext: '',
    },
    expectDetected: false,
  },
  {
    name: 'Detects money-as-peace + shame-about-money',
    input: {
      message: 'I just give him money to buy peace and quiet. I am so ashamed of our financial situation that I can\'t tell anyone.',
      recentHistory: [],
      k06Stabilized: true,
      crisisLevel: 0,
      previousDetections: [],
      backpackContext: '',
    },
    expectDetected: true,
    expectMarkers: ['money-as-peace', 'shame-about-money'],
  },
  {
    name: 'Single marker insufficient for detection',
    input: {
      message: 'I am ashamed about our money situation.',
      recentHistory: [],
      k06Stabilized: true,
      crisisLevel: 0,
      previousDetections: [],
      backpackContext: '',
    },
    expectDetected: false,
  },
];
