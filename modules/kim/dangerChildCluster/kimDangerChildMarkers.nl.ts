/**
 * NL markers for GEVAAR-K01 and KIND-K01
 * Kim persona only
 */

// ============ GEVAAR-K01 MARKERS ============

export const NL_DRUNK_DRIVING_MARKERS: RegExp[] = [
  /\b(hij|zij|ze)\s+rijdt\s+dronken\b/i,
  /\b(hij|zij|ze)\s+wil\s+rijden\s+terwijl\s+(hij|zij|ze)\s+(gedronken|gebruikt)\s+heeft\b/i,
  /\b(hij|zij|ze)\s+is\s+met\s+de\s+auto\s+weg\s+en\s+(hij|zij|ze)\s+heeft\s+(gedronken|gebruikt)\b/i,
  /\b(hij|zij|ze)\s+gaat\s+rijden\s+onder\s+invloed\b/i,
  /\b(hij|zij|ze)\s+stapt\s+in\s+de\s+auto\s+terwijl\s+(hij|zij|ze)\s+gebruikt\s+heeft\b/i,
  /\b(hij|zij|ze)\s+wil\s+de\s+sleutels\s+pakken\b/i,
  /rijden\s+onder\s+invloed/i,
  /dronken\s+(achter\s+het\s+stuur|rijden|met\s+de\s+auto)/i,
];

export const NL_AGGRESSION_MARKERS: RegExp[] = [
  /\b(hij|zij|ze)\s+wordt\s+agressief\b/i,
  /\b(hij|zij|ze)\s+bedreigt\s+mij\b/i,
  /\b(hij|zij|ze)\s+roept\s+en\s+gooit\s+(dingen|spullen)\b/i,
  /\b(hij|zij|ze)\s+slaat\b/i,
  /\b(hij|zij|ze)\s+duwt\s+mij\b/i,
  /\bik\s+ben\s+bang\s+dat\s+(hij|zij|ze)\s+mij\s+iets\s+aandoet\b/i,
  /\bhet\s+escaleert\s+thuis\b/i,
  /\bik\s+voel\s+me\s+niet\s+veilig\s+thuis\b/i,
  /\b(hij|zij|ze)\s+(heeft|had)\s+mij\s+(geslagen|geduwd|geschopt)\b/i,
  /\bgeweld\s+thuis\b/i,
  /\b(hij|zij|ze)\s+is\s+agressief\b/i,
];

export const NL_DISAPPEARANCE_MARKERS: RegExp[] = [
  /\b(hij|zij|ze)\s+is\s+verdwenen\b/i,
  /\bik\s+weet\s+niet\s+waar\s+(hij|zij|ze)\s+is\b/i,
  /\b(hij|zij|ze)\s+neemt\s+niet\s+op\b/i,
  /\b(hij|zij|ze)\s+is\s+weg\s+en\s+(hij|zij|ze)\s+heeft\s+(gedronken|gebruikt)\b/i,
  /\b(hij|zij|ze)\s+is\s+spoorloos\b/i,
  /\b(hij|zij|ze)\s+is\s+al\s+\w+\s+weg\b/i,
];

export const NL_MEDICAL_OVERDOSE_MARKERS: RegExp[] = [
  /\b(hij|zij|ze)\s+reageert\s+niet\b/i,
  /\b(hij|zij|ze)\s+ademt\s+raar\b/i,
  /\b(hij|zij|ze)\s+is\s+bewusteloos\b/i,
  /\b(hij|zij|ze)\s+heeft\s+te\s+veel\s+(genomen|gedronken|gebruikt)\b/i,
  /\bik\s+denk\s+dat\s+(hij|zij|ze)\s+een\s+overdosis\s+heeft\b/i,
  /\boverdosis\b/i,
  /\bbewusteloos\b/i,
];

export const NL_SELF_HARM_THREAT_MARKERS: RegExp[] = [
  /\b(hij|zij|ze)\s+dreigt\s+zichzelf\s+iets\s+aan\s+te\s+doen\b/i,
  /\b(hij|zij|ze)\s+zegt\s+dat\s+(hij|zij|ze)\s+niet\s+meer\s+wil\s+leven\b/i,
  /\b(hij|zij|ze)\s+wil\s+(er\s+)?niet\s+meer\s+zijn\b/i,
  /\b(hij|zij|ze)\s+dreigt\s+met\s+zelfdoding\b/i,
  /\b(hij|zij|ze)\s+wil\s+zichzelf\s+(iets\s+aandoen|van\s+kant\s+maken)\b/i,
];

// ============ KIND-K01 MARKERS ============

export const NL_CHILD_WITNESSES_MARKERS: RegExp[] = [
  /\bde\s+kinderen\s+zi[ea]n\s+het\b/i,
  /\bde\s+kinderen\s+merken\s+het\b/i,
  /\bde\s+kinderen\s+hebben\s+(hem|haar)\s+dronken\s+gezi[ea]n\b/i,
  /\bmijn\s+(zoon|dochter)\s+zi[ea]t\s+het\b/i,
  /\bde\s+kinderen\s+horen\s+(alles|ons\s+ruzie\s+maken)\b/i,
  /\b(hij|zij|ze)\s+is\s+dronken\s+waar\s+de\s+kinderen\s+bij\s+zijn\b/i,
  /\b(hij|zij|ze)\s+gebruikt\s+waar\s+de\s+kinderen\s+bij\s+zijn\b/i,
  /\bkinderen\s+bij\s+zijn\b/i,
];

export const NL_CHILD_FEAR_MARKERS: RegExp[] = [
  /\bmijn\s+(zoon|dochter|kind)\s+is\s+bang\b/i,
  /\bde\s+kinderen\s+zijn\s+bang\b/i,
  /\bde\s+kinderen\s+durven\s+niet\b/i,
  /\bmijn\s+kind\s+huilt\s+als\s+(hij|zij|ze)\s+drinkt\b/i,
  /\bde\s+kinderen\s+kruipen\s+weg\b/i,
  /\bde\s+kinderen\s+willen\s+niet\s+naar\s+huis\b/i,
  /\b(zoon|dochter|kind|kinderen)\s+.{0,20}bang\b/i,
];

export const NL_CHILD_PARENTIFICATION_MARKERS: RegExp[] = [
  /\bmijn\s+(zoon|dochter)\s+probeert\s+(hem|haar)\s+te\s+kalmeren\b/i,
  /\bde\s+kinderen\s+zorgen\s+voor\s+(hem|haar)\b/i,
  /\bmijn\s+kind\s+houdt\s+(hem|haar)\s+in\s+het\s+oog\b/i,
  /\bmijn\s+kind\s+moet\s+melden\s+of\s+(hij|zij|ze)\s+(drinkt|gebruikt)\b/i,
  /\bde\s+kinderen\s+vragen\s+of\s+ze\s+iets\s+moeten\s+doen\b/i,
  /\bkinderen\s+moeten\s+(hem|haar)\s+kalmeren\b/i,
];

export const NL_CHILD_NEGLECT_MALTREATMENT_MARKERS: RegExp[] = [
  /\bde\s+kinderen\s+krijgen\s+geen\s+eten\b/i,
  /\bde\s+kinderen\s+worden\s+alleen\s+gelaten\b/i,
  /\b(hij|zij|ze)\s+laat\s+de\s+kinderen\s+alleen\s+terwijl\s+(hij|zij|ze)\s+(drinkt|gebruikt)\b/i,
  /\bmijn\s+kind\s+is\s+niet\s+veilig\b/i,
  /\bde\s+kinderen\s+zijn\s+niet\s+veilig\b/i,
  /\b(hij|zij|ze)\s+rijdt\s+dronken\s+met\s+de\s+kinderen\b/i,
  /\b(hij|zij|ze)\s+schreeuwt\s+tegen\s+de\s+kinderen\b/i,
  /\b(hij|zij|ze)\s+slaat\s+de\s+kinderen\b/i,
  /\bdronken\s+.{0,15}met\s+de\s+kinderen\b/i,
  /\bkinderen\s+.{0,10}niet\s+veilig\b/i,
];

export const NL_CHILD_AGE_APPROPRIATE_MARKERS: RegExp[] = [
  /\bwat\s+zeg\s+ik\s+tegen\s+de\s+kinderen\b/i,
  /\bhoe\s+leg\s+ik\s+(dit|het)\s+uit\s+aan\s+mijn\s+(zoon|dochter|kind)\b/i,
  /\bmoet\s+ik\s+de\s+waarheid\s+zeggen\s+tegen\s+de\s+kinderen\b/i,
  /\bik\s+wil\s+de\s+kinderen\s+beschermen\b/i,
  /\bik\s+wil\s+niet\s+dat\s+de\s+kinderen\s+(hem|haar)\s+haten\b/i,
];
