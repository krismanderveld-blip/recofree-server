/**
 * Script to add missing i18n keys to all three locale files.
 * Run with: node scripts/add-i18n-keys.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const LOCALES_DIR = resolve(import.meta.dirname, '../lib/i18n/locales');

function loadJson(file) {
  return JSON.parse(readFileSync(resolve(LOCALES_DIR, file), 'utf8'));
}

function saveJson(file, data) {
  writeFileSync(resolve(LOCALES_DIR, file), JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// New keys to add
const NEW_KEYS = {
  // Slider title labels (used in mood screen slider cards)
  "mood.slider.craving.label": { en: "Craving", nl: "Verlangen", fr: "Envie" },
  "mood.slider.frustration.label": { en: "Frustration", nl: "Frustratie", fr: "Frustration" },
  "mood.slider.despondency.label": { en: "Despondency", nl: "Moedeloosheid", fr: "Découragement" },
  "mood.slider.focus.label": { en: "Mental Focus", nl: "Mentale focus", fr: "Concentration mentale" },
  "mood.slider.stress.label": { en: "Stress", nl: "Stress", fr: "Stress" },
  "mood.slider.boundaryFatigue.label": { en: "Boundary Fatigue", nl: "Grensmoeheid", fr: "Fatigue des limites" },
  "mood.slider.emotionalBurden.label": { en: "Emotional Burden", nl: "Emotionele last", fr: "Charge émotionnelle" },
  "mood.slider.selfCare.label": { en: "Self-care", nl: "Zelfzorg", fr: "Soin de soi" },

  // Mood alert messages (with {labels} param)
  "mood.alert.severe.message": { en: "{labels} is at a critical level.", nl: "{labels} staat op een kritiek niveau.", fr: "{labels} est à un niveau critique." },
  "mood.alert.severe.message_plural": { en: "{labels} are at a critical level.", nl: "{labels} staan op een kritiek niveau.", fr: "{labels} sont à un niveau critique." },
  "mood.alert.moderate.message": { en: "{labels} is elevated.", nl: "{labels} is verhoogd.", fr: "{labels} est élevé." },
  "mood.alert.moderate.message_plural": { en: "{labels} are elevated.", nl: "{labels} zijn verhoogd.", fr: "{labels} sont élevés." },

  // Mood recognition section
  "mood.recognition.based_on_checkins": { en: "Based on {count} check-in{plural} this week", nl: "Gebaseerd op {count} check-in{plural} deze week", fr: "Basé sur {count} check-in{plural} cette semaine" },

  // Progress card
  "progress_card.signal.softened_prefix": { en: "Softened: ", nl: "Verzacht: ", fr: "Adouci : " },
  "progress_card.signal.increased_prefix": { en: "Needs attention: ", nl: "Vraagt aandacht: ", fr: "Demande attention : " },
  "progress_card.elias.inner_landscape.hope_prefix": { en: "Hope: ", nl: "Hoop: ", fr: "Espoir : " },
  "progress_card.elias.inner_landscape.fear_prefix": { en: "Fear: ", nl: "Angst: ", fr: "Peur : " },

  // Mood trend chart card - check-in recorded
  "mood_trend_chart_card.fallback.count_recorded": { en: "{count} check-in{plural} recorded", nl: "{count} check-in{plural} geregistreerd", fr: "{count} check-in{plural} enregistré{plural2}" },

  // Backpack section labels (Elias)
  "backpack.section.childhood.label": { en: "Childhood", nl: "Kindertijd", fr: "Enfance" },
  "backpack.section.childhood.age_range": { en: "6–12 years", nl: "6–12 jaar", fr: "6–12 ans" },
  "backpack.section.childhood.prompt": { en: "Where did you grow up during this period? Describe the atmosphere at home, your school years, friendships, and events that made an impression on you.", nl: "Waar groeide je op in deze periode? Beschrijf de sfeer thuis, je schooljaren, vriendschappen en gebeurtenissen die indruk op je maakten.", fr: "Où as-tu grandi pendant cette période ? Décris l'atmosphère à la maison, tes années d'école, tes amitiés et les événements qui t'ont marqué." },
  "backpack.section.adolescence.label": { en: "Adolescence", nl: "Adolescentie", fr: "Adolescence" },
  "backpack.section.adolescence.age_range": { en: "12–18 years", nl: "12–18 jaar", fr: "12–18 ans" },
  "backpack.section.adolescence.prompt": { en: "How was your teenage years? How were things at home, at school, and with peers? Did you have struggles or moments of growth?", nl: "Hoe was je tienertijd? Hoe ging het thuis, op school en met leeftijdsgenoten? Had je worstelingen of groeimomenten?", fr: "Comment étaient tes années d'adolescence ? Comment ça se passait à la maison, à l'école et avec tes pairs ? As-tu eu des difficultés ou des moments de croissance ?" },
  "backpack.section.adulthood.label": { en: "Adulthood", nl: "Volwassenheid", fr: "Âge adulte" },
  "backpack.section.adulthood.age_range": { en: "18–50 years", nl: "18–50 jaar", fr: "18–50 ans" },
  "backpack.section.adulthood.prompt": { en: "What are important choices or events in your adult life? Think about work, relationships, children, addiction, loss, growth, or meaning.", nl: "Wat zijn belangrijke keuzes of gebeurtenissen in je volwassen leven? Denk aan werk, relaties, kinderen, verslaving, verlies, groei of betekenis.", fr: "Quels sont les choix ou événements importants de ta vie adulte ? Pense au travail, aux relations, aux enfants, à l'addiction, à la perte, à la croissance ou au sens." },
  "backpack.section.family.label": { en: "Family", nl: "Familie", fr: "Famille" },
  "backpack.section.family.age_range": { en: "Throughout life", nl: "Heel het leven", fr: "Tout au long de la vie" },
  "backpack.section.family.prompt": { en: "How has your relationship with your parents or family been? Are there patterns, loyalties, or tensions that still influence you today?", nl: "Hoe is je relatie met je ouders of familie geweest? Zijn er patronen, loyaliteiten of spanningen die je vandaag nog beïnvloeden?", fr: "Comment a été ta relation avec tes parents ou ta famille ? Y a-t-il des schémas, des loyautés ou des tensions qui t'influencent encore aujourd'hui ?" },
  "backpack.section.themes.label": { en: "Recurring Themes", nl: "Terugkerende thema's", fr: "Thèmes récurrents" },
  "backpack.section.themes.age_range": { en: "Across all phases", nl: "Door alle fases heen", fr: "À travers toutes les phases" },
  "backpack.section.themes.prompt": { en: "Are there recurring themes, beliefs, or inner struggles that you recognize across these life phases?", nl: "Zijn er terugkerende thema's, overtuigingen of innerlijke worstelingen die je herkent door deze levensfasen heen?", fr: "Y a-t-il des thèmes récurrents, des croyances ou des luttes intérieures que tu reconnais à travers ces phases de vie ?" },
  "backpack.section.vsp.label": { en: "Safety Plan (VSP)", nl: "Veiligheidsplan (VSP)", fr: "Plan de sécurité (VSP)" },
  "backpack.section.vsp.age_range": { en: "Personal signals", nl: "Persoonlijke signalen", fr: "Signaux personnels" },
  "backpack.section.vsp.prompt": { en: "Write your safety plan here per zone.", nl: "Schrijf je veiligheidsplan hier per zone.", fr: "Écris ton plan de sécurité ici par zone." },

  // Backpack progress counter
  "backpack.progress.counter": { en: "{filled} of {total} sections", nl: "{filled} van {total} onderdelen", fr: "{filled} sur {total} sections" },

  // Kim backpack section labels
  "backpack.kim.my_story.title": { en: "My Story", nl: "Mijn verhaal", fr: "Mon histoire" },
  "backpack.kim.my_story.subtitle": { en: "Who am I outside of this relationship?", nl: "Wie ben ik buiten deze relatie?", fr: "Qui suis-je en dehors de cette relation ?" },
  "backpack.kim.the_relationship.title": { en: "The Relationship", nl: "De relatie", fr: "La relation" },
  "backpack.kim.the_relationship.subtitle": { en: "How did it evolve? When did it change?", nl: "Hoe is het geëvolueerd? Wanneer veranderde het?", fr: "Comment a-t-elle évolué ? Quand a-t-elle changé ?" },
  "backpack.kim.the_impact.title": { en: "The Impact", nl: "De impact", fr: "L'impact" },
  "backpack.kim.the_impact.subtitle": { en: "What has addiction done to my life, family, work?", nl: "Wat heeft verslaving gedaan met mijn leven, familie, werk?", fr: "Qu'est-ce que l'addiction a fait à ma vie, ma famille, mon travail ?" },
  "backpack.kim.my_boundaries.title": { en: "My Boundaries", nl: "Mijn grenzen", fr: "Mes limites" },
  "backpack.kim.my_boundaries.subtitle": { en: "What can I carry? What have I already tried?", nl: "Wat kan ik dragen? Wat heb ik al geprobeerd?", fr: "Que puis-je porter ? Qu'ai-je déjà essayé ?" },
  "backpack.kim.my_strength.title": { en: "My Strength", nl: "Mijn kracht", fr: "Ma force" },
  "backpack.kim.my_strength.subtitle": { en: "Where do I find strength? What do I want for myself?", nl: "Waar vind ik kracht? Wat wil ik voor mezelf?", fr: "Où est-ce que je trouve ma force ? Que veux-je pour moi-même ?" },

  // Profile STAGE_LABELS
  "profile.stage.precontemplation": { en: "Precontemplation", nl: "Voorbeschouwing", fr: "Précontemplation" },
  "profile.stage.contemplation": { en: "Contemplation", nl: "Beschouwing", fr: "Contemplation" },
  "profile.stage.preparation": { en: "Preparation", nl: "Voorbereiding", fr: "Préparation" },
  "profile.stage.action": { en: "Action", nl: "Actie", fr: "Action" },
  "profile.stage.maintenance": { en: "Maintenance", nl: "Onderhoud", fr: "Maintien" },

  // Profile stats
  "profile.user_card.stats.line": { en: "{companion} · {stage} · {sessions} session{sessionPlural} · {checkins} check-in{checkinPlural}", nl: "{companion} · {stage} · {sessions} sessie{sessionPlural} · {checkins} check-in{checkinPlural}", fr: "{companion} · {stage} · {sessions} session{sessionPlural} · {checkins} check-in{checkinPlural}" },
  "profile.user_card.stats.line_kim": { en: "{companion} · {sessions} session{sessionPlural} · {checkins} check-in{checkinPlural}", nl: "{companion} · {sessions} sessie{sessionPlural} · {checkins} check-in{checkinPlural}", fr: "{companion} · {sessions} session{sessionPlural} · {checkins} check-in{checkinPlural}" },
  "profile.user_card.stats.plural_s": { en: "s", nl: "s", fr: "s" },

  // Profile emergency contact remove
  "profile.emergency_contacts.alert.remove.message_name": { en: "Remove {name}?", nl: "{name} verwijderen?", fr: "Supprimer {name} ?" },

  // VSP export dialog title
  "profile.vsp_insight.share_title": { en: "VSP Insight Overview", nl: "VSP Insight Overzicht", fr: "Aperçu VSP Insight" },

  // Eigen Regie labels
  "mood.eigen_regie.question": { en: "To what extent was your day today determined by the choices of the other person?", nl: "In hoeverre werd je dag vandaag bepaald door de keuzes van de ander?", fr: "Dans quelle mesure ta journée a-t-elle été déterminée par les choix de l'autre personne ?" },
  "mood.eigen_regie.slider.min": { en: "Full self-direction", nl: "Volledige eigen regie", fr: "Pleine autonomie" },
  "mood.eigen_regie.slider.max": { en: "Fully determined by the other", nl: "Volledig bepaald door de ander", fr: "Entièrement déterminé par l'autre" },
  "mood.eigen_regie.zone.ROOD": { en: "Red", nl: "Rood", fr: "Rouge" },
  "mood.eigen_regie.zone.ORANJE": { en: "Orange", nl: "Oranje", fr: "Orange" },
  "mood.eigen_regie.zone.GEEL": { en: "Yellow", nl: "Geel", fr: "Jaune" },
  "mood.eigen_regie.zone.LICHTGROEN": { en: "Light Green", nl: "Lichtgroen", fr: "Vert clair" },
  "mood.eigen_regie.zone.GROEN": { en: "Green", nl: "Groen", fr: "Vert" },
  "mood.eigen_regie.meaning.ROOD": { en: "I was completely focused on the other person. I felt responsible for their behavior.", nl: "Ik was volledig gericht op de ander. Ik voelde me verantwoordelijk voor hun gedrag.", fr: "J'étais entièrement concentré sur l'autre personne. Je me sentais responsable de son comportement." },
  "mood.eigen_regie.meaning.ORANJE": { en: "I was mostly occupied with the other person. My own needs barely came up.", nl: "Ik was vooral bezig met de ander. Mijn eigen behoeften kwamen nauwelijks aan bod.", fr: "J'étais principalement occupé par l'autre personne. Mes propres besoins n'ont presque pas été abordés." },
  "mood.eigen_regie.meaning.GEEL": { en: "I was often thinking about the other person, but also thought about myself briefly.", nl: "Ik dacht vaak aan de ander, maar dacht ook kort aan mezelf.", fr: "Je pensais souvent à l'autre personne, mais j'ai aussi brièvement pensé à moi-même." },
  "mood.eigen_regie.meaning.LICHTGROEN": { en: "I considered the other person, but also stayed with myself.", nl: "Ik hield rekening met de ander, maar bleef ook bij mezelf.", fr: "J'ai tenu compte de l'autre personne, mais je suis aussi resté avec moi-même." },
  "mood.eigen_regie.meaning.GROEN": { en: "I followed my own plan. I felt free, regardless of what the other person did.", nl: "Ik volgde mijn eigen plan. Ik voelde me vrij, ongeacht wat de ander deed.", fr: "J'ai suivi mon propre plan. Je me sentais libre, peu importe ce que l'autre personne faisait." },
};

// Load all three locale files
const en = loadJson('en.json');
const nl = loadJson('nl.json');
const fr = loadJson('fr.json');

// Add new keys
let addedCount = 0;
for (const [key, translations] of Object.entries(NEW_KEYS)) {
  if (!en[key]) { en[key] = translations.en; addedCount++; }
  if (!nl[key]) { nl[key] = translations.nl; }
  if (!fr[key]) { fr[key] = translations.fr; }
}

// Save
saveJson('en.json', en);
saveJson('nl.json', nl);
saveJson('fr.json', fr);

console.log(`Done. Added ${addedCount} new keys to locale files.`);
