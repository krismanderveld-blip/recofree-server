import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const localeDir = resolve(import.meta.dirname, '../lib/i18n/locales');

function loadJson(file) {
  return JSON.parse(readFileSync(resolve(localeDir, file), 'utf8'));
}

function saveJson(file, data) {
  writeFileSync(resolve(localeDir, file), JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// New keys needed for the fixes we just made
const newKeysEN = {
  // Mood trend chart card
  "mood_trend_chart_card.toggle.7_days": "7 days",
  "mood_trend_chart_card.toggle.30_days": "30 days",
  "mood_trend_chart_card.fallback.count_recorded": "{{count}} check-in{{plural}} recorded",
  "mood_trend_chart_card.fallback.insufficient": "Not enough check-ins for a chart yet. From 3 check-ins we'll show your trend here.",
  "mood_trend_chart_card.fallback.persona_mismatch": "Mood trend is unavailable for this persona.",

  // Backpack section labels (Elias)
  "backpack.section.childhood.label": "Childhood",
  "backpack.section.childhood.age_range": "6–12 years",
  "backpack.section.adolescence.label": "Adolescence",
  "backpack.section.adolescence.age_range": "12–18 years",
  "backpack.section.adulthood.label": "Adulthood",
  "backpack.section.adulthood.age_range": "18–50 years",
  "backpack.section.family.label": "Family",
  "backpack.section.family.age_range": "Throughout life",
  "backpack.section.themes.label": "Recurring Themes",
  "backpack.section.themes.age_range": "Across all phases",
  "backpack.section.vsp.label": "Safety Plan",
  "backpack.section.vsp.age_range": "",

  // Backpack Kim section labels
  "backpack.kim.triggers.title": "Triggers & Patterns",
  "backpack.kim.triggers.subtitle": "What situations trigger you?",
  "backpack.kim.boundaries.title": "Boundaries",
  "backpack.kim.boundaries.subtitle": "Where do your boundaries lie?",
  "backpack.kim.selfCare.title": "Self-care",
  "backpack.kim.selfCare.subtitle": "What helps you recharge?",
  "backpack.kim.relationships.title": "Relationships",
  "backpack.kim.relationships.subtitle": "Key people in your life",
  "backpack.kim.goals.title": "Goals",
  "backpack.kim.goals.subtitle": "What are you working towards?",

  // Backpack progress counter
  "backpack.progress.counter": "{{filled}} of {{total}} sections",

  // Profile stage labels
  "profile.stage.precontemplation": "Precontemplation",
  "profile.stage.contemplation": "Contemplation",
  "profile.stage.preparation": "Preparation",
  "profile.stage.action": "Action",
  "profile.stage.maintenance": "Maintenance",

  // Profile stats
  "profile.user_card.stats.session": "session",
  "profile.user_card.stats.plural_s": "s",

  // Profile emergency contact remove
  "profile.emergency_contacts.alert.remove.message_name": "Remove {{name}}?",

  // Profile VSP share
  "profile.vsp_insight.share_title": "VSP Insight Overview",

  // Balkmetafoor
  "profile.balkmetafoor.label.draaglast": "Burden",
  "profile.balkmetafoor.label.draagkracht": "Capacity",
  "profile.balkmetafoor.not_initialized": "The balance metaphor will be introduced by Elias when the time is right.",
  "profile.balkmetafoor.title": "Your balance",
  "profile.balkmetafoor.subtitle": "No score — just a picture of what's going on",

  // Chat error boundary
  "chat_error_boundary.message": "An error occurred. Your data is safe.",
  "chat_error_boundary.screenshot_hint": "📸 Screenshot this screen and send it to the developer",

  // Eigen Regie (prechat)
  "eigen_regie.greeting": "How was your day, {{name}}?",
  "eigen_regie.question": "To what extent was your day today determined by the choices of the other person?",
  "eigen_regie.slider.min": "Full self-direction",
  "eigen_regie.slider.max": "Fully determined by the other",
  "eigen_regie.zone.ROOD": "Red",
  "eigen_regie.zone.ORANJE": "Orange",
  "eigen_regie.zone.GEEL": "Yellow",
  "eigen_regie.zone.LICHTGROEN": "Light Green",
  "eigen_regie.zone.GROEN": "Green",
  "eigen_regie.confirm": "Confirm",
};

const newKeysNL = {
  "mood_trend_chart_card.toggle.7_days": "7 dagen",
  "mood_trend_chart_card.toggle.30_days": "30 dagen",
  "mood_trend_chart_card.fallback.count_recorded": "{{count}} check-in{{plural}} vastgelegd",
  "mood_trend_chart_card.fallback.insufficient": "Nog te weinig check-ins voor een grafiek. Vanaf 3 check-ins tonen we je trend hier.",
  "mood_trend_chart_card.fallback.persona_mismatch": "Stemmingstrend is niet beschikbaar voor dit persona.",

  "backpack.section.childhood.label": "Kindertijd",
  "backpack.section.childhood.age_range": "6–12 jaar",
  "backpack.section.adolescence.label": "Adolescentie",
  "backpack.section.adolescence.age_range": "12–18 jaar",
  "backpack.section.adulthood.label": "Volwassenheid",
  "backpack.section.adulthood.age_range": "18–50 jaar",
  "backpack.section.family.label": "Familie",
  "backpack.section.family.age_range": "Heel het leven",
  "backpack.section.themes.label": "Terugkerende thema's",
  "backpack.section.themes.age_range": "Door alle fases heen",
  "backpack.section.vsp.label": "Veiligheidsplan",
  "backpack.section.vsp.age_range": "",

  "backpack.kim.triggers.title": "Triggers & Patronen",
  "backpack.kim.triggers.subtitle": "Welke situaties triggeren je?",
  "backpack.kim.boundaries.title": "Grenzen",
  "backpack.kim.boundaries.subtitle": "Waar liggen jouw grenzen?",
  "backpack.kim.selfCare.title": "Zelfzorg",
  "backpack.kim.selfCare.subtitle": "Wat helpt je opladen?",
  "backpack.kim.relationships.title": "Relaties",
  "backpack.kim.relationships.subtitle": "Belangrijke mensen in je leven",
  "backpack.kim.goals.title": "Doelen",
  "backpack.kim.goals.subtitle": "Waar werk je naartoe?",

  "backpack.progress.counter": "{{filled}} van {{total}} secties",

  "profile.stage.precontemplation": "Voorbeschouwing",
  "profile.stage.contemplation": "Beschouwing",
  "profile.stage.preparation": "Voorbereiding",
  "profile.stage.action": "Actie",
  "profile.stage.maintenance": "Onderhoud",

  "profile.user_card.stats.session": "sessie",
  "profile.user_card.stats.plural_s": "s",

  "profile.emergency_contacts.alert.remove.message_name": "{{name}} verwijderen?",

  "profile.vsp_insight.share_title": "VSP Inzicht Overzicht",

  "profile.balkmetafoor.label.draaglast": "Draaglast",
  "profile.balkmetafoor.label.draagkracht": "Draagkracht",
  "profile.balkmetafoor.not_initialized": "De balkmetafoor wordt geïntroduceerd door Elias wanneer het moment er is.",
  "profile.balkmetafoor.title": "Jouw balans",
  "profile.balkmetafoor.subtitle": "Geen score — gewoon een beeld van wat er speelt",

  "chat_error_boundary.message": "Er is een fout opgetreden. Je data is veilig.",
  "chat_error_boundary.screenshot_hint": "📸 Screenshot dit scherm en stuur het naar de developer",

  "eigen_regie.greeting": "Hoe was je dag, {{name}}?",
  "eigen_regie.question": "In hoeverre werd je dag vandaag bepaald door de keuzes van de ander?",
  "eigen_regie.slider.min": "Volledige eigen regie",
  "eigen_regie.slider.max": "Volledig bepaald door de ander",
  "eigen_regie.zone.ROOD": "Rood",
  "eigen_regie.zone.ORANJE": "Oranje",
  "eigen_regie.zone.GEEL": "Geel",
  "eigen_regie.zone.LICHTGROEN": "Lichtgroen",
  "eigen_regie.zone.GROEN": "Groen",
  "eigen_regie.confirm": "Bevestigen",
};

const newKeysFR = {
  "mood_trend_chart_card.toggle.7_days": "7 jours",
  "mood_trend_chart_card.toggle.30_days": "30 jours",
  "mood_trend_chart_card.fallback.count_recorded": "{{count}} check-in{{plural}} enregistré{{plural}}",
  "mood_trend_chart_card.fallback.insufficient": "Pas encore assez de check-ins pour un graphique. À partir de 3 check-ins, nous afficherons ta tendance ici.",
  "mood_trend_chart_card.fallback.persona_mismatch": "La tendance d'humeur n'est pas disponible pour ce persona.",

  "backpack.section.childhood.label": "Enfance",
  "backpack.section.childhood.age_range": "6–12 ans",
  "backpack.section.adolescence.label": "Adolescence",
  "backpack.section.adolescence.age_range": "12–18 ans",
  "backpack.section.adulthood.label": "Âge adulte",
  "backpack.section.adulthood.age_range": "18–50 ans",
  "backpack.section.family.label": "Famille",
  "backpack.section.family.age_range": "Toute la vie",
  "backpack.section.themes.label": "Thèmes récurrents",
  "backpack.section.themes.age_range": "À travers toutes les phases",
  "backpack.section.vsp.label": "Plan de sécurité",
  "backpack.section.vsp.age_range": "",

  "backpack.kim.triggers.title": "Déclencheurs & Schémas",
  "backpack.kim.triggers.subtitle": "Quelles situations te déclenchent ?",
  "backpack.kim.boundaries.title": "Limites",
  "backpack.kim.boundaries.subtitle": "Où se trouvent tes limites ?",
  "backpack.kim.selfCare.title": "Prendre soin de soi",
  "backpack.kim.selfCare.subtitle": "Qu'est-ce qui t'aide à recharger ?",
  "backpack.kim.relationships.title": "Relations",
  "backpack.kim.relationships.subtitle": "Les personnes clés dans ta vie",
  "backpack.kim.goals.title": "Objectifs",
  "backpack.kim.goals.subtitle": "Vers quoi tu travailles ?",

  "backpack.progress.counter": "{{filled}} sur {{total}} sections",

  "profile.stage.precontemplation": "Précontemplation",
  "profile.stage.contemplation": "Contemplation",
  "profile.stage.preparation": "Préparation",
  "profile.stage.action": "Action",
  "profile.stage.maintenance": "Maintien",

  "profile.user_card.stats.session": "session",
  "profile.user_card.stats.plural_s": "s",

  "profile.emergency_contacts.alert.remove.message_name": "Supprimer {{name}} ?",

  "profile.vsp_insight.share_title": "Aperçu VSP",

  "profile.balkmetafoor.label.draaglast": "Charge",
  "profile.balkmetafoor.label.draagkracht": "Capacité",
  "profile.balkmetafoor.not_initialized": "La métaphore de la balance sera introduite par Elias quand le moment sera venu.",
  "profile.balkmetafoor.title": "Ton équilibre",
  "profile.balkmetafoor.subtitle": "Pas de score — juste une image de ce qui se passe",

  "chat_error_boundary.message": "Une erreur s'est produite. Tes données sont en sécurité.",
  "chat_error_boundary.screenshot_hint": "📸 Fais une capture d'écran et envoie-la au développeur",

  "eigen_regie.greeting": "Comment était ta journée, {{name}} ?",
  "eigen_regie.question": "Dans quelle mesure ta journée a-t-elle été déterminée par les choix de l'autre personne ?",
  "eigen_regie.slider.min": "Pleine autonomie",
  "eigen_regie.slider.max": "Entièrement déterminé par l'autre",
  "eigen_regie.zone.ROOD": "Rouge",
  "eigen_regie.zone.ORANJE": "Orange",
  "eigen_regie.zone.GEEL": "Jaune",
  "eigen_regie.zone.LICHTGROEN": "Vert clair",
  "eigen_regie.zone.GROEN": "Vert",
  "eigen_regie.confirm": "Confirmer",
};

// Load existing locale files
const en = loadJson('en.json');
const nl = loadJson('nl.json');
const fr = loadJson('fr.json');

// Merge new keys (only add if not already present)
for (const [key, val] of Object.entries(newKeysEN)) {
  if (!(key in en)) en[key] = val;
}
for (const [key, val] of Object.entries(newKeysNL)) {
  if (!(key in nl)) nl[key] = val;
}
for (const [key, val] of Object.entries(newKeysFR)) {
  if (!(key in fr)) fr[key] = val;
}

// Save
saveJson('en.json', en);
saveJson('nl.json', nl);
saveJson('fr.json', fr);

console.log(`✅ Added ${Object.keys(newKeysEN).length} new keys to en.json`);
console.log(`✅ Added ${Object.keys(newKeysNL).length} new keys to nl.json`);
console.log(`✅ Added ${Object.keys(newKeysFR).length} new keys to fr.json`);
