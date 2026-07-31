/**
 * VSP Insight PDF Export
 *
 * Generates a PDF summary of the user's VSP Insight profile.
 * Contains:
 * - Observed patterns (early signs, soothing preferences)
 * - Phase transition examples
 * - Personalized soothing options that worked
 *
 * CRITICAL DISCLAIMERS:
 * - "Dit is GEEN diagnose"
 * - "Dit document is een persoonlijk overzicht, geen medisch dossier"
 * - Silent discrepancy data is NEVER included in export
 * - No raw user messages are included
 */

import type {
  RecoFreePersona,
  VspInsightProfile,
  VspPdfExportInput,
  VspPdfExportResult,
  VspPhaseTransitionExample,
  VspPersonalizedSoothingOption,
  VspObservedEarlySign,
  VspSelfReportedEarlySign,
} from "./vspInsightTypes";

export interface VspPdfSection {
  title: string;
  content: string;
}

/**
 * Build PDF content sections from profile.
 * Returns structured sections ready for PDF rendering.
 *
 * NOTE: Actual PDF file generation requires a native module or server-side rendering.
 * This function prepares the content structure.
 */
export function buildPdfSections(input: VspPdfExportInput): VspPdfSection[] {
  const { persona, profile, includeRawUserSelectedExamples, selectedExampleIds, vspSection } = input;
  const personaLabel = persona === "elias" ? "Elias" : "Kim";
  const sections: VspPdfSection[] = [];

  // ─── Disclaimer (always first) ────────────────────────────────────────────
  sections.push({
    title: "Disclaimer",
    content: [
      "⚠️ BELANGRIJK:",
      "",
      "Dit document is GEEN diagnose.",
      "Dit is een persoonlijk overzicht van patronen die zijn waargenomen",
      `tijdens gesprekken met ${personaLabel} in de RecoFree app.`,
      "",
      "Dit document is geen medisch dossier en kan niet worden gebruikt",
      "als vervanging voor professionele hulpverlening.",
      "",
      "De informatie is gebaseerd op zelfrapportage en geautomatiseerde",
      "patroonherkenning. Het is bedoeld als hulpmiddel voor zelfinzicht",
      "en kan worden gedeeld met je behandelaar als je dat wilt.",
      "",
      "─────────────────────────────────────────────────",
      "",
      "⚠️ IMPORTANT:",
      "",
      "This document is NOT a diagnosis.",
      "It is a personal overview of patterns observed during conversations",
      `with ${personaLabel} in the RecoFree app.`,
      "",
      "This document is not a medical record and cannot be used",
      "as a substitute for professional care.",
    ].join("\n"),
  });

  // ─── Profile Summary ──────────────────────────────────────────────────────
  sections.push({
    title: "Profiel Overzicht",
    content: [
      `Persona: ${personaLabel}`,
      `Aangemaakt: ${formatDate(profile.createdAt)}`,
      `Laatst bijgewerkt: ${formatDate(profile.updatedAt)}`,
      `Aantal sessies met patronen: ${profile.phaseTransitionExamples.length}`,
      `Zelfgerapporteerde vroege signalen: ${profile.selfReportedEarlySigns.length}`,
      `Waargenomen vroege signalen: ${profile.observedEarlySigns.length}`,
    ].join("\n"),
  });

  // ─── Ingevuld Veiligheidsplan (user-written) ─────────────────────────────
  if (vspSection) {
    const vspLines: string[] = [];
    const zoneNames: Array<{ key: keyof typeof vspSection.zones; label: string; emoji: string }> = [
      { key: 'green', label: 'Groen (veilig)', emoji: '🟢' },
      { key: 'yellow', label: 'Geel (waakzaam)', emoji: '🟡' },
      { key: 'orange', label: 'Oranje (risico)', emoji: '🟠' },
      { key: 'red', label: 'Rood (gevaar)', emoji: '🔴' },
      { key: 'purple', label: 'Paars (crisis)', emoji: '🟣' },
    ];
    for (const z of zoneNames) {
      const zone = vspSection.zones[z.key];
      if (zone.signals || zone.whatHelps || zone.anchorSentence) {
        vspLines.push(`${z.emoji} ${z.label}`);
        if (zone.signals) vspLines.push(`  Signalen: ${zone.signals}`);
        if (zone.whatHelps) vspLines.push(`  Wat helpt: ${zone.whatHelps}`);
        if (zone.anchorSentence) vspLines.push(`  Kernzin: "${zone.anchorSentence}"`);
        vspLines.push('');
      }
    }
    if (vspSection.triggers.length > 0) {
      vspLines.push('Triggers & Tegenzinnen:');
      for (const t of vspSection.triggers) {
        vspLines.push(`  • ${t.trigger} → ${t.counterThought}`);
      }
      vspLines.push('');
    }
    if (vspSection.recoveryRules.length > 0) {
      vspLines.push('Herstelregels:');
      for (const r of vspSection.recoveryRules) {
        vspLines.push(`  • ${r}`);
      }
      vspLines.push('');
    }
    if (vspSection.mainAnchorSentence) {
      vspLines.push(`Hoofdkernzin: "${vspSection.mainAnchorSentence}"`);
      vspLines.push('');
    }
    if (vspSection.lastUpdated) {
      vspLines.push(`Laatst bijgewerkt: ${formatDate(vspSection.lastUpdated)}`);
    }
    if (vspLines.length > 0) {
      sections.push({
        title: 'Mijn Veiligheidsplan (Ingevuld)',
        content: vspLines.join('\n'),
      });
    }
  }

  // ─── Self-Reported Early Signs ────────────────────────────────────────────
  if (profile.selfReportedEarlySigns.length > 0) {
    sections.push({
      title: "Zelfgerapporteerde Vroege Signalen",
      content: formatSelfReportedSigns(profile.selfReportedEarlySigns),
    });
  }

  // ─── Observed Early Signs ─────────────────────────────────────────────────
  if (profile.observedEarlySigns.length > 0) {
    sections.push({
      title: "Waargenomen Vroege Signalen",
      content: formatObservedSigns(profile.observedEarlySigns),
    });
  }

  // ─── Soothing Preferences ────────────────────────────────────────────────
  if (profile.soothingProfile.personalizedEffectiveOptions.length > 0) {
    sections.push({
      title: "Wat Helpt (Soothing Voorkeuren)",
      content: formatSoothingPreferences(profile.soothingProfile.personalizedEffectiveOptions),
    });
  }

  // ─── Phase Transition Examples ────────────────────────────────────────────
  const examples = includeRawUserSelectedExamples
    ? profile.phaseTransitionExamples.filter((e) => selectedExampleIds.includes(e.exampleId))
    : profile.phaseTransitionExamples.slice(0, 5); // max 5 recent

  if (examples.length > 0) {
    sections.push({
      title: "Voorbeelden van Verandering",
      content: formatTransitionExamples(examples),
    });
  }

  // ─── Pattern Summaries ────────────────────────────────────────────────────
  const patterns: string[] = [];
  if (profile.rationalGreenPattern.confidence > 0.3) {
    patterns.push(
      `Rationeel Groen Patroon (vertrouwen: ${Math.round(profile.rationalGreenPattern.confidence * 100)}%):`,
      `  Markers: ${profile.rationalGreenPattern.markers.slice(0, 5).join(", ")}`,
      ""
    );
  }
  if (profile.overwhelmPattern.confidence > 0.3) {
    patterns.push(
      `Overweldiging Patroon (vertrouwen: ${Math.round(profile.overwhelmPattern.confidence * 100)}%):`,
      `  Markers: ${profile.overwhelmPattern.markers.slice(0, 5).join(", ")}`,
      ""
    );
  }
  if (profile.realGreenPattern.confidence > 0.3) {
    patterns.push(
      `Echt Groen Patroon (vertrouwen: ${Math.round(profile.realGreenPattern.confidence * 100)}%):`,
      `  Markers: ${profile.realGreenPattern.markers.slice(0, 5).join(", ")}`,
      ""
    );
  }
  if (patterns.length > 0) {
    sections.push({
      title: "Patronen",
      content: patterns.join("\n"),
    });
  }

  // ─── Footer ──────────────────────────────────────────────────────────────
  sections.push({
    title: "Afsluiting",
    content: [
      "Dit overzicht is gegenereerd door de RecoFree app.",
      "Het bevat geen ruwe berichten of persoonlijke gegevens die je hebt gedeeld.",
      "Stille discrepanties (interne observaties) zijn NIET opgenomen.",
      "",
      "Als je dit wilt delen met je behandelaar, kan het helpen om",
      "samen te bespreken welke patronen je herkent.",
      "",
      `Geëxporteerd op: ${formatDate(input.exportedAt)}`,
    ].join("\n"),
  });

  return sections;
}

/**
 * Generate a plain-text version of the PDF content.
 * Can be used for sharing or as fallback when PDF rendering is unavailable.
 */
export function buildPdfPlainText(input: VspPdfExportInput): string {
  const sections = buildPdfSections(input);
  const lines: string[] = [
    "═══════════════════════════════════════════════════════════",
    "  RECOFREE — VEILIGHEIDSPLAN & INSIGHT OVERZICHT",
    "═══════════════════════════════════════════════════════════",
    "",
  ];

  for (const section of sections) {
    lines.push(`── ${section.title} ──`);
    lines.push("");
    lines.push(section.content);
    lines.push("");
    lines.push("───────────────────────────────────────────────────────────");
    lines.push("");
  }

  return lines.join("\n");
}

// ─── Formatting Helpers ───────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("nl-BE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatSelfReportedSigns(signs: VspSelfReportedEarlySign[]): string {
  return signs
    .map((sign) => {
      const zones = sign.userReportedZoneAssociation.join(", ");
      return `• ${sign.label}\n  Zones: ${zones}\n  Bron: ${sign.source}`;
    })
    .join("\n\n");
}

function formatObservedSigns(signs: VspObservedEarlySign[]): string {
  return signs
    .filter((s) => s.confidence >= 0.4) // only show reasonably confident ones
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10) // max 10
    .map((sign) => {
      const conf = Math.round(sign.confidence * 100);
      return `• ${sign.label} (${conf}% vertrouwen)\n  Staat: ${sign.associatedInsightState}\n  Frequentie: ${sign.frequency}x waargenomen`;
    })
    .join("\n\n");
}

function formatSoothingPreferences(options: VspPersonalizedSoothingOption[]): string {
  return options
    .sort((a, b) => b.averageEffectScore - a.averageEffectScore)
    .slice(0, 8) // max 8
    .map((opt) => {
      const score = Math.round(opt.averageEffectScore * 10) / 10;
      return `• ${opt.label}\n  Kanaal: ${opt.sensoryChannel}\n  Effect: ${score}/10\n  ${opt.timesHelpful}/${opt.timesChosen} keer helpend`;
    })
    .join("\n\n");
}

function formatTransitionExamples(examples: VspPhaseTransitionExample[]): string {
  return examples
    .map((ex) => {
      const duration = ex.durationSeconds
        ? `${Math.round(ex.durationSeconds / 60)} min`
        : "onbekend";
      const lines = [
        `• ${ex.fromState} → ${ex.toState}`,
        `  Zone: ${ex.fromZone} → ${ex.toZone}`,
        `  Duur in vorige staat: ${duration}`,
        `  Context: ${ex.triggerContextSafeSummary}`,
      ];
      if (ex.helpfulActionSafeSummary) {
        lines.push(`  Wat hielp: ${ex.helpfulActionSafeSummary}`);
      }
      return lines.join("\n");
    })
    .join("\n\n");
}
