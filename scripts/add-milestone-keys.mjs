import { readFileSync, writeFileSync } from 'fs';

const localeDir = './lib/i18n/locales';

// Milestone keys for Elias
const eliasKeys = {
  en: {
    "milestone.elias.day_1.title": "Day 1. The hardest one.",
    "milestone.elias.day_1.message": "You're here. That's all that was needed today.",
    "milestone.elias.day_1.cta": "I'm here",
    "milestone.elias.day_7.title": "One week of choosing differently.",
    "milestone.elias.day_7.message": "Seven days of choosing again and again. Not perfect, but present.",
    "milestone.elias.day_7.cta": "Quietly forward",
    "milestone.elias.day_14.title": "Two weeks. The body remembers.",
    "milestone.elias.day_14.message": "Your nervous system is starting to create space. That doesn't always feel good. But it's movement.",
    "milestone.elias.day_14.cta": "I feel it",
    "milestone.elias.day_30.title": "Thirty days. A month of choosing.",
    "milestone.elias.day_30.message": "One month doesn't mean it got easier. It means you kept choosing, even on the hard days.",
    "milestone.elias.day_30.cta": "I choose again",
    "milestone.elias.day_60.title": "Two months. The fog is lifting.",
    "milestone.elias.day_60.message": "Sixty days of recovery. Not every day felt like progress. But you're here, and that's enough.",
    "milestone.elias.day_60.cta": "I'm here",
    "milestone.elias.day_90.title": "Ninety days. This is real.",
    "milestone.elias.day_90.message": "Three months of recovery doesn't need applause. It does deserve recognition: you've built something.",
    "milestone.elias.day_90.cta": "I acknowledge this",
    "milestone.elias.day_180.title": "Half a year of choosing differently.",
    "milestone.elias.day_180.message": "Six months of recovery doesn't need big words. It deserves a quiet acknowledgment: you've built something that needs protecting.",
    "milestone.elias.day_180.cta": "Protect what grows",
    "milestone.elias.day_365.title": "A year of recovery space.",
    "milestone.elias.day_365.message": "A year doesn't mean everything is over. It means there's a full year in which recovery found its place, again and again.",
    "milestone.elias.day_365.cta": "Carry this gently",
  },
  nl: {
    "milestone.elias.day_1.title": "Dag 1. De moeilijkste.",
    "milestone.elias.day_1.message": "Je bent er. Dat is alles wat vandaag nodig was.",
    "milestone.elias.day_1.cta": "Ik ben er",
    "milestone.elias.day_7.title": "Een week anders kiezen.",
    "milestone.elias.day_7.message": "Zeven dagen steeds opnieuw kiezen. Niet perfect, maar aanwezig.",
    "milestone.elias.day_7.cta": "Stil vooruit",
    "milestone.elias.day_14.title": "Twee weken. Het lichaam herinnert zich.",
    "milestone.elias.day_14.message": "Je zenuwstelsel begint ruimte te maken. Dat voelt niet altijd goed. Maar het is beweging.",
    "milestone.elias.day_14.cta": "Ik voel het",
    "milestone.elias.day_30.title": "Dertig dagen. Een maand van kiezen.",
    "milestone.elias.day_30.message": "Een maand betekent niet dat het makkelijker werd. Het betekent dat je bleef kiezen, ook op de moeilijke dagen.",
    "milestone.elias.day_30.cta": "Ik kies opnieuw",
    "milestone.elias.day_60.title": "Twee maanden. De mist trekt op.",
    "milestone.elias.day_60.message": "Zestig dagen herstel. Niet elke dag voelde als vooruitgang. Maar je bent er, en dat is genoeg.",
    "milestone.elias.day_60.cta": "Ik ben er",
    "milestone.elias.day_90.title": "Negentig dagen. Dit is echt.",
    "milestone.elias.day_90.message": "Drie maanden herstel heeft geen applaus nodig. Het verdient wel erkenning: je hebt iets opgebouwd.",
    "milestone.elias.day_90.cta": "Ik erken dit",
    "milestone.elias.day_180.title": "Een half jaar anders kiezen.",
    "milestone.elias.day_180.message": "Zes maanden herstel heeft geen grote woorden nodig. Het verdient een stille erkenning: je hebt iets opgebouwd dat bescherming verdient.",
    "milestone.elias.day_180.cta": "Bescherm wat groeit",
    "milestone.elias.day_365.title": "Een jaar herstelruimte.",
    "milestone.elias.day_365.message": "Een jaar betekent niet dat alles voorbij is. Het betekent dat herstel een heel jaar lang zijn plek vond, steeds opnieuw.",
    "milestone.elias.day_365.cta": "Draag dit zacht",
  },
  fr: {
    "milestone.elias.day_1.title": "Jour 1. Le plus difficile.",
    "milestone.elias.day_1.message": "Tu es là. C'est tout ce qui était nécessaire aujourd'hui.",
    "milestone.elias.day_1.cta": "Je suis là",
    "milestone.elias.day_7.title": "Une semaine de choix différents.",
    "milestone.elias.day_7.message": "Sept jours à choisir encore et encore. Pas parfait, mais présent.",
    "milestone.elias.day_7.cta": "Doucement en avant",
    "milestone.elias.day_14.title": "Deux semaines. Le corps se souvient.",
    "milestone.elias.day_14.message": "Ton système nerveux commence à créer de l'espace. Ça ne fait pas toujours du bien. Mais c'est du mouvement.",
    "milestone.elias.day_14.cta": "Je le sens",
    "milestone.elias.day_30.title": "Trente jours. Un mois de choix.",
    "milestone.elias.day_30.message": "Un mois ne signifie pas que c'est devenu plus facile. Ça signifie que tu as continué à choisir, même les jours difficiles.",
    "milestone.elias.day_30.cta": "Je choisis encore",
    "milestone.elias.day_60.title": "Deux mois. Le brouillard se lève.",
    "milestone.elias.day_60.message": "Soixante jours de rétablissement. Chaque jour n'a pas semblé être un progrès. Mais tu es là, et c'est suffisant.",
    "milestone.elias.day_60.cta": "Je suis là",
    "milestone.elias.day_90.title": "Quatre-vingt-dix jours. C'est réel.",
    "milestone.elias.day_90.message": "Trois mois de rétablissement n'ont pas besoin d'applaudissements. Ils méritent une reconnaissance : tu as construit quelque chose.",
    "milestone.elias.day_90.cta": "Je reconnais cela",
    "milestone.elias.day_180.title": "Six mois de choix différents.",
    "milestone.elias.day_180.message": "Six mois de rétablissement n'ont pas besoin de grands mots. Ils méritent une reconnaissance silencieuse : tu as construit quelque chose qui mérite d'être protégé.",
    "milestone.elias.day_180.cta": "Protéger ce qui grandit",
    "milestone.elias.day_365.title": "Un an d'espace de rétablissement.",
    "milestone.elias.day_365.message": "Un an ne signifie pas que tout est fini. Ça signifie qu'il y a une année entière où le rétablissement a trouvé sa place, encore et encore.",
    "milestone.elias.day_365.cta": "Porter cela doucement",
  },
};

// Milestone keys for Kim
const kimKeys = {
  en: {
    "milestone.kim.week_1.title": "A week of not forgetting yourself.",
    "milestone.kim.week_1.message": "A week of self-care isn't a score. It's a signal that your capacity also gets a place.",
    "milestone.kim.week_1.cta": "Gently forward",
    "milestone.kim.month_1.title": "A month of guarding your capacity.",
    "milestone.kim.month_1.message": "A month of attention for yourself doesn't mean caring got easier. It means you didn't completely disappear from view.",
    "milestone.kim.month_1.cta": "Take space",
    "milestone.kim.month_3.title": "Three months with yourself included.",
    "milestone.kim.month_3.message": "Three months of self-care isn't an obligation you had to get right. It's a trace of care that also returns to you.",
    "milestone.kim.month_3.cta": "Don't carry alone",
    "milestone.kim.month_6.title": "Six months of boundaries and care.",
    "milestone.kim.month_6.message": "Six months of attention to your capacity deserves quiet recognition. Not because you cared perfectly, but because you kept counting too.",
    "milestone.kim.month_6.cta": "Preserve your capacity",
  },
  nl: {
    "milestone.kim.week_1.title": "Een week waarin je jezelf niet vergat.",
    "milestone.kim.week_1.message": "Een week zelfzorg is geen score. Het is een signaal dat jouw draagkracht ook een plek krijgt.",
    "milestone.kim.week_1.cta": "Zacht vooruit",
    "milestone.kim.month_1.title": "Een maand je draagkracht bewaken.",
    "milestone.kim.month_1.message": "Een maand aandacht voor jezelf betekent niet dat zorgen makkelijker werd. Het betekent dat je niet helemaal uit beeld verdween.",
    "milestone.kim.month_1.cta": "Neem ruimte",
    "milestone.kim.month_3.title": "Drie maanden met jezelf erbij.",
    "milestone.kim.month_3.message": "Drie maanden zelfzorg is geen verplichting die je goed moest doen. Het is een spoor van zorg dat ook naar jou terugkeert.",
    "milestone.kim.month_3.cta": "Draag niet alleen",
    "milestone.kim.month_6.title": "Zes maanden grenzen en zorg.",
    "milestone.kim.month_6.message": "Zes maanden aandacht voor je draagkracht verdient stille erkenning. Niet omdat je perfect zorgde, maar omdat je bleef meetellen.",
    "milestone.kim.month_6.cta": "Bewaar je draagkracht",
  },
  fr: {
    "milestone.kim.week_1.title": "Une semaine sans t'oublier.",
    "milestone.kim.week_1.message": "Une semaine de soins personnels n'est pas un score. C'est un signal que ta capacité a aussi sa place.",
    "milestone.kim.week_1.cta": "Doucement en avant",
    "milestone.kim.month_1.title": "Un mois à préserver ta capacité.",
    "milestone.kim.month_1.message": "Un mois d'attention pour toi-même ne signifie pas que prendre soin est devenu plus facile. Ça signifie que tu n'as pas complètement disparu du tableau.",
    "milestone.kim.month_1.cta": "Prends de l'espace",
    "milestone.kim.month_3.title": "Trois mois en te comptant aussi.",
    "milestone.kim.month_3.message": "Trois mois de soins personnels n'est pas une obligation à réussir. C'est une trace de soin qui te revient aussi.",
    "milestone.kim.month_3.cta": "Ne porte pas seul(e)",
    "milestone.kim.month_6.title": "Six mois de limites et de soin.",
    "milestone.kim.month_6.message": "Six mois d'attention à ta capacité mérite une reconnaissance silencieuse. Pas parce que tu as pris soin parfaitement, mais parce que tu as continué à compter aussi.",
    "milestone.kim.month_6.cta": "Préserve ta capacité",
  },
};

function addKeysToLocale(lang) {
  const filePath = `${localeDir}/${lang}.json`;
  const data = JSON.parse(readFileSync(filePath, 'utf8'));
  
  const allKeys = { ...eliasKeys[lang], ...kimKeys[lang] };
  let added = 0;
  
  for (const [key, value] of Object.entries(allKeys)) {
    if (!data[key]) {
      data[key] = value;
      added++;
    }
  }
  
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  console.log(`[${lang}] Added ${added} milestone keys`);
}

addKeysToLocale('en');
addKeysToLocale('nl');
addKeysToLocale('fr');
console.log('Done!');
