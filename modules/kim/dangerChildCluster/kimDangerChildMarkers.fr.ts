/**
 * FR markers for GEVAAR-K01 and KIND-K01
 * Kim persona only
 * Note: word boundaries with accented chars use (?:\b|\s|^) and (?:\s|$|[,.]|(?=\s)) patterns
 */

// ============ GEVAAR-K01 MARKERS ============

export const FR_DRUNK_DRIVING_MARKERS: RegExp[] = [
  /\bil\s+conduit\s+ivre\b/i,
  /\belle\s+conduit\s+ivre\b/i,
  /\bil\s+veut\s+conduire\s+apr[eè]s\s+avoir\s+bu/i,
  /\belle\s+veut\s+conduire\s+apr[eè]s\s+avoir\s+bu/i,
  /\bil\s+est\s+parti\s+en\s+voiture\s+apr[eè]s\s+avoir\s+bu/i,
  /\belle\s+est\s+partie\s+en\s+voiture\s+apr[eè]s\s+avoir\s+bu/i,
  /\bil\s+conduit\s+sous\s+influence\b/i,
  /\belle\s+conduit\s+sous\s+influence\b/i,
  /\bil\s+veut\s+prendre\s+les\s+cl[eé]s/i,
  /\belle\s+veut\s+prendre\s+les\s+cl[eé]s/i,
  /condui(t|re)\s+(ivre|sous\s+influence)/i,
];

export const FR_AGGRESSION_MARKERS: RegExp[] = [
  /\bil\s+devient\s+agressif\b/i,
  /\belle\s+devient\s+agressive\b/i,
  /\bil\s+me\s+menace\b/i,
  /\belle\s+me\s+menace\b/i,
  /\bil\s+crie\s+et\s+jette\s+des\s+choses\b/i,
  /\belle\s+crie\s+et\s+jette\s+des\s+choses\b/i,
  /\bil\s+m'?a\s+frapp[eé]/i,
  /\belle\s+m'?a\s+frapp[eé]/i,
  /\bil\s+m'?a\s+pouss[eé]/i,
  /\belle\s+m'?a\s+pouss[eé]e/i,
  /\bje\s+ne\s+me\s+sens\s+pas\s+en\s+s[eé]curit[eé]\s+[àa]\s+la\s+maison/i,
  /\bj'?ai\s+peur\s+qu'?il\s+me\s+fasse\s+du\s+mal/i,
  /\bj'?ai\s+peur\s+qu'?elle\s+me\s+fasse\s+du\s+mal/i,
];

export const FR_DISAPPEARANCE_MARKERS: RegExp[] = [
  /\bil\s+a\s+disparu\b/i,
  /\belle\s+a\s+disparu\b/i,
  /\bje\s+ne\s+sais\s+pas\s+o[uù]\s+il\s+est\b/i,
  /\bje\s+ne\s+sais\s+pas\s+o[uù]\s+elle\s+est\b/i,
  /\bil\s+ne\s+r[eé]pond\s+pas\b/i,
  /\belle\s+ne\s+r[eé]pond\s+pas\b/i,
  /\bil\s+est\s+introuvable\b/i,
  /\belle\s+est\s+introuvable\b/i,
  /\bil\s+est\s+parti\s+apr[eè]s\s+avoir\s+bu/i,
  /\belle\s+est\s+partie\s+apr[eè]s\s+avoir\s+consomm[eé]/i,
];

export const FR_MEDICAL_OVERDOSE_MARKERS: RegExp[] = [
  /\bil\s+ne\s+r[eé]pond\s+plus\b/i,
  /\belle\s+ne\s+r[eé]pond\s+plus\b/i,
  /\bil\s+respire\s+bizarrement\b/i,
  /\belle\s+respire\s+bizarrement\b/i,
  /\bil\s+est\s+inconscient\b/i,
  /\belle\s+est\s+inconsciente\b/i,
  /\bil\s+a\s+trop\s+pris\b/i,
  /\belle\s+a\s+trop\s+pris\b/i,
  /\bje\s+pense\s+qu'?il\s+a\s+fait\s+une\s+overdose\b/i,
  /\bje\s+pense\s+qu'?elle\s+a\s+fait\s+une\s+overdose\b/i,
  /\boverdose\b/i,
  /\binconscien(t|te)\b/i,
];

export const FR_SELF_HARM_THREAT_MARKERS: RegExp[] = [
  /\bil\s+menace\s+de\s+se\s+faire\s+du\s+mal/i,
  /\belle\s+menace\s+de\s+se\s+faire\s+du\s+mal/i,
  /\bil\s+dit\s+qu'?il\s+ne\s+veut\s+plus\s+vivre/i,
  /\belle\s+dit\s+qu'?elle\s+ne\s+veut\s+plus\s+vivre/i,
  /\bil\s+veut\s+(en\s+finir|se\s+suicider|mourir)/i,
  /\belle\s+veut\s+(en\s+finir|se\s+suicider|mourir)/i,
];

// ============ KIND-K01 MARKERS ============

export const FR_CHILD_WITNESSES_MARKERS: RegExp[] = [
  /\bles\s+enfants\s+le\s+(voient|remarquent)\b/i,
  /\bmon\s+fils\s+le\s+voit\b/i,
  /\bma\s+fille\s+le\s+voit\b/i,
  /\bles\s+enfants\s+ont\s+tout\s+entendu\b/i,
  /\bles\s+enfants\s+nous\s+entendent\s+nous\s+disputer\b/i,
  /\bil\s+est\s+ivre\s+devant\s+les\s+enfants\b/i,
  /\belle\s+est\s+ivre\s+devant\s+les\s+enfants\b/i,
  /\bil\s+consomme\s+devant\s+les\s+enfants\b/i,
  /\belle\s+consomme\s+devant\s+les\s+enfants\b/i,
];

export const FR_CHILD_FEAR_MARKERS: RegExp[] = [
  /\bmon\s+fils\s+a\s+peur\b/i,
  /\bma\s+fille\s+a\s+peur\b/i,
  /\bles\s+enfants\s+ont\s+peur\b/i,
  /\bmon\s+enfant\s+pleure\s+quand\s+il\s+boit\b/i,
  /\bmon\s+enfant\s+pleure\s+quand\s+elle\s+boit\b/i,
  /\bles\s+enfants\s+se\s+cachent\b/i,
  /\bles\s+enfants\s+ne\s+veu[lx]ent\s+pas\s+rentrer\b/i,
];

export const FR_CHILD_PARENTIFICATION_MARKERS: RegExp[] = [
  /\bmon\s+fils\s+essaie\s+de\s+le\s+calmer\b/i,
  /\bma\s+fille\s+essaie\s+de\s+la\s+calmer\b/i,
  /\bles\s+enfants\s+s'?occupent\s+de\s+(lui|elle)\b/i,
  /\bmon\s+enfant\s+le\s+surveille\b/i,
  /\bmon\s+enfant\s+la\s+surveille\b/i,
  /\bmon\s+enfant\s+doit\s+me\s+dire\s+s'?il\s+boit\b/i,
  /\bmon\s+enfant\s+doit\s+me\s+dire\s+si\s+elle\s+consomme\b/i,
  /\bles\s+enfants\s+demandent\s+s'?ils\s+doivent\s+faire\s+quelque\s+chose\b/i,
];

export const FR_CHILD_NEGLECT_MALTREATMENT_MARKERS: RegExp[] = [
  /\bles\s+enfants\s+n'?ont\s+pas\s+[àa]\s+manger\b/i,
  /\bles\s+enfants\s+sont\s+laiss[eé]s\s+seuls\b/i,
  /\bil\s+laisse\s+les\s+enfants\s+seuls\s+quand\s+il\s+boit\b/i,
  /\belle\s+laisse\s+les\s+enfants\s+seuls?\s+quand\s+elle\s+consomme\b/i,
  /\bmon\s+enfant\s+n'?est\s+pas\s+en\s+s[eé]curit[eé]/i,
  /\bles\s+enfants\s+ne\s+sont\s+pas\s+en\s+s[eé]curit[eé]/i,
  /\bil\s+conduit\s+ivre\s+avec\s+les\s+enfants\b/i,
  /\belle\s+conduit\s+ivre\s+avec\s+les\s+enfants\b/i,
  /\bil\s+crie\s+sur\s+les\s+enfants\b/i,
  /\belle\s+crie\s+sur\s+les\s+enfants\b/i,
  /\bil\s+frappe\s+les\s+enfants\b/i,
  /\belle\s+frappe\s+les\s+enfants\b/i,
];

export const FR_CHILD_AGE_APPROPRIATE_MARKERS: RegExp[] = [
  /\bque\s+dire\s+aux\s+enfants\b/i,
  /\bcomment\s+expliquer\s+(cela|[çc]a)\s+[àa]\s+mon\s+(fils|enfant)\b/i,
  /\bcomment\s+expliquer\s+(cela|[çc]a)\s+[àa]\s+ma\s+fille\b/i,
  /\bdois-?je\s+dire\s+la\s+v[eé]rit[eé]\s+aux\s+enfants/i,
  /\bje\s+veux\s+prot[eé]ger\s+les\s+enfants/i,
  /\bje\s+ne\s+veux\s+pas\s+que\s+les\s+enfants\s+(le|la)\s+d[eé]testent/i,
];
