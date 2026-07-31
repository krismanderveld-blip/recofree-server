/**
 * KERP01 Export — Text export of the Eigen Regie Plan for sharing with therapist.
 *
 * Generates a readable plain-text document that can be shared via the system share sheet.
 * The format is designed to be clear and useful for a therapist or counselor.
 */

import type { EigenRegiePlan, EigenRegieZoneId } from './kerp01-types';

const ZONE_LABELS: Record<EigenRegieZoneId, string> = {
  donkergroen: 'Donkergroen (stabiel, sterk)',
  lichtgroen: 'Lichtgroen (rustig, alert)',
  geel: 'Geel (licht uit balans)',
  oranje: 'Oranje (kwetsbaar, gespannen)',
  rood: 'Rood (crisis, overbelast)',
};

const ZONE_ORDER: EigenRegieZoneId[] = ['donkergroen', 'lichtgroen', 'geel', 'oranje', 'rood'];

/**
 * Export the Eigen Regie Plan as a formatted plain-text string.
 * Suitable for sharing via email, messaging, or printing.
 */
export function exportEigenRegiePlanAsText(plan: EigenRegiePlan, userName?: string): string {
  const lines: string[] = [];

  // Header
  lines.push('═══════════════════════════════════════════════════');
  lines.push('         EIGEN REGIE PLAN');
  if (userName) {
    lines.push(`         ${userName}`);
  }
  lines.push('═══════════════════════════════════════════════════');
  lines.push('');

  // Main anchor sentence
  if (plan.mainAnchorSentence) {
    lines.push('ANKERZIN:');
    lines.push(`  "${plan.mainAnchorSentence}"`);
    lines.push('');
  }

  // Zone entries
  lines.push('───────────────────────────────────────────────────');
  lines.push('ZONES');
  lines.push('───────────────────────────────────────────────────');
  lines.push('');

  for (const zoneId of ZONE_ORDER) {
    const entry = plan.zones[zoneId];
    if (!entry) continue;

    const hasContent = entry.signals || entry.bodySignals || entry.thoughts ||
      entry.behaviour || entry.whatHelps || entry.boundaryActions ||
      entry.contactRule || entry.anchorSentence;

    if (!hasContent) continue;

    lines.push(`▸ ${ZONE_LABELS[zoneId].toUpperCase()}`);
    lines.push('');

    if (entry.signals) {
      lines.push(`  Herkenningssignalen:`);
      lines.push(`    ${entry.signals}`);
    }
    if (entry.bodySignals) {
      lines.push(`  Lichaamssignalen:`);
      lines.push(`    ${entry.bodySignals}`);
    }
    if (entry.thoughts) {
      lines.push(`  Gedachten:`);
      lines.push(`    ${entry.thoughts}`);
    }
    if (entry.behaviour) {
      lines.push(`  Gedrag:`);
      lines.push(`    ${entry.behaviour}`);
    }
    if (entry.whatHelps) {
      lines.push(`  Wat helpt:`);
      lines.push(`    ${entry.whatHelps}`);
    }
    if (entry.boundaryActions) {
      lines.push(`  Grensacties:`);
      lines.push(`    ${entry.boundaryActions}`);
    }
    if (entry.contactRule) {
      lines.push(`  Contactregel:`);
      lines.push(`    ${entry.contactRule}`);
    }
    if (entry.anchorSentence) {
      lines.push(`  Zone-ankerzin:`);
      lines.push(`    "${entry.anchorSentence}"`);
    }
    lines.push('');
  }

  // Triggers
  if (plan.triggers.length > 0) {
    lines.push('───────────────────────────────────────────────────');
    lines.push('TRIGGERS & TEGENACTIES');
    lines.push('───────────────────────────────────────────────────');
    lines.push('');

    for (const trigger of plan.triggers) {
      lines.push(`  • ${trigger.trigger}`);
      lines.push(`    Verliespatroon: ${trigger.lossOfRegiePattern}`);
      lines.push(`    Gezonde reactie: ${trigger.healthyResponse}`);
      lines.push('');
    }
  }

  // Boundary rules
  if (plan.boundaryRules.length > 0) {
    lines.push('───────────────────────────────────────────────────');
    lines.push('GRENSREGELS');
    lines.push('───────────────────────────────────────────────────');
    lines.push('');

    for (const rule of plan.boundaryRules) {
      lines.push(`  • ${rule}`);
    }
    lines.push('');
  }

  // Footer
  lines.push('───────────────────────────────────────────────────');
  lines.push(`Gegenereerd op: ${new Date().toLocaleDateString('nl-NL', { year: 'numeric', month: 'long', day: 'numeric' })}`);
  if (plan.source) {
    lines.push(`Bron: ${plan.source.createdFrom === 'wizard' || plan.source.createdFrom === 'life_story_wizard' ? 'Wizard-geleide opbouw' : plan.source.createdFrom === 'manual' ? 'Handmatig ingevuld' : 'Gemengd'}`);
    if (plan.source.userReviewed) {
      lines.push('Status: Door gebruiker beoordeeld en goedgekeurd');
    }
  }
  lines.push('═══════════════════════════════════════════════════');

  return lines.join('\n');
}
